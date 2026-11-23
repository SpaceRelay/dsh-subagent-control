# 调研记录：为什么需要这扇门

这是动工之前查官方源码留下的记录。它解释插件为什么长这样，日常使用不需要读。

## 结论先说

**能做成，而且比预想的干净。** 不需要伪造会话事件、不需要改官方包、不需要动已有对话的历史。

核心发现：**"只允许父路由 / 只允许白名单"这道闸门，只装在官方 `subagent` 工具的入口里，不在底层服务里。**

`ctx.subagents.startActivation({ ... agentOptions: { provider, model } })` 是官方公开契约（spawn provider 明确声明支持 `agentOptions` 能力）。插件自己注册一个工具、直接调它，就绕开了那道闸门，任何对话（含早已存在的）都能用。

代价：这是**另开一扇门**，不是把原来那扇门修好。官方 `subagent` 工具的行为保持不变。

---

## 源码证据（来自 DSH 应用包内的官方源码，不是推测）

### 闸门的确切位置

`@deepseek-ai/dsh-tool-subagent/src/index.ts`：

- `:281` `const routes = subagentModelSelectionPolicy(handle, parent.session)` —— 读本对话的 policy
- `:291` `requestedAgentOptions(configured, modelRequest, modelSelectionEnabled, modelSelectionPolicy, parentOptions)` —— **全仓唯一**套 policy 的地方
- `:317-326` 组装 request → `ctx.subagents.startActivation({ provider: config.provider, ... , agentOptions })`

policy 判定在 `model-selection.ts` 的 `assertAllowedModelSelection`：policy 为 undefined 时**只允许 provider + model 与父对话完全相同**，否则必须命中白名单；失败时报
`child LLM route "p/m" is not allowed for this Session`。

### 为什么老对话补不上

`@deepseek-ai/dsh-tool-subagent/src/model-selection-settings.ts`：policy 只在 `agent/created` 钩子里写，条件写死为

```
target.firstLiveSeq === 0 && target.eventAt(0)?.type !== 'session/end-seed'
```

老对话 `firstLiveSeq > 0`，永不满足；fork 出来的子会话带 `session/end-seed` 也不满足。

### 服务层没有这道闸门

`@deepseek-ai/dsh-subagent/src/index.ts:267` `async startActivation(spec)` 里只有这些检查：

1. provider 已注册
2. `childId` 需要 provider 支持 prepareContinuable
3. `assertSubagentMaxDepth`（`depth.ts:36-44`，不传就是 undefined，不限）
4. `assertCapabilities` —— 唯一的能力门，需要 provider 声明 `capabilities.agentOptions === true`
5. parent 必须是"活着的那个 agent 实例"（`agents.get(parent.id) !== parent` 报 UNAUTHORIZED）
6. outputSchema 若是对象需合法

**没有 policy、没有白名单、没有对话创建时间检查。**

### spawn provider 明确支持

`@deepseek-ai/dsh-subagent-spawn-in-process/src/index.ts:39-46`：

```
capabilities = { agentOptions: true, agentPreset: true, outputSchema: true, depthLimit: true }
inheritsParentContext = false
```

`agentOptions` 的语义（`@deepseek-ai/dsh-subagent/src/types.ts` 注释原文）：

> Requires SubagentCapabilities.agentOptions; in-process providers merge them over the parent Agent's options

`AgentOptions` 本体（`@deepseek-ai/dsh-agent/src/runtime-types.ts:32-41`）：`provider? / model? / reasoningEffort? / maxTokens?`。

### 落地链路（agentOptions 会被持久化）

`@deepseek-ai/dsh-subagent/src/manager.ts`：

- `:340` `resolveChildAgentOptions(parent, spec.agentOptions, childDepth)`
- `:341-343` 拆成 `agentProvider / agentModel / agentReasoningEffort` 写进 `subagent/descriptor`
- `:857-865` `agents.create({ ..., agentOptions })`
- `:1241-1243` 冷恢复时从 descriptor 重建 agentOptions

含义：子代理被指定到另一个渠道的模型之后，**冷恢复也不会掉回父模型**，这是官方保证的行为。

### 其他会影响实现的细节

| 细节 | 源码位置 | 后果 |
|---|---|---|
| 换路由且没给 effort 时，会**丢掉**继承的 effort | `child-agent.ts` `resolveChildAgentOptions` | 子代理用新渠道的默认档 |
| effort 不被支持时报 `provider "X" model "Y" does not support reasoning effort "Z"` | `dsh-llm/src/index.ts` `resolveCallWithInfo` | 要在插件侧先 preflight，别让它变成运行期炸 |
| 子代理模型不支持图像时，带图 prompt 被拒 | `manager.ts:1320-1328` | 用 `llm.resolveModelInfo` 先查 `inputModalities` |
| `delivery:'caller'` 不许指定 `name` | `manager.ts:436` | caller 模式子代理不进父对话名册 |
| `delivery:'parent'` → 结果作为消息回灌父对话 | `manager.ts:334/887` | 这才是"派活"的正常手感 |
| 调用方必须是活着的父 agent | `dsh-subagent/src/index.ts` startActivation | 工具里用 `exec.agent` 天然满足 |

### PTC 模式的影响

**没有影响，反而更省事。**

- `presets/ptc.patch.yml` 与 `standard.patch.yml` 的插件行集合完全一致，差别只有 ptc 多了 `tool-executor-ptc`。
- `@deepseek-ai/dsh-tool-executor-ptc/src/index.ts:34-56`：SDK 的类型和工具清单是**从 `ctx.tools` 现场枚举生成的**（`ctx.systemPrompt.section({ name: 'tools:sdk', text: tools => renderSdk(tools) })`）。
- 所以新插件注册的工具**自动出现在 `run_code` 的 `tools.xxx` 里**，不用写任何 PTC 适配代码。

---

## 三种形态的取舍

### 方案 A（采用）：独立新工具，不碰官方工具

注册一个自己的工具 `subagent_route`，参数：`prompt`（必填）、`provider`（必填）、`model`（必填）、`reasoning_effort`（可选）、`name`（可选）、`cwd`（可选）。

execute 里：`llm` 校验路由 → `ctx.subagents.startActivation({ provider:'spawn', ..., agentOptions, delivery:'parent' })` → 返回 `{kind:'activation', name}`。

- 优点：零冲突，可随时卸载；老对话立即可用；官方工具行为完全不变。
- 缺点：模型要知道有这个工具（靠工具描述解决）；工具清单里多一项。

### 方案 B：包装官方 `subagent` 工具（不采用）

官方工具的 JSON Schema 是**按 config 生成的**，且注册时有重名保护（`dsh-tools/src/index.ts:69-70`）。要加字段只能替换整个工具定义，等于分叉官方实现，升级就断。

### 方案 C：运行时给老对话补 policy 事件（不采用）

技术上 `session.append('subagent/model-selection-policy', ...)` 存在，但：投影只认首条、要拿到 live Session 对象、append 要求会话已进入 publicationEntry（isolated session 直接抛），而且这等于篡改用户的对话历史。脆弱且不划算。

---

## 边界

- **这是绕开 DSH 设置页那份白名单的。** 插件一旦装上，`subagent-model-selection-settings` 里那个"允许的模型"列表就管不住它了。所以插件自带的白名单是重要刹车，只是默认留空。
- 换渠道的子代理**不能复用父对话的 KV cache**（前缀都不同），每次派任务都是全新计费。这跟 fork 与否无关，是换 provider 的物理成本。
- 子代理依然受 `maxDepth` 与 `maxActiveSubagents` 两条限制约束。
- 插件工具的 `when` 钩子可以让它只在某些对话暴露（`dsh-tools/src/contracts.ts:116`），但默认全开，否则"老对话能用"这个初衷就打折。

---

## 定案（2026-11-23）

- **目录 / 包名 / 工具名**：目录 `subagent-route/`、npm 包名 `dsh-subagent-route`、工具名 `subagent_route` 与 `list_routes`。
- **白名单**：默认全开，不设关卡。能派出去的必须是已注册 provider，都是用户自己配的渠道；白名单只作紧急刹车，平时留空。
- **`list_routes`**：要做。插件自己查 `llm.listProviders()` + `llm.listModels()`，不受 policy 限制。
- **fork 变体**：不做。换渠道后 KV cache 全废，全价重算，不划算。
- **设置页**：第一版就做。
