# dsh-subagent-control

Three tools that let any DSH agent — **including a team member** — list, steer and stop the subagents it started.

`list_subagents` · `send_subagent_message` · `interrupt_subagent`

---

## English

### The problem

The Harness ships `list_agents`, `send_message` and `interrupt_agent`. When the Agent Team bundle is active it registers tools with **those same three names** in every team member's exact Agent scope, and the more specific registration wins. Inside a teammate scope the team versions take over: they resolve `target` against the team roster only, and interrupting is a Lead-only operation.

The result: a teammate can start a subagent with `subagent`, but cannot list it, follow up with it, or stop it — even though `ctx.subagents` (the subagent service) has supported all three for any live agent all along, and the authority rules already allow an ancestor to manage its own descendants.

This bundle does not fight over the taken names. It registers three **new** names, globally, so the Lead and every teammate get them at once. Authority is still enforced by the service: a caller can message its own direct children and interrupt its own descendants.

### Tools

| Tool | Parameters | Calls |
| --- | --- | --- |
| `list_subagents` | `scope?`: `"children"` \| `"descendants"` (default `children`) | `ctx.subagents.listChildren()` / `listDescendants()` |
| `send_subagent_message` | `subagent_id`, `message` (both required) | `ctx.subagents.sendMessage()` |
| `interrupt_subagent` | `subagent_id` (required) | `ctx.subagents.interrupt()` with ancestor authority |

`list_subagents` returns one line per subagent: `id  status  "label"  depth=`. `status` is `running` or `inactive` — `inactive` means no turn is executing, not that the subagent is gone.

### Behaviour and limits

- One-shot subagents are not listed. They cannot accept a follow-up message, so showing them would only invite a call that is guaranteed to fail.
- A child whose record cannot be read comes back as a diagnostic entry (`corrupt` / `unsupported` / `unavailable`) instead of turning the whole listing into an error.
- `send_subagent_message` reaches a direct child only. This is the service's rule, not an extra restriction here.
- `interrupt_subagent` reaches the caller's descendants, so a team Lead can also stop a grandchild.
- Every failure is a normal error result that names the cause: no calling agent, unknown id, or an id that is not yours.

### Install

Through the plugin manager / market, or by asking the agent:

```
plugin_manager install_bundle target "dsh-subagent-control@1.0.0"
```

From a checkout, pass the directory path instead of the npm spec. The bundle applies immediately — no restart. Verify the three tool names appear and the plugin row is enabled.

### Compatibility

- DSH with the `tools`, `subagents` and `agents` services (0.2.x and later).
- Node `^22.19.0 || >=24.0.0`.
- No runtime dependencies, no peer dependencies: the module imports nothing. A plain tool table with explicit JSON Schemas installs the same way from npm or from a linked checkout.

### Known name conflict

`dsh-subagent-library` also registers a global `list_subagents` tool. Two global registrations of one name cannot both win — install one of them, or remember that the other may shadow this one.

### Uninstall

Remove or disable the bundle in the plugin panel. Nothing else is written: no config, no storage.

### License

MIT — see [LICENSE](./LICENSE).

---

## 中文

### 它解决什么问题

Harness 自带 `list_agents`、`send_message`、`interrupt_agent`。开启 Agent Team 后，团队插件会把**同名的三个工具**注册进每个团队成员的精确作用域，而更具体的作用域优先。于是在成员作用域里生效的是团队版：`target` 只认队友名，打断只有组长能做。

结果是：团队成员能用 `subagent` 派出子代理，却列不出、追问不了、也打断不了它。而底层的 `ctx.subagents` 服务本来就支持这三件事，权限规则也允许祖先管理自己的后代。

本插件不去抢那三个被占用的名字，而是全局注册三个**新名字**，组员立刻可用。权限仍由服务裁决：调用者可以给自己直接派出的子代理发消息，也可以打断自己名下的所有后代。

### 工具

| 工具 | 参数 | 调用 |
| --- | --- | --- |
| `list_subagents` | `scope?`：`"children"` 或 `"descendants"`，默认 `children` | `ctx.subagents.listChildren()` / `listDescendants()` |
| `send_subagent_message` | `subagent_id`、`message`（必填） | `ctx.subagents.sendMessage()` |
| `interrupt_subagent` | `subagent_id`（必填） | `ctx.subagents.interrupt()`（祖先权限） |

`list_subagents` 每个子代理一行：`id  status  "label"  depth=`。`status` 为 `running` 或 `inactive`；`inactive` 表示当前没有在跑，不代表子代理已经消失。

### 行为与边界

- 一次性子代理不会被列出：它们无法接收后续消息，列出来只会诱导一次注定失败的调用。
- 某个子代理记录读不出来时，会作为诊断条目（`corrupt` / `unsupported` / `unavailable`）返回，而不是让整个列表报错。
- `send_subagent_message` 只能发给直接子代理，这是服务本身的规则，插件没有额外收紧。
- `interrupt_subagent` 覆盖调用者的所有后代，所以组长也能打断孙代。
- 任何失败都是普通的错误结果，并说明原因：没有调用者、id 不存在、或者不是你的子代理。

### 安装

在插件面板/市场中安装，或者让智能体执行：

```
plugin_manager install_bundle target "dsh-subagent-control@1.0.0"
```

从本地目录安装时，把 npm 规格换成目录路径。安装即时生效，无需重启；装完确认三个工具名可见、插件行为已启用。

### 兼容性

- 具备 `tools`、`subagents`、`agents` 三个服务的 DSH（0.2.x 及以上）。
- Node `^22.19.0 || >=24.0.0`。
- 无运行时依赖、无 peer 依赖：模块不 import 任何东西，工具是带显式 JSON Schema 的普通定义对象，npm 安装与软链安装行为一致。

### 已知撞名

`dsh-subagent-library` 也注册了全局的 `list_subagents`。同一个名字的两个全局注册不可能同时生效——二选一安装，或记住其中一个可能被另一个覆盖。

### 卸载

在插件面板里移除或停用即可。插件不写任何配置和存储。

### 许可

MIT，见 [LICENSE](./LICENSE)。
