# 实现说明

面向想知道“它到底做了什么”的人。日常使用不需要读。

## 为什么需要这个插件

DSH 官方的 `subagent` 工具要传 `provider` / `model` 两个参数，前提是当前对话在创建时就记下了 `subagent/model-selection-policy` 事件；没有这个事件时，官方工具的判定是“只允许和父对话完全相同的路由”。这个事件只在对话诞生那一刻写一次，条件写死在 `target.firstLiveSeq === 0 && target.eventAt(0)?.type !== 'session/end-seed'`，所以已经存在的对话永远补不上。

设置页里那份“允许的模型”清单，作用就是给新对话写这条事件。它也帮不了老对话。

## 为什么另开一扇门，而不是修原来那扇

- 官方的 `subagent` 工具，JSON Schema 是按配置现场生成的，注册时有重名保护。要加字段只能整段替换它的定义，等于分叉官方实现。
- 直接给老对话补一条 policy 事件则等于篡改用户的会话历史，而且投影只认首条、append 还要求会话已进入 publicationEntry，非常脆弱。

所以插件自己注册工具，直接调 `ctx.subagents.startActivation()`。那道 policy 闸门只装在官方工具的入口里，服务层没有，因此从服务层进来的调用天然不受它限制。

## 工具长什么样

`subagent_route` 的参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| `description` | 是 | 显示用的短标签，和官方 `subagent` 工具同名字段 |
| `prompt` | 是 | 交给子代理的完整任务。子代理看不到当前对话，要写全 |
| `provider` | 是 | 渠道 id |
| `model` | 是 | 模型 id |
| `reasoning_effort` | 否 | 推理档位，省略则用该模型自己的默认档 |
| `name` | 否 | 子代理的短名字 |
| `cwd` | 否 | 子代理的工作目录，省略则跟当前对话一致 |

`list_routes` 有两个可选参数：只给 `provider` 时列出该渠道的模型；`provider` 和 `model` 都给了，会额外列出这个模型支持的推理档位。

点名一个模型而它不在渠道的模型清单里时，插件不会直接判它不存在，而是调 `ctx.llm.resolveModelInfo(provider, model)` 去问渠道本身。DSH 里这条接口的注释写得很直白：`catalog membership remains advisory and does not control request routing`——清单是目录，不是路由许可。两类渠道的实际差别也在这里：pi-ai 那一侧遇到没配置的模型抛 `UNKNOWN_MODEL`，DeepSeek 官方那一侧则接受任意 id、只是降级成纯文本且没有目录元数据。所以能解析就把这个模型补出来并注明“目录里没有但渠道接受”，解析失败才把渠道给出的理由一起报出来。全量列清单时不做这一步，否则用户主动隐藏的模型会被逐个问一遍、再全部冒出来。

## 派活之前先验一遍

工具真正动手之前，会先调一次 `ctx.llm.resolveCallConfig({ provider, model, reasoningEffort })`。这一次调用同时回答三个问题：渠道在不在、模型在不在、这个档位这个模型支不支持。任何一项不成立都会当场抛错，用户看到的是 `provider "X" model "Y" does not support reasoning effort "Z"` 这类原文，而不是一个已经开始跑、却答不上话的子代理。

预检通过之后才拼 `startActivation` 的请求：`agentOptions` 里只放 `provider` / `model` / `reasoningEffort`，其余字段（包括父会话的 preset、深度上限）由子代理服务自己补齐。

`maxDepth` 通过 `ctx.subagents.resolveMaxDepth()` 取，和官方工具一致：配置是 `'provider-managed'` 时不传，否则传当前上限。

## 换路由时的推理档位

父对话用 `max`，子代理换到另一个模型时，这个 `max` 不会跟过去。原因很实际：另一个模型可能根本没有 `max` 这一档。规则是——路由没变就继承父档位，路由变了就用新模型的默认档；显式给了 `reasoning_effort` 则一律以传入值为准。

这个判断写在插件的 `preflightRoute` 里，复刻的是官方 `preflightChildLlmRoute` 的行为。

## 插件自己的白名单

设置页里有一个“允许的渠道”清单，默认空着。空着表示这个 profile 里配过的渠道和模型都能用；勾了条目就只放行勾上的组合。

它和 DSH 设置页里那份官方清单不是一回事：官方那份写进对话记录、只影响新对话；插件这份是运行时的开关，随时改随时生效，而且只管 `subagent_route` 这一个工具。

清单不是手填的，是从 `ctx.remote.session.modelCatalog()` 现读的模型目录里勾出来的，和官方设置页用的是同一个来源，所以渠道改名、模型下架都会自动反映出来。已经勾上但渠道不再提供的路由不会凭空消失：它们被单独列在「已经不在清单里了」下面，只有取消勾选才会真正从配置里去掉。目录读取失败时页面给出原因和重试按钮，不会退化成空白清单。

保存走 `form.mutate([{ op: 'set', path: ['allowedModels'], value }], snapshot.revision)` 一次写入，并带上渲染时的 revision；如果别处刚好也改过设置，写入会失败并提示重新选择，而不是悄悄覆盖。

## 配置项

| 配置 | 默认 | 说明 |
|---|---|---|
| `allowedModels` | `[]` | 允许的路由清单，空表示全放行 |

`allowedModels` 是 `volatile`，在设置页保存后立刻生效，不需要重启。插件没有启用开关：不想用就停用插件本身。

## 已知代价

- 换渠道意味着缓存对不上，前面聊过的内容要重新计价。这跟 fork 与否无关，是换 provider 的物理成本。
- 子代理依然受 `maxDepth` 与 `maxActiveSubagents` 两条宿主限制约束。
- 插件不做 fork 变体。fork 会把当前对话整段复制给子代理，而换渠道之后那份前缀的缓存已经作废，等于全价重算，不划算。

## 安装方式

市面上装法就是在 设置 → 插件 → 市场 里搜包名 `dsh-subagent-route`，装上后完全退出 DSH 再打开。开发时也可以直接把目录 link 进 profile 的依赖里，跑一次 pnpm 即可。

## 测试

`npm test` 跑 `test/plugin.test.mjs` 与 `test/client.test.mjs`。前者用一个假的宿主上下文验证路由预检、白名单、`list_routes` 的降级分支（目录读不到、点名的模型目录里没有而渠道接受、点名的模型被渠道拒绝）和渲染文本；后者按 `window.__ModuleLoader__` 的方式加载 `client.js`，用一个会跑 state 与 effect 的假 React 把设置页挂起来，检查目录分组、已勾选的还原、下架路由的保留、勾选后的保存内容与 revision、目录失败后的重试、摘要视图与「设置服务缺失」这几条路径。

## 验收记录

在真实的桌面实例上做过三级验证：

- 单测 35 条全绿。
- 隔离实例里装上后，`list_routes` 能列出本机的渠道与模型；`subagent_route` 派出的子代理，其会话记录里的 provider、model、推理档位与请求一致；填了白名单后未列出的路由被拒，原文是 `route "X/Y" is not in this plugin's allow-list`；不存在的渠道在启动子代理之前就被拦下。
- 在一个创建于两周前、从未记录过 policy 事件的老对话里，插件能把子代理派到另一个渠道并正常收回结果；同一个对话改走官方 `subagent` 工具的同一条路由，会被 policy 闸门拒绝。

## 卸载

插件没有改任何官方文件，也没有往用户的会话里写任何事件。卸载后官方的子代理工具原样运行。设置页保存过的勾选留在 DSH 的设置里，需要的话手动删掉 `allowedModels` 那一项。