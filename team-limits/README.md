# dsh-team-limits

**English** · [简体中文](#简体中文)

Optional companion bundle for [dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control): raises the Agent Team limits that ship with DeepSeek Harness.

## English

The Agent Team plugin ships with these limits:

| Setting | Shipped default | This bundle |
| --- | --- | --- |
| `maxMembers` | 16 | **32** |
| `maxTasks` | 256 | **512** |
| `maxMessageBytes` | 65536 | **131072** |
| `disposalTimeoutMs` | 5000 | 5000 (unchanged) |

This is not a plugin with tools. It is a bundle whose patch targets the existing `agent-team` row and replaces its `config`. Nothing changes until you install it, which is the point: raising somebody else's limits is a deliberate choice, not a default.

The bundle also mounts one tiny component row (`Team Limits`) that registers nothing. It exists so the plugin panel can show the bundle and its localized description next to its switch, instead of listing it without a component.

### Before you install

- **A patch replaces `config` wholesale, never deep-merges.** The four fields above are restated in this bundle for that reason; if the host adds a fifth field, this bundle will not supply it and that field falls back to its default.
- **Restart DSH after installing.** The row is read at startup.
- **Raising limits is not free.** More members means more concurrent model sessions; each one costs tokens and a session directory. Raise only what you actually need.
- **Uninstall restores the shipped defaults**; nothing is written anywhere else.

### Install

Through the plugin panel / market, or by asking the agent:

```
plugin_manager install_bundle target "dsh-team-limits@1.0.1"
```

### License

MIT — see [LICENSE](./LICENSE). Issues: <https://github.com/SpaceRelay/dsh-subagent-control/issues>

---

## 简体中文

这是 [dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control) 的可选同伴包，用来提高 DeepSeek Harness 自带 Agent Team 的上限。

Agent Team 插件出厂限制如下：

| 配置 | 出厂默认 | 本包 |
| --- | --- | --- |
| `maxMembers` | 16 | **32** |
| `maxTasks` | 256 | **512** |
| `maxMessageBytes` | 65536 | **131072** |
| `disposalTimeoutMs` | 5000 | 5000（不变） |

它不是一个带工具的插件，而是一个**只做覆盖的 bundle**：补丁指向现有的 `agent-team` 行，整体替换它的 `config`。不安装就完全不生效——把别人的上限改高应该是主动选择，不是默认行为。

它另外会挂一个**只占位的小组件行**（团队限额），不注册任何东西；作用是让插件面板能把这一行、它的中文标题与说明和开关一起显示出来，而不是只显示一个没有组件的包。

### 安装前要知道

- **补丁是整体替换 `config`，不是深合并。** 上面四个字段因此必须写全；如果宿主以后新增第五个字段，本包不会提供它，那个字段会回到默认值。
- **安装后需要重启 DSH**，这一行在启动时读取。
- **提高上限不是免费的。** 队友更多意味着更多并发的模型会话，每个都消耗 token 与一个会话目录；按实际需要调，不要一次拉满。
- **卸载即恢复出厂默认**，不写任何其它位置。

### 安装

在插件面板 / 市场中安装，或者让智能体执行：

```
plugin_manager install_bundle target "dsh-team-limits@1.0.1"
```

### 许可

MIT，见 [LICENSE](./LICENSE)。问题反馈：<https://github.com/SpaceRelay/dsh-subagent-control/issues>
