# dsh-team-limits 实现说明

面向维护者。用户向说明见 [../README.md](../README.md)。

## 它改的是什么

本包把自己挂到宿主自带的 `agent-team` 行上，把四个限额字段变成可编辑项。宿主出厂值：

| 字段 | 出厂默认 | 本包默认 |
| --- | --- | --- |
| `maxMembers` | 16 | 32 |
| `maxTasks` | 256 | 512 |
| `maxMessageBytes` | 65536 | 131072 |
| `disposalTimeoutMs` | 5000 | 5000 |

## 结构

- `index.js`：宿主半边。声明一个 `Config`（四个字段各自 `.volatile()`），并在 `apply` 里把当前值推到 `agent-team` 行。写入走 `ctx.configEditor`：先 `configuration()` 找到 `agent-team` 行，再 `edit(entry, current => ({...current, ...values}))`。`edit()` 内部是 `hmr.runExclusive(...)`，而插件 `apply` 本身跑在 HMR 事务里，直接用会报 `HMR transactions cannot be nested`，所以推送被包进 `ctx.get('hmr').executing.exit(...)`。
- `client.js`：浏览器半边，手写无构建，注册在 `plugins.bundle.config` 槽、key 为 `dsh-team-limits`。页面用 `ctx.configForms` 读当前值并回写，字段带「已覆盖」标记与「恢复默认」。
- `cordis.patch.yml`：插入一行 `team-limits`（占位组件，让包有可挂载的入口与可列出的组件），**不含任何数字**。

## 为什么补丁里不写数字

1.2.0 之前，数值是直接写在补丁里覆盖 `agent-team` 的。那样有两个问题：DSH 升级改了出厂默认，旧数字会悄悄复活；用户也没法在界面上改。现在数值只存在 profile 的补丁层（由 `configEditor` 写入），本包的补丁保持空。

## 生效路径

1. 用户改字段 → 客户端把值写回 `Config` → 插件 `apply` 用 `configEditor.edit()` 写进 profile 补丁层
2. Loader 走正常协调流程把 `agent-team` 行重新应用
3. 四个字段是 volatile 的：改动不重挂插件，插件用 1.5 秒轮询感知变化再推一次

## 卸载行为

卸载本包不会回滚已写入的数值：它们属于 profile 的补丁层，不属于本包。要恢复出厂值，在页面上点「恢复默认」，或手动删除 profile 补丁里 `agent-team` 的那条 `config`。

## 测试

```powershell
node test/smoke.mjs
```

覆盖：注册形状、四个字段的默认值、推送参数、以及 `configEditor` 缺失时的降级。
