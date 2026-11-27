# dsh-subagent-control

**让任意智能体都能列出、追问、中止自己派出的子代理。**

`list_subagents` · `send_subagent_message` · `interrupt_subagent`

> [English](README.en.md) | 中文

这个仓库一共五个包，都要各自安装。你现在看的是第一个：给智能体用的子代理管理工具。另外四个在下面的「相关插件」里。

DSH 里，智能体可以把一部分活交给另一个智能体去做，被派出去的那个叫「子代理」。这个插件让派活的那一方能看见它们、给它们补话、把它们叫停。

## 什么时候用得上

- 派了几个子代理分头干活，想知道还有谁在跑、跑到哪一步
- 想给某个正在干活的子代理补一句话
- 想叫停跑偏的那个，让它停下来
- 子代理自己又派了一层，上面也要管得住

## 三个工具

| 工具 | 做什么 | 参数 |
| --- | --- | --- |
| `list_subagents` | 列出自己派出的子代理 | `scope`：`children`（默认，直接子代理）/ `descendants`（整棵子树） |
| `send_subagent_message` | 给一个子代理补一句话 | `subagent_id`、`message` |
| `interrupt_subagent` | 叫停某个子代理当前这一轮 | `subagent_id` |

装好之后，智能体调一次 `list_subagents`，拿到的是每个子代理一行：

```
3b0f9c1e  running   "review the patch"  depth=1
7d2a44b0  inactive  "check the tests"   depth=2
```

从左往右是：id、当前状态、引号里它正在做的任务、深度。`depth=1` 是你直接派出去的，`depth=2` 是它再派出去的。`running` 表示正在跑；`inactive` 只表示这一刻没有回合在执行，不是子代理没了，发条消息就能唤醒。

补话和打断更简单：`send_subagent_message` 给一个 id 和一句话，`interrupt_subagent` 只给一个 id，分别返回一条消息 id 和这次请求是否被接受。

## 安装

1. 打开 设置 → 插件 → 市场，搜索 `dsh-subagent-control`
2. 点安装
3. **不用重启**——这是纯宿主侧插件，装完三个工具立刻可用

带界面页的插件才需要完全退出 DSH 再打开，这个不是。

## 可选功能（两个，默认关闭）

| 面板里显示的名字 | 工具 | 作用 |
| --- | --- | --- |
| 等待子代理 | `wait_subagents` | 在当前回合等整棵子树跑完，而不是先结束回合 |
| 委派预算 | `subagent_budget` | 只读报告：深度上限、每层的人数、在跑和已停的数量 |

在 设置 → 插件 → 已安装 → `dsh-subagent-control` 下面逐个打开，打开一个只注册一个工具。

## 相关插件

- [dsh-team-limits](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/team-limits) —— 调 Agent Team 的任务数上限，以及新会话是否默认开启团队协作
- [dsh-human-wait](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/human-wait) —— 等你的回答、审阅计划或批准请求时，不让 120 秒的运行限时把它判成超时
- [dsh-find-session](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/dsh-find-session) —— 会话内 / 跨会话关键词查找
- [dsh-subagent-route](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/subagent-route) —— 在任何一个对话里，把子代理派到别的渠道或别的模型上

它们各有各的用途，所以是四个独立的包，要单独安装，不会跟着本包装上。

## 常见问题

**装完怎么确认能用？** 让智能体调一次 `list_subagents`。这些工具是给智能体用的，界面上不会多出按钮。

**为什么只列出一两个？** 默认只列直接子代理。要看整棵树，`scope=descendants`。

**inactive 的还能用吗？** 能。它只是这一刻没在干活，发条消息就醒。

**和 `dsh-subagent-library` 冲突吗？** 两者都注册 `list_subagents`，同时装只有一个生效，选一个。

## 隐私与开销

- 只读子代理列表，不写文件、不联网、没有配置项
- 零依赖，不引入任何运行时包

## 卸载

在插件面板里停用或卸载，不会留下任何残留。

## 技术细节

实现、与内置工具的边界、两个组件的细节、测试：[docs/implementation.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/docs/implementation.md)

## 许可

MIT，见 [LICENSE](./LICENSE)。源码与问题反馈：[github.com/SpaceRelay/dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control)。
