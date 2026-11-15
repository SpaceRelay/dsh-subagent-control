# dsh-human-wait 实现说明

面向维护者。用户向说明见 [../README.md](../README.md)。

## 问题

PTC 模式下，`dsh-ptc-runtime-node` 用一条墙钟预算覆盖整个 `run_code` 程序，嵌套的工具调用与审批等待都算在里面：

```js
const wallTimer = spec.timeoutMs === null ? void 0 : setTimeout(() => {
  timedOut = true
  controller.abort("execution deadline reached")
}, spec.timeoutMs)
```

于是「等你回答问题」也烧预算。本项目把这个计时器接管过来，只在没有人类交互等待时计费。

## 做法

1. 包装 `ptcRuntime.run`：把 deadline 移进插件，由插件自己计时并可暂停。
2. 包装三个人类等待点：`userQuestions.ask`、`userQuestions.askTimed`、`approval.request`。只有这三类调用会产生「等待人」的时间。
3. 用 `node:async_hooks` 的 `AsyncLocalStorage` 把计费限定在真正在等待的那次运行上，只在没有等待挂起时扣预算。

单个 `run_code` 调用仍可自带 `timeoutMs`，它继续作为执行预算生效。

## 配置

行内默认值够用；要改就在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: human-wait
  name: 'dsh-human-wait'
  config:
    enabled: true
    humanWaitCapMs: 86400000   # 24 小时；-1 = 不设上限
```

| 选项 | 默认 | 含义 |
| --- | --- | --- |
| `enabled` | `true` | 暂停总开关。`false` 完全回到宿主原生行为 |
| `humanWaitCapMs` | `86400000` | 单次运行等待人类的最长时间，`-1` 表示不限 |

两个选项都是 **volatile**：插件运行期间会被重新读取，改完约 1.5 秒生效，不用重启。手动改补丁则在下次启动时读取。

## 设置页

`client.js` 是手写的浏览器半边，注册在 `plugins.bundle.config` 槽（key `dsh-human-wait`）：一个 `humanWaitCapMs` 数字框、1 小时 / 24 小时 / 无限三个快捷按钮、字段级「已覆盖」与「恢复默认」，卡片上还有一行摘要。`enabled` 留在补丁层。

## 行为说明

- **Fail-open。** 缺少 `ptcRuntime` / `userQuestions` / `approval`、没有 `AbortSignal.any`、或者包装装不上时，插件只打一条警告，宿主原有 deadline 原样保留。
- **卸载时恢复。** 插件卸载（或被停用后重启）时每个包装都会被拆掉，宿主原方法恢复。
- **错误 kind 会变。** 暂停后的执行预算耗尽时，运行时报告 `kind: "abort"` 而不是 `"timeout"`，因为插件是通过自己的信号中止的；消息文本里仍有 `execution deadline reached (<budget>ms)`。
- **只影响 PTC 会话。** 标准会话本来就没有这个超时。
- **不是公开扩展点。** 插件包装的是两个宿主服务（`ptcRuntime`、`userQuestions`）和审批服务的方法，这是当前唯一可行的实现方式；未来 DSH 版本改动这些内部实现可能让它变成空操作——代码写成这种失败是安全的，不是致命的。

## 验证环境与验收记录

验证环境：DSH desktop **0.2.1-rc.3**（`dsh-ptc-runtime-node` 0.2.1，Node 24.21）。

2026-10-26 在 `dsh-human-wait` 0.1.0 上测得（桌面 profile，PTC 模式，出厂 120 秒预算）：

| 用例 | 场景 | 结果 |
| --- | --- | --- |
| A | 嵌套 `ask_user_question`，294037 ms 后才回答 | 答案送达，运行继续，没有 `execution deadline reached` |
| B | `exit_plan_mode` 计划审批，313073 ms 后才批准 | 计划通过，运行继续，没有被 120 秒取消 |
| C | `run_code` 里 `while (true) {}` | 约 120 秒后被终止，`Error: code run failed (abort): execution deadline reached (120000ms)` |

用例 C 的 `(abort)` 是预期行为：插件用自己的信号中止，运行时因此把失败归类为 `abort` 而不是 `timeout`，消息文本不变。

## 测试

```powershell
npm test    # node --test，无依赖
```

覆盖：两个配置项的重读、三个等待点的包装与恢复、fail-open 分支，以及浏览器半边的 bundle id / 槽位 / 页面渲染。
