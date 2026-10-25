# dsh-team-limits

**English** · [简体中文](#简体中文)

Optional companion bundle for [dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control): it adds editable **Team limits** fields to the plugin's own page (Settings → Plugins → Installed → Team limits), so the Agent Team limits are number fields you can change and reset — instead of values frozen in a patch file.

## English

### What it does

DeepSeek Harness ships the Agent Team plugin with these limits:

| Setting | Shipped default | This page starts at |
| --- | --- | --- |
| `maxMembers` | 16 | **32** |
| `maxTasks` | 256 | **512** |
| `maxMessageBytes` | 65536 | **131072** |
| `disposalTimeoutMs` | 5000 | 5000 |

The page has four number fields. Edits are written onto the shipped `agent-team` row through the host's config editor as you type (debounced, no Save button), and each field offers **Restore default** once it differs from the shipped value. The config editor persists the values in the profile patch layer and applies them on the normal Loader path. The bundle's own patch therefore holds no numbers, so a DSH upgrade that changes the shipped defaults does not silently resurrect old values.

### Before you install

- **Restart DSH after installing**, then open Settings → Plugins → Installed → Team limits; the fields sit right below the bundle description.
- **Values live in the profile patch layer.** Uninstalling the bundle does not roll them back; set the fields back to the shipped defaults (or remove the `agent-team` override in the profile patch) if you want the stock numbers again.
- **Raising limits is not free.** More members means more concurrent model sessions; each one costs tokens and a session directory. Raise only what you need.
- The client page needs the harness browser bundle; nothing is rendered in terminal-only profiles, but the limits still apply.

### Install

Through the plugin panel / market, or by asking the agent:

```
plugin_manager install_bundle target "dsh-team-limits@1.3.2"
```

### License

MIT — see [LICENSE](./LICENSE). Issues: <https://github.com/SpaceRelay/dsh-subagent-control/issues>

---

## 简体中文

这是 [dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control) 的可选同伴包：在**插件自己的页面**上（设置 → 插件 → 已安装 → 团队限额）加一组可编辑的「团队限额」字段，把 Agent Team 的上限变成能直接填、能恢复默认的数字输入框，而不是写死在补丁文件里的值。

### 它做什么

Agent Team 出厂限制如下：

| 配置 | 出厂默认 | 本页面初始值 |
| --- | --- | --- |
| `maxMembers` | 16 | **32** |
| `maxTasks` | 256 | **512** |
| `maxMessageBytes` | 65536 | **131072** |
| `disposalTimeoutMs` | 5000 | 5000 |

页面有四个数字输入框。改动边输边写（防抖，没有保存按钮），每个字段一旦偏离出厂值就会出现**恢复默认**。宿主侧的配置编辑器会把这些值写到自带的 `agent-team` 行上，持久化进 profile 的补丁层，并按正常加载流程生效。因此本包自己的补丁里不再存数值：DSH 升级改变了出厂默认，也不会悄悄把旧数字带回来。

### 安装前要知道

- **安装后重启 DSH**，然后打开 设置 → 插件 → 已安装 → 团队限额；输入框就在插件描述下面。
- **数值存在 profile 的补丁层里。** 卸载本包不会把它们撤回；要恢复出厂值，请在页面上点「恢复默认」，或删除 profile 补丁里 `agent-team` 那条覆盖。
- **提高上限不是免费的。** 队友更多意味着更多并发的模型会话，每个都消耗 token 与一个会话目录；按实际需要调。
- 这个页面依赖 Harness 的浏览器端；纯终端 profile 不渲染页面，但限额照样生效。

### 安装

在插件面板 / 市场中安装，或者让智能体执行：

```
plugin_manager install_bundle target "dsh-team-limits@1.3.2"
```

### 许可

MIT，见 [LICENSE](./LICENSE)。问题反馈：<https://github.com/SpaceRelay/dsh-subagent-control/issues>
