# dsh-human-wait

你回答问题的时候，PTC 的计时先停一下。

PTC（也就是 `run_code`）会把整个程序包在一条 120 秒的预算里，中途弹给你的问题、计划审批、权限批准，都算在这条预算里。你多想了三分钟，回来就看到：

```
Error: code run failed (timeout): execution deadline reached (120000ms)
```

问题卡还标着「已中断」。这个插件做的事只有一件：等你的那段时间不计费。程序自己跑飞了，到点照样被掐断。

装上以后，四种情况是这样：

- 程序里提问，你 20 秒就答完：和以前一样。
- 同一个程序，你 4 分钟后才答：以前 120 秒就被中止了，现在会一直等，答案照常送达。
- 你一直不答：等到你设的上限（默认 24 小时）才中止，不会无限挂着。
- 程序自己死循环不管你在干嘛：120 秒中止，和以前一样。

装的时候需要完全退出 DSH 再打开，这个插件有设置页。

设置 → 插件 → 已安装 → 人机等待，里面是一个「最长等待」输入框（默认 24 小时，选「无限」就是不设上限），旁边有 1 小时 / 24 小时 / 无限 三个快捷按钮。字段一旦和出厂值不一样，会出现「恢复默认」；卡片上还有一行摘要。改完约 1.5 秒生效，不用重启。

还是超时了？先确认三件事：会话头部有 PTC 标记；插件没有被 profile 补丁里的 `enabled: false` 关掉；日志里有 `[dsh-human-wait]` 开头的那一行。如果插件那一次没看到你在等，它就不会暂停计时。

错误类型变成 `abort` 了？正常。插件是用自己的信号中止的，所以 kind 从 `timeout` 变成 `abort`，提示文字里照样有 `execution deadline reached`。

普通会话会受影响吗？不会。普通会话本来就会一直等你回答，没有这条超时。

它只在内存里包住三个宿主服务的调用，不写文件、不联网，也不动会话内容。卸载并重启后，宿主原来的方法就回来了。

实现原理、两个配置项、失败时的降级行为与验收记录，在 [docs/implementation.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/human-wait/docs/implementation.md)。

MIT，见 [LICENSE](./LICENSE)。问题反馈：[github.com/SpaceRelay/dsh-subagent-control/issues](https://github.com/SpaceRelay/dsh-subagent-control/issues)。
