# dsh-team-limits 实现说明

面向维护者。用户向说明见 [../README.md](../README.md)。

## 它改的是什么

自 DSH 0.2.2 起，宿主自带的 `@deepseek-ai/dsh-agent-team`（0.2.2 之前叫
`@deepseek-ai/dsh-experimental-agent-team`）只接受两个限制字段：

| 字段 | 出厂默认 | 本包默认 |
| --- | --- | --- |
| `maxTasks` | 256 | 256 |
| `defaultEnabled` | false | false |

0.2.2 一并移除了 `maxMembers`、`maxMessageBytes`、`disposalTimeoutMs`：队友现在就是普通子代理，
人数由子代理侧的 `maxActiveSubagents` / `maxDepth` 决定，消息体积与清理超时随旧实现一起消失。

## 结构

- `index.js`：宿主半边。声明两个 `.volatile()` 字段的 `Config`，`apply` 里通过 `ctx.configEditor`
  把当前值推到 `agent-team` 行：`configuration()` 找到行，`edit(entry, current => nextOverride(...))`
  写入。`edit()` 内部是 `hmr.runExclusive(...)`，而插件 `apply` 本身跑在 HMR 事务里，直接调用会报
  `HMR transactions cannot be nested`，所以推送被包进 `ctx.get('hmr').executing.exit(...)`。
  推送带三段重试（1.3s / 4s / 8s），另有 1.5 秒轮询感知页面上的改动（volatile 字段不会重挂插件）。
- `client.js`：浏览器半边，手写无构建，注册在 `plugins.bundle.config` 槽、key 为 `dsh-team-limits`。
  一个数字框（任务数上限）、一个开关（默认开启团队协作），边输边存（700ms 防抖），字段带
  「已覆盖」标记与「恢复默认」，卡片摘要形如 `1024 任务 · 默认关闭`。
- `cordis.patch.yml`：只插入一行 `team-limits`，不含任何数值。

## 旧键清洗（为什么必须删）

0.2.2 的 `TeamService` 在构造时遍历 `REMOVED_CONFIG_KEYS = ['maxMembers', 'maxMessageBytes',
'disposalTimeoutMs']`，命中就抛：

```
agent-team: <key> is no longer supported; teammates are subagents, so subagent limits and inbox
delivery apply
```

所以推送不能只是"加上我们的两个值"——必须把三个旧键从行的 override 里删掉，否则从 1.3.x 升级上来的
用户会得到一个起不来的团队行。`nextOverride()` 负责这件事；`alreadyApplied()` 把"旧键仍然存在"
也视为未完成，保证清理恰好发生一次。

## 生效路径

1. 用户在页面上改字段 → 写回本插件 `Config` → `apply` / 轮询触发的 `push` 用 `configEditor.edit()`
   把它写进 profile 的补丁层
2. Loader 走正常协调流程重新应用 `agent-team` 行
3. 本插件的两个字段是 volatile，改动不重挂本插件；`agent-team` 行的两个字段不是，写入会让该行做一次
   正常重载（稳态下值相同就不再写）

## 版本边界

1.3.x 装到 0.2.2 上时，四个字段里有三个已经不存在，推上去会触发 `TEAM_INVALID_CONFIG`。因此 2.0.0
把 `engines.dsh` 收到 `>=0.2.2-rc.1 <0.3.0-0`：0.2.1 用户停留在 1.3.x。

## 卸载行为

卸载不回滚已写入的数值：它们属于本机的 DSH 配置，不属于本包。想恢复出厂值，先在页面上点「恢复默认」。

## 测试

```powershell
npm test    # node --test? 否：node test/smoke.mjs
```

覆盖：`Config` 形状（能加载 schemastery 时）、推送时三个旧键被删除、已应用时不重复写入、
缺少 `configEditor` 时 fail-open 不抛错。
