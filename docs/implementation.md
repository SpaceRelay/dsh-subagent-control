# dsh-subagent-control 实现说明

面向维护者。用户向说明见 [../README.md](../README.md)。

## 为什么需要这三个工具

Harness 自带 `list_agents`、`send_message`、`interrupt_agent`。开启 Agent Team 后，团队插件会把**同名的三个工具**注册进每个团队成员的精确 Agent 作用域，而更具体的作用域优先。于是在成员作用域里生效的是团队版：`target` 只认队友名，打断只有组长能做。

结果是：团队成员能用 `subagent` 派出子代理，却列不出、追问不了、也打断不了它。而底层的子代理服务（`ctx.subagents`）本来就支持这三件事，权限规则也允许祖先管理自己的后代。

本包不抢名字，而是全局注册三个**新**名字，组长和每个成员同时拿到。

## 工具与底层调用

| 工具 | 参数 | 底层调用 |
| --- | --- | --- |
| `list_subagents` | `scope?`：`children` \| `descendants`（默认 `children`）；`include_teammates?`（默认 `true`） | `ctx.subagents.listChildren()` / `listDescendants()` |
| `send_subagent_message` | `subagent_id`、`message`（必填） | `ctx.subagents.sendMessage()` |
| `interrupt_subagent` | `subagent_id`（必填） | `ctx.subagents.interrupt()`，带祖先权限 |

输出行格式 `id  状态  "标签"  depth=`；状态来自 `ctx.agents.get(id)?.status === 'running'`。

## 行为与边界

- **一次性子代理被隐藏。** 它们无法接受后续消息，列出来只会引诱一次必然失败的调用。
- **坏记录报告而不抛出。** 状态读不出来的子代理以诊断条目返回（`corrupt` / `unsupported` / `unavailable`），不会让整个列表失败。
- **`send_subagent_message` 只到直接子级。** 这是服务本身的规则，插件不越过它。
- **`interrupt_subagent` 能到后代**，所以团队组长也能叫停孙代。
- **每个失败都写明原因**：没有调用者、未知 id、或者不是你的子代理。
- **无配置、无存储。** 只读这三个服务，不写任何东西。

## 兼容性

- 需要带 `tools`、`subagents`、`agents` 服务的 DSH（0.2.x 及以上）。
- Node `^22.19.0 || >=24.0.0`。
- **零依赖**——没有运行时依赖、没有 peer 依赖、一行 `import` 都没有。工具是带显式 JSON Schema 的普通工具表对象，所以从 npm 装和从软链装表现一致。

## 同名冲突

`dsh-subagent-library` 也注册全局 `list_subagents`。两个全局同名注册不能同时生效：装其中一个，并记住另一个可能盖住它。

这三个新名字是特意选的，**不**与内置的 `list_agents` / `send_message` / `interrupt_agent` 撞名。

## 开发者安装

通过插件面板 / 市场，或者让智能体执行 `plugin_manager install_bundle`。

从检出目录装时传**目录路径**而不是 npm spec。宿主侧插件装完立即生效，不需要重启；三个工具立刻可见，插件行处于启用状态。

## 四个可选组件

四个额外工具作为**独立组件**发布，各自在插件面板里有单独一行和开关（跨层补话 / 等待子代理 / 释放子代理 / 委派预算）。四个默认都关闭；打开一个只注册一个工具。

| 组件 | 工具 | 做什么 | 风险 |
| --- | --- | --- | --- |
| 跨层补话 | `relay_subagent_message` | 给更深的后代发消息：投递给第一跳并请求它继续往下转发 | 中间层可能概括内容；不保证送达 |
| 等待子代理 | `wait_subagents` | 等后代跑完（受 `timeout_seconds` 限制）而不是先结束回合 | 最多阻塞到超时 |
| 释放子代理 | `drain_subagents` | 停止**并释放**直接子代，不同于 `interrupt_subagent` 只停当前回合 | 被释放的子代不会因消息再被唤醒 |
| 委派预算 | `subagent_budget` | 只读报告：深度上限、树有多深、运行/已停数量 | 无 |

## 测试

```powershell
npm test    # node test/smoke.mjs && node test/smoke-extras.mjs
```

覆盖：注册表形状、投影与渲染、三个服务调用的参数、无调用者时报错，以及四个组件各自单独挂载时只注册一个工具。
