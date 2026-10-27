# dsh-find-session

**会话上下文关键词查找。** 在当前对话里按 `Ctrl+F` 直接查找并高亮，或者从左侧栏打开「查找」页做**跨会话**检索：命中项带片段、时间、类型徽标，点一下跳到那条消息。

> [English](README.en.md) | 中文

DSH 自带的会话搜索（`dsh-experimental-session-search`）是**模型侧**的工具，用来在历史会话里找线索；它是给 AI 用的，不是给你按 `Ctrl+F` 用的。这个插件补的是**人**的那一半：读对话时想定位「我上次是在哪一步定的这个方案」。

## 它解决的问题

在阅读长对话时定位一处内容，通常只有三种做法，都不好用：

| 做法 | 问题 |
| --- | --- |
| 浏览器自带的页内查找（`Ctrl+F`） | 只能命中**已经渲染出来**的内容。DSH 的对话是分页加载的，早先的轮次根本不在 DOM 里，搜不到；折叠的工具卡也不会展开。 |
| 让模型自己去搜 | 要发一轮对话、等模型回话，还不能高亮、不能「上一个/下一个」。 |
| 官方 `dsh-experimental-session-search` | 是给模型用的工具，不是给人用的界面。 |

而且官方引擎走 SQLite FTS5，分词器是 `unicode61`——它把一整串中日韩文字当成**一个 token**。于是搜「会话」永远匹配不到「我们来做会话上下文关键词查找」。本插件不用 FTS5，自己按码点做子串 / 整词 / 正则匹配，中文按两个字也能搜到。

## 功能

- **会话内查找条**：`Ctrl+F` 在输入框上方弹出查找条，输入即搜（200 ms 防抖），`Enter` / `Shift+Enter` 或 `F3` / `Shift+F3` 在命中之间前后跳。
- **高亮**：用 CSS Custom Highlight API 把**当前已渲染窗口内**的所有命中标成浅黄，当前那一条标成橙色并自动滚动到视野中央；跳过去的行还会闪一下。
- **跨会话查找**：左侧栏「查找」页，切到「全局」就在所有会话的日志里搜。结果按时间倒序，带会话、时间、类型（工具 / 思考）徽标。
- **命中预览**：点全局结果展开上下文——前后各 2 条事件，可以确认「就是这里」再决定要不要跳。
- **跳转**：点「打开」切到目标会话并定位到那一轮；那一轮还没加载时，先调会话自己的 `loadThrough` 把历史拉到位再定位。
- **筛选**：当前工作区 / 所有工作区、今天 / 近 7 天 / 近 30 天 / 不限、含已归档、含子会话。
- **搜索内容范围**：正文 / 工具调用 / 思考过程，三档独立开关。默认只搜正文——工具输出噪音太大，需要时再打开。
- **右侧栏结果面板**：结果可以停靠进右侧栏，看对话的同时翻结果。
- **设置**：设置 → 查找，改默认匹配方式、默认内容范围、单次结果上限。
- **快捷键**：默认 `Ctrl+F` / `Ctrl+Shift+F` / `F3` / `Shift+F3`，在 设置 → 快捷键 里可改。

## 安装

插件是一个普通 DSH bundle（一个宿主行 + 一个浏览器半边）。任选一条路：

**A. 从 tarball 手动装。** 在 `<DSH_HOME>/profiles/<profile>/package.json` 里加依赖和 bundle 名，然后安装：

```jsonc
{
  "dependencies": {
    "dsh-find-session": "file:D:/path/to/dsh-find-session-0.1.0.tgz"
  },
  "dsh": { "profile": { "bundles": ["dsh-find-session"] } }
}
```

```powershell
# pnpm 随桌面端运行时一起提供
& "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\pnpm.cjs" install --dir "$env:USERPROFILE\.dsh\profiles\desktop"
```

**B. 发布后从 registry 装。** 用 设置 → 插件 页面，或者在会话里调 `plugin_manager install_bundle`，spec 写 `dsh-find-session@0.1.0`——插件管理器会把依赖和 bundle 条目一起加好。

然后**从托盘退出 DSH 再启动**——bundle 在启动时组合。Electron 托管的 profile 不能用 `dsh` CLI 启动（会报 `profile "desktop" is managed exclusively by the Electron application`），只能重启应用。想关掉插件就把 `dsh.profile.bundles` 里的名字删掉、依赖删掉。

## 用法

| 想做的事 | 怎么做 |
| --- | --- |
| 在当前对话里找 | `Ctrl+F`，输入，`Enter` 往下、`Shift+Enter` 往上 |
| 在所有会话里找 | `Ctrl+Shift+F`，或左侧栏「查找」图标，切到「全局」 |
| 看在哪儿、要不要跳 | 点结果展开预览，点「打开」跳过去 |
| 把结果停靠到右侧 | 查找页右上角「停靠到右侧栏」 |
| 改默认行为 | 设置 → 查找 |

## 配置

行内默认值够用；要改就在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: dsh-find-session
  name: 'dsh-find-session'
  config:
    maxDocumentsPerScan: 30000
    concurrency: 4
    eventSoftCap: 40000
```

| 选项 | 默认 | 含义 |
| --- | --- | --- |
| `maxDocumentsPerScan` | `30000` | 一次全局扫描最多读多少个文本块，超了就截断并提示「还有更多」 |
| `concurrency` | `4` | 并发读几个会话的日志 |
| `eventSoftCap` | `40000` | 单会话事件数超过这个值就跳过它，避免超大会话拖垮 UI |

改动在插件加载时读取，改完重启 DSH。

## 实现说明

- **宿主半边**（`lib/index.js`）注册一个只读 RPC 通道 `/dsh-find-session`，端点 `search` / `context` / `sessions` / `ping`。它用 `sessionQuery.readSession` 读日志、`listSessions` 列会话，**不写任何东西**——不碰会话日志、不碰 profile、不碰设置文档。
- **文本抽取**（`lib/extract.js`）把事件拆成带类型标签的文本块。官方 `extractSessionEventText` 会**丢掉 `reasoning` 块**，所以没法实现「思考过程」这一档开关，这里自己实现一份。同一个工具调用只记一次（`assistant/message` 里的 `tool-call` 块跳过，用独立的 `tool/call` 事件），否则每条工具命中都会翻倍。
- **匹配**（`lib/match.js`）纯函数、无依赖：子串 / 整词（对 CJK 邻字符算边界）/ 正则，三者都支持区分大小写。零宽正则有循环保护。
- **缓存**：活跃会话 1 秒 TTL，已结束的会话 60 秒（日志不再变化）。缓存最多 400 个会话，超了按最旧淘汰。
- **浏览器半边**（`lib/client.js`）手写、无构建步骤，挂在 Harness 的 ModuleLoader 信封里。用五个挂载点：`shell.overlay`（查找条）、`conversation.session.header.actions`（会话头开关）、`sidebar.panellist` + `main`（左侧栏图标和查找页）、`sidebar.right.pane.tab`（结果面板）、`settings.section`（设置卡片）。
  - 查找条**必须**挂在 `shell.overlay`，不能挂在 `conversation.input.dock`。dock 位于 `[data-composer-seat]` 内部，而皮肤可以隐藏整个 seat——maid 皮肤的做法是写 `data-maid-composer-hidden` → `opacity:0;pointer-events:none`，同时 `blur` 掉里面持有焦点的元素。查找必然滚动转录，所以挂在 dock 里的输入框一旦被 seat 隐藏就会失焦，之后敲键盘没反应，表现为「只能输入一次」。`shell.overlay` 在所有滚动容器之外，不受任何滚动驱动的隐藏影响。**注意**：这条是结构性理由，不是对某次故障的定论——本机 profile 里 maid 皮肤当前是 `disabled`，所以那次故障若发生在皮肤未启用时，触发源是别的（见下方修订说明）。
- **高亮**用 `CSS.highlights` + `::highlight()`，不支持时静默退化成「只滚动 + 闪一下」，不报错。
- **定位**按 `[data-chat-turn="N"]` 找行——宿主把 `turn` 一并返回，比解析 DOM 结构稳。

有一点和最初设想不同，如实说明：**界面偏好存在 `localStorage['dsh.session-find.prefs.v1']`**，不是 DSH 的设置文档。原因是客户端服务目录里没有 settings 服务（只有 layout / locale / sessions / slots / theme / timer / uiWorkspace / workspaces），要写进 DSH 的设置就得额外开一条 RPC 存文件，风险和收益不成比例。`localStorage` 在桌面端是持久化的 profile，重启照旧在。

验证环境：DSH desktop **0.2.1-rc.3**，Node 24。官方引擎 `@deepseek-ai/dsh-session-query-sqlite` 的 `unicode61` 行为就是上面那条：「会话」搜不到「我们来做会话上下文关键词查找」。

## 已知边界

- 会话内查找只高亮**当前已渲染**的命中。跳到未加载的历史时会先调 `loadThrough` 拉取，但一次拉多少由 DSH 自己决定。
- 全局扫描有预算上限（默认 3 万文本块）。超出后结果会被截断，界面上会写「还有更多，请收窄条件」——把时间或工作区收窄就能搜全。
- 只读。插件不提供任何写入、删除、导出。

## 开发

```powershell
npm test          # node --test，无第三方依赖（28 条断言）
node test/smoke.mjs      # 宿主 RPC 的端到端冒烟（22 条断言，假 ctx）
node test/realdata.mjs   # 拿本机真实会话日志回放整条链路（可选，需要 ~/.dsh/sessions）
```

测试覆盖：匹配器的三种模式与 CJK 边界、文本抽取的事件分派（含 turn 锚点与标题折叠）、宿主 RPC 的全部端点（含过滤、分页、缓存、读失败降级、中途取消）。

`realdata.mjs` 是本机专用的一次性验收脚本：它把 `~/.dsh/sessions` 下真实的 `session.v4.jsonl.zstd` 解压出来，伪装成 `sessionPersistence` 灌进 `apply()`，然后逐个端点核对。在当前这台机器上跑出来是 222 个会话、`会话` 一词 200 条命中、每条都带 turn 锚点和会话标题、宽泛扫描 97 ms。

## License

MIT

## 验收记录

实现完成后在本机（Windows 10 桌面端，DSH 0.2.1-rc.3，Node 24）做过的验证：

| 项目 | 结果 |
| --- | --- |
| `npm test` | 28 / 28 通过 |
| `node test/smoke.mjs` | 22 / 22 通过 |
| `node test/realdata.mjs` | 全部通过（222 会话 / 200 命中 / 97 ms） |
| 宿主 RPC 通道 `/dsh-find-session` | 已注册（未鉴权探测返回 401，与 `/dsh-rewind` 一致） |
| 左侧栏图标 + 查找页 | 已挂载 |
| `shell.overlay` 查找条 | 已挂载（order 40） |
| `conversation.session.header.actions` 开关 | 已挂载（order 40） |
| `sidebar.right.pane.tab` 结果面板 | 已挂载 |
| `settings.section` 设置卡片 | 已挂载 |
| `CSS.highlights` 高亮 + 跳转 | 待桌面端点一次（见下方说明） |

界面上的最后一步走查需要人手点一下。实现里已经验证了能验证的全部：数据链路、路由注册、五个挂载点、匹配与定位的算法。剩下的就是「按下 Ctrl+F 看见条、打字看见高亮、回车跳过去」这三下。

> 2026-10-27 修订：查找条从 `conversation.input.dock` 迁到 `shell.overlay`。dock 在 `[data-composer-seat]` 内，而皮肤可以在转录滚动时隐藏并 blur 该 seat，导致输入框在第一次搜索后失焦，表现为「只能输入一次」。`shell.overlay` 在滚动容器之外，不受影响。同时 `SearchInput` 改成「本地草稿值 + `isComposing` 判断」，避免受控输入在 store 落后时被 React 回写掉按键。
