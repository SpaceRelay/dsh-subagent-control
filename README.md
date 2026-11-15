# dsh-subagent-control

**让任意智能体——包括团队成员——能列出、追问、中止自己派出的子代理。**

`list_subagents` · `send_subagent_message` · `interrupt_subagent`

> [English](README.en.md) | 中文

## 什么时候用得上

- 派了几个子代理分头干活，想知道还有谁在跑、跑到哪一步
- 想给某个正在跑的子代理补一句话
- 想叫停跑偏的那个，把回合收回来
- 团队里，组长派出去的孙代子代理也要从上往下管得住

## 三个工具

| 工具 | 做什么 | 参数 |
| --- | --- | --- |
| `list_subagents` | 列出自己派出的子代理 | `scope`：`children`（默认，直接子代理）/ `descendants`（整棵子树）；`include_teammates`：默认 `true` |
| `send_subagent_message` | 给一个直接子代理补一句话 | `subagent_id`、`message` |
| `interrupt_subagent` | 叫停某个子代理当前这一轮 | `subagent_id` |

长这样：

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

每行是 `id  状态  "标签"  depth=`。`running` 表示正在跑；`inactive` 只表示当前没有回合在执行——**不是子代理没了**，发条消息就能唤醒。

团队里的队友本身也是可续子代理，所以也会出现在列表里，标着 `team=teammate`。只想要自己派的普通子代理，传 `include_teammates: false`。

## 安装

1. 打开 设置 → 插件 → 市场，搜索 `dsh-subagent-control`
2. 点安装
3. **不用重启**——这是纯宿主侧插件，装完三个工具立刻可用

带界面页的插件才需要完全退出 DSH 再打开，这个不是。

## 可选功能（四个，默认关闭）

| 面板里显示的名字 | 工具 | 作用 |
| --- | --- | --- |
| 跨层补话 | `relay_subagent_message` | 给够不着的深层后代发消息：投给第一跳并请它继续往下转 |
| 等待子代理 | `wait_subagents` | 在当前回合等子代理跑完，而不是先结束回合 |
| 释放子代理 | `drain_subagents` | 停掉并释放直接子代理，真正把实例腾出来 |
| 委派预算 | `subagent_budget` | 只读报告：深度上限、各层人数、运行 / 已停数量 |

在 设置 → 插件 → 已安装 → `dsh-subagent-control` 下面逐个打开，打开一个只注册一个工具。

## 相关插件

- [dsh-team-limits](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/team-limits) —— 把 Agent Team 的人数、任务数、消息大小改成插件页里能填的数字
- [dsh-human-wait](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/human-wait) —— PTC 模式下等你回答问题时不烧掉执行预算
- [dsh-find-session](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/dsh-find-session) —— 会话内 / 跨会话关键词查找

三个都是单独安装的：它们改的是宿主自带的行或别的插件的行为，不该跟着这个包一起悄悄生效。

## 常见问题

**装完怎么确认能用？** 让智能体调一次 `list_subagents`。这些工具是给智能体用的，界面上不会多出按钮。

**为什么只列出一两个？** 默认只列直接子代理。要看整棵树，`scope=descendants`。

**inactive 的还能用吗？** 能。它只是当前没有回合在跑，发消息会唤醒。

**和 `dsh-subagent-library` 冲突吗？** 两者都注册 `list_subagents`，同时装只有一个生效，选一个。

## 隐私与开销

- 只读子代理注册表，不写文件、不联网、没有配置项
- 零依赖，不引入任何运行时包

## 卸载

在插件面板里停用或卸载，不会留下任何残留。

## 技术细节

实现、与内置工具的边界、四个组件的细节、测试：[docs/implementation.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/docs/implementation.md)

## 许可

MIT，见 [LICENSE](./LICENSE)。源码与问题反馈：[github.com/SpaceRelay/dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control)。
