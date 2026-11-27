# dsh-subagent-control 实现说明

面向维护者。用户向说明见 [../README.md](../README.md)。

## 为什么还需要这三个工具

Harness 自带 `list_agents`、`send_message`、`interrupt_agent`，这三件优先用它们。它们留下的空档是：`list_agents` 从树根列整棵树，不提供「只看我自己派的」这个筛子；`send_message` 按名字发给同树的任何智能体；`interrupt_agent` 在出厂配置里是关着的。

DSH 0.2.2 起，Agent Team 不再往成员作用域里注册同名工具，成员关系就是普通的子代理血缘，没有 team 标记可解析。本包因此只补这三个空档，不再处理团队角色。

## 工具与底层调用

| 工具 | 参数 | 底层调用 |
| --- | --- | --- |
| `list_subagents` | `scope?`：`children` \| `descendants`（默认 `children`） | `ctx.subagents.listDescendants()`，默认取 `depth === 1` |
| `send_subagent_message` | `subagent_id`、`message`（必填） | `ctx.subagents.sendMessage()` |
| `interrupt_subagent` | `subagent_id`（必填） | `ctx.subagents.interrupt()`，带祖先权限 |

输出行格式 `id  状态  "标签"  depth=`；状态来自 `ctx.agents.get(id)?.status === 'running'`。

## 行为与边界

- **一次性子代理被隐藏。** 它们无法接受后续消息，列出来只会引诱一次必然失败的调用。
- **坏记录报告而不抛出。** 状态读不出来的子代理以诊断条目返回（`corrupt` / `unsupported` / `unavailable`），不会让整个列表失败。
- **`send_subagent_message` 能发到同树的任何智能体。** 这是 0.2.2 起服务本身的规则，插件不越过它；内置的 `send_message` 做的是同一件事，只是按名字寻址。
- **`interrupt_subagent` 能到后代**，所以上级也能叫停孙代。
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

## 两个可选组件

两个额外工具作为**独立组件**发布，各自在插件面板里有单独一行和开关（等待子代理 / 委派预算）。两个默认都关闭；打开一个只注册一个工具。

| 组件 | 工具 | 做什么 | 风险 |
| --- | --- | --- | --- |
| 等待子代理 | `wait_subagents` | 等整棵子树跑完（受 `timeout_seconds` 限制）而不是先结束回合 | 最多阻塞到超时 |
| 委派预算 | `subagent_budget` | 只读报告：深度上限、树有多深、运行/已停数量 | 无 |

## 测试

```powershell
npm test    # node test/smoke.mjs && node test/smoke-extras.mjs
```

覆盖：注册表形状、投影与渲染、三个服务调用的参数、无调用者时报错，以及两个组件各自单独挂载时只注册一个工具。
