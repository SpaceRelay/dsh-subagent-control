# dsh-subagent-control

派出去的子代理，你自己管得住。

一口气派三个子代理分头改代码，过一会儿就只记得"好像派了三个"：谁还在跑？跑到哪一步了？想给其中一个补句话，手上却没有这个工具；有个跑偏了想叫停，只能干等它自己结束。

看、说、停这三个动作，DSH 本来就有，只是在团队里，这几个位置被 Agent Team 的同名工具占了，团队成员反而使不上。这个插件换三个新名字，全局注册，谁都能用，包括团队里的成员管自己派出去的。

装上之后，智能体看到的是这样：

```
list_subagents

3b0f9c1e  running   "review the patch"  depth=1
7d2a44b0  inactive  "check the tests"   depth=2
```

`running` 是正在跑，`inactive` 是这一刻没有回话在跑，不是子代理没了，发条消息就会醒。

默认只列直接子代理，加 `scope=descendants` 能看整棵子树。团队队友也是可续子代理，所以也会出现在里面，标着 `team=teammate`；只想要普通子代理，传 `include_teammates: false`。

三个工具的参数都很短：

| 工具 | 干什么 | 参数 |
| --- | --- | --- |
| `list_subagents` | 列出自己派出的子代理 | `scope`：`children`（默认）或 `descendants`；`include_teammates` 默认 `true` |
| `send_subagent_message` | 给直接子代理补一句话 | `subagent_id`、`message` |
| `interrupt_subagent` | 叫停某个子代理当前这一轮 | `subagent_id` |

安装不用重启：设置 → 插件 → 市场，搜 `dsh-subagent-control`，装上三个工具就能用。这个包没有界面，需要完全退出再开的是那些带设置页的插件。

另外还有四个可选项，默认全关。在 设置 → 插件 → 已安装 → dsh-subagent-control 下面逐个打开，打开一个只注册一个工具：

| 面板上的名字 | 工具 | 干什么 |
| --- | --- | --- |
| 跨层补话 | `relay_subagent_message` | 给够不着的深层后代发消息，投给第一跳并请它继续往下转 |
| 等待子代理 | `wait_subagents` | 在当前回合等子代理跑完，而不是先把回合结束掉 |
| 释放子代理 | `drain_subagents` | 停掉并释放直接子代理，把实例真正腾出来 |
| 委派预算 | `subagent_budget` | 只读报告：深度上限、各层人数、运行中和已停的数量 |

顺着这条线还有三个插件，都单独安装：`dsh-team-limits` 改的是宿主自带的团队限额，`dsh-human-wait` 改的是 PTC 的执行计时，`dsh-find-session` 是一个界面插件。它们改的都是别人家的东西，不该跟着这个包一起悄悄生效。

装完怎么确认能用？让智能体调一次 `list_subagents`。这些工具是给智能体用的，界面上不会多出按钮。

只列出一两个？默认只列直接子代理，要看整棵树就加 `scope=descendants`。

`inactive` 的还能用吗？能。它只是这一刻没有回合在跑，发消息会唤醒。

和 `dsh-subagent-library` 撞不撞？撞。两边都注册 `list_subagents`，同时装只有一个生效，选一个。

它只读子代理列表，不写文件、不联网，也没有配置项；零依赖。

不用了就在插件面板里停用或卸载，不会留下什么。

实现细节、和内置工具的边界、四个组件的内部逻辑，都在 [docs/implementation.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/docs/implementation.md)。

MIT，见 [LICENSE](./LICENSE)。源码和问题反馈在 [github.com/SpaceRelay/dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control)。
