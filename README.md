# dsh-subagent-control

**English** · [简体中文](#简体中文)

Three tools that let any DSH agent — **including a team member** — list, steer and stop the subagents it started.

`list_subagents` · `send_subagent_message` · `interrupt_subagent`

---

## English

### The problem

The Harness ships `list_agents`, `send_message` and `interrupt_agent`. When the Agent Team bundle is active, it registers tools with **those same three names** in every team member's exact Agent scope, and the more specific registration wins. Inside a teammate scope the team versions take over: they resolve `target` against the team roster only, and interrupting is a Lead-only operation.

The result: a teammate can start a subagent with `subagent`, but cannot list it, follow up with it, or stop it — even though the subagent service (`ctx.subagents`) has supported all three for any live agent all along, and its authority rules already allow an ancestor to manage its own descendants.

This bundle does not fight over the taken names. It registers three **new** names, globally, so the Lead and every teammate get them at once.

### Tools

| Tool | Parameters | Underlying call |
| --- | --- | --- |
| `list_subagents` | `scope?`: `"children"` \| `"descendants"` (default `children`) | `ctx.subagents.listChildren()` / `listDescendants()` |
| `send_subagent_message` | `subagent_id`, `message` (both required) | `ctx.subagents.sendMessage()` |
| `interrupt_subagent` | `subagent_id` (required) | `ctx.subagents.interrupt()` with ancestor authority |

### Usage

```
list_subagents
→ 3b0f9c1e  running  "review the patch"  depth=1

list_subagents scope=descendants
→ 3b0f9c1e  running  "review the patch"  depth=1
  7d2a44b0  inactive "check the tests"    depth=2

send_subagent_message subagent_id=3b0f9c1e message="also look at locale/zh.json"
→ messageId=...

interrupt_subagent subagent_id=3b0f9c1e
→ accepted=true
```

Each listing line is `id  status  "label"  depth=`. `status` is `running` or `inactive` — **inactive means no turn is executing, not that the subagent is gone**. Use `send_subagent_message` to wake it.

Team members are continuable subagents too, so they also appear in this list, marked `team=teammate` (or `team=lead`). Pass `include_teammates: false` when you want only the plain subagents you started.

### Behaviour and limits

- **One-shot subagents are hidden.** They cannot accept a follow-up message, so listing them would only invite a call that is guaranteed to fail.
- **A broken record is reported, not thrown.** A child whose state cannot be read comes back as a diagnostic entry (`corrupt` / `unsupported` / `unavailable`) instead of turning the whole listing into an error.
- **`send_subagent_message` reaches direct children only.** That is the service's own rule; the plugin does not widen it.
- **`interrupt_subagent` reaches descendants**, so a team Lead can also stop a grandchild.
- **Every failure names its cause**: no calling agent, unknown id, or an id that is not yours.
- **No config, no storage.** The bundle writes nothing and reads nothing outside the three services.

### Install

Through the plugin panel / market, or by asking the agent:

```
plugin_manager install_bundle target "dsh-subagent-control@1.0.0"
```

From a checkout, pass the **directory path** instead of the npm spec. The bundle applies immediately — no restart needed. Afterwards the three tool names are visible and the plugin row is enabled.

### Compatibility

- DSH with the `tools`, `subagents` and `agents` services (0.2.x and later).
- Node `^22.19.0 || >=24.0.0`.
- **Zero dependencies** — no runtime dependency, no peer dependency, not a single `import`. The tools are plain tool-table objects with explicit JSON Schemas, so they install and behave identically from npm or from a linked checkout.

### Name collisions

`dsh-subagent-library` also registers a global `list_subagents` tool. Two global registrations of one name cannot both win: install one of them, or remember that the other may shadow this one.

The three new names were chosen precisely because they do **not** collide with the built-in `list_agents` / `send_message` / `interrupt_agent`.

### Uninstall

Remove or disable the bundle in the plugin panel. Nothing is left behind.

### Optional components (each off by default)

Four extra tools ship as **separate components**, each with its own row and switch in the plugin
panel (`Cross-layer relay`, `Wait for subagents`, `Release subagents`, `Delegation budget`).
All four start disabled; turning one on registers exactly one tool, so you can enable only what
you need.

| Component | Tool | What it does | Risk |
| --- | --- | --- | --- |
| Cross-layer relay | `relay_subagent_message` | Best-effort message to a deeper descendant: delivered to the first hop with a request to forward it down | intermediate agents may summarize; not guaranteed |
| Wait for subagents | `wait_subagents` | Wait for descendants (bounded by `timeout_seconds`) instead of ending your turn first | blocks up to the timeout |
| Release subagents | `drain_subagents` | Stop **and release** direct children, unlike `interrupt_subagent`, which only stops the current turn | a released child cannot be woken by a message |
| Delegation budget | `subagent_budget` | Read-only report: depth limit, how deep the tree goes, running/inactive counts | none |

A separate companion bundle, [`dsh-team-limits`](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/team-limits),
raises the Agent Team limits (members, tasks, message bytes). It is a separate install on
purpose: it overrides the shipped `agent-team` row, and that should never happen implicitly.

A second companion bundle, [`dsh-human-wait`](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/human-wait),
stops the PTC `run_code` deadline from counting the time you spend answering a question, reviewing
a plan or approving a request. PTC mode wraps the whole program — nested tool and approval waits
included — in one 120 s wall clock, so a slow answer used to surface as
`Error: code run failed (timeout): execution deadline reached (120000ms)`. With the bundle
installed that wait no longer burns the budget (default cap 24 h, `-1` = unlimited) while a plain
runaway program is still stopped at the normal budget.

A sibling UI plugin, [`dsh-find-session`](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/dsh-find-session),
adds conversation keyword search: `Ctrl+F` searches the conversation you are in, `Ctrl+Shift+F`
searches every stored session and lists the hits in the right sidebar. It installs separately — it
is a browser-side panel rather than part of the subagent tooling, and the Host half only reads
session logs.

### License

MIT — see [LICENSE](./LICENSE). Issues and source live at
[github.com/SpaceRelay/dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control).

---

## 简体中文

### 它解决什么问题

Harness 自带 `list_agents`、`send_message`、`interrupt_agent`。开启 Agent Team 后，团队插件会把**同名的三个工具**注册进每个团队成员的精确作用域，而更具体的作用域优先。于是在成员作用域里生效的是团队版：`target` 只认队友名，打断只有组长能做。

结果是：团队成员能用 `subagent` 派出子代理，却列不出、追问不了、也打断不了它。而底层的子代理服务（`ctx.subagents`）本来就支持这三件事，权限规则也允许祖先管理自己的后代。

本插件不去抢那三个被占用的名字，而是全局注册三个**新名字**，组长和每个组员立刻都能用。

### 工具

| 工具 | 参数 | 底层调用 |
| --- | --- | --- |
| `list_subagents` | `scope?`：`"children"` 或 `"descendants"`，默认 `children` | `ctx.subagents.listChildren()` / `listDescendants()` |
| `send_subagent_message` | `subagent_id`、`message`（均必填） | `ctx.subagents.sendMessage()` |
| `interrupt_subagent` | `subagent_id`（必填） | `ctx.subagents.interrupt()`（祖先权限） |

### 用法

```
list_subagents
→ 3b0f9c1e  running  "review the patch"  depth=1

list_subagents scope=descendants
→ 3b0f9c1e  running  "review the patch"  depth=1
  7d2a44b0  inactive "check the tests"    depth=2

send_subagent_message subagent_id=3b0f9c1e message="顺手看一下 locale/zh.json"
→ messageId=...

interrupt_subagent subagent_id=3b0f9c1e
→ accepted=true
```

每行格式是 `id  status  "label"  depth=`。`status` 为 `running` 或 `inactive`——**inactive 表示当前没有在跑，不代表子代理已经消失**；用 `send_subagent_message` 可以把它叫醒。

团队成员本身也是可续子代理，所以同样会出现在列表里，并带 `team=teammate`（或 `team=lead`）标记；只想看自己派的普通子代理时，传 `include_teammates: false`。

### 行为与边界

- **一次性子代理不会被列出。** 它们无法接收后续消息，列出来只会诱导一次注定失败的调用。
- **记录损坏时报告，而不是抛错。** 某个子代理状态读不出来，会作为诊断条目（`corrupt` / `unsupported` / `unavailable`）返回，而不是让整个列表失败。
- **`send_subagent_message` 只能发给直接子代理。** 这是服务本身的规则，插件没有放宽。
- **`interrupt_subagent` 覆盖所有后代**，所以组长也能打断孙代。
- **任何失败都说明原因**：没有调用者、id 不存在、或者不是你的子代理。
- **不写配置、不落存储。** 除了这三个服务，插件不读写任何东西。

### 安装

在插件面板 / 市场中安装，或者让智能体执行：

```
plugin_manager install_bundle target "dsh-subagent-control@1.0.0"
```

从本地目录安装时，把 npm 规格换成**目录路径**。安装即时生效，无需重启；装完后三个工具名可见、插件行为已启用。

### 兼容性

- 具备 `tools`、`subagents`、`agents` 三个服务的 DSH（0.2.x 及以上）。
- Node `^22.19.0 || >=24.0.0`。
- **零依赖**：没有运行时依赖、没有 peer 依赖，模块里一行 `import` 都没有。工具是带显式 JSON Schema 的普通定义对象，所以 npm 安装与软链安装行为完全一致。

### 撞名

`dsh-subagent-library` 也注册了全局的 `list_subagents`。同一个名字的两个全局注册不可能同时生效——二选一安装，或记住其中一个可能被另一个覆盖。

这三个新名字是特意挑的，**不会**和内置的 `list_agents` / `send_message` / `interrupt_agent` 冲突。

### 卸载

在插件面板里移除或停用即可，不会留下任何残留。

### 可选组件（各自默认关闭）

另外四个工具是**四个独立组件**，在插件面板里各有自己的一行和一个开关（中文界面显示：跨层补话 / 等待子代理 / 释放子代理 / 委派预算）。四个都默认关闭，打开哪一个就只注册那一个工具——只开你需要的。

| 组件 | 工具 | 作用 | 风险 |
| --- | --- | --- | --- |
| 跨层补话 | `relay_subagent_message` | 把消息投给第一跳并请它继续向下转发 | 中间层可能改写，**不保证送达** |
| 等待子代理 | `wait_subagents` | 等后代结束再收工（受 `timeout_seconds` 限制） | 会阻塞到超时 |
| 释放子代理 | `drain_subagents` | 停止**并释放**直接子级；`interrupt_subagent` 只停当前回合 | 被释放的子级不能再靠消息唤醒 |
| 委派预算 | `subagent_budget` | 只读报告：深度上限、树有多深、运行/空闲数量 | 无 |

另有一个独立的同伴包 [`dsh-team-limits`](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/team-limits)，用来提高 Agent Team 的成员数、任务数与消息字节上限。**它刻意做成单独安装**：它覆盖的是宿主自带的 `agent-team` 行，这种事不该偷偷发生。

还有一个独立的同伴包 [`dsh-human-wait`](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/human-wait)，用来让 PTC 模式 `run_code` 的执行预算在「等你回答提问 / 审议计划 / 审批」期间暂停。PTC 会把整个程序——**包括嵌套的工具调用与审批等待**——包在一个 120 秒墙钟里，所以回答慢一点就会看到 `Error: code run failed (timeout): execution deadline reached (120000ms)`；装上之后这段等待不再计入预算（默认上限 24 小时，`-1` 表示不限），而普通的死循环程序仍会在原预算处被终止。**同样刻意做成单独安装**：它拦截的是宿主 `ptc-runtime` 的执行预算。

另有一个独立的界面插件 [`dsh-find-session`](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/dsh-find-session)，给会话加上关键词查找：`Ctrl+F` 搜当前这个会话，`Ctrl+Shift+F` 搜全部已存会话、命中列在右侧栏。它同样是单独安装——它是浏览器侧的查找面板，不属于子代理工具；宿主半边只读会话日志，不写任何东西。

### 许可

MIT，见 [LICENSE](./LICENSE)。源码与问题反馈：
[github.com/SpaceRelay/dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control)。
