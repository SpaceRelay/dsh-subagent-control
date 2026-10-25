# dsh-human-wait

**Stops the PTC `run_code` deadline while DSH is waiting for you.** In PTC mode a question
(`ask_user_question`), the plan review raised by `exit_plan_mode`, or a sandbox approval is a
nested call inside the one `run_code` program — and `dsh-ptc-runtime-node` measures a single
wall-clock budget across the whole program, *including the time you spend answering*. Wait
longer than what is left of that budget and the run dies with:

```
Error: code run failed (timeout): execution deadline reached (120000ms)
```

and the question card is reported as **已中断 / interrupted**. This plugin keeps the deadline
for execution but pauses it while a human-interaction wait is pending. A runaway program is
still cut off after its budget; a question you think about for an hour is not.

> 中文摘要：PTC 模式下提问、计划审批和批准都是 `run_code` 里的嵌套调用，共用同一条 120 秒墙钟预算，
> 所以「想久一点再回答」会让你看到的是一次 `execution deadline reached (120000ms)` 超时。本插件
> 保留执行的截止时间，但在**等待你回答/批准期间暂停计时**；等待本身另有上限（默认 24 小时，可设为无限）。

---

## What it does

| Situation | Without the plugin | With the plugin |
| --- | --- | --- |
| A question inside `run_code`, you answer in 20 s, run budget was 120 s | OK | OK |
| Same run, you answer after 4 minutes | run aborted at 120 s, question interrupted | run keeps waiting; the answer is delivered |
| Same run, you never answer | run aborted at 120 s | run aborted once the wait exceeds `humanWaitCapMs` (24 h) |
| A program that spins for 10 minutes without asking anything | aborted at 120 s | aborted at 120 s — unchanged |

It works by:

1. wrapping `ptcRuntime.run` and moving the deadline into the plugin, so it can be paused;
2. wrapping `userQuestions.ask` / `userQuestions.askTimed` and `approval.request` — the three
   service calls that exist only because a human is being waited on;
3. charging the budget only while no such wait is pending (`node:async_hooks`
   `AsyncLocalStorage` keeps the accounting scoped to the run that is actually waiting).

A single `run_code` call can still pass its own `timeoutMs`; that number keeps working as the
execution budget and is what the plugin enforces.

## Install

The plugin is a normal DSH bundle (one inserted host row, no client half). Pick one route:

**A. From a tarball, by hand.** In `<DSH_HOME>/profiles/<profile>/package.json` add the dependency
and the bundle name, then install it:

```jsonc
{
  "dependencies": {
    "dsh-human-wait": "file:D:/path/to/dsh-human-wait-0.1.0.tgz"
  },
  "dsh": { "profile": { "bundles": ["dsh-human-wait"] } }
}
```

```powershell
# pnpm ships with the desktop runtime
& "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\pnpm.cjs" install --dir "$env:USERPROFILE\.dsh\profiles\desktop"
```

**B. From the registry, once published.** Use the Plugins settings page (or a
`plugin_manager install_bundle` call in a session) with the spec `dsh-human-wait@0.1.0`; the
plugin manager adds both the dependency and the bundle entry for you.

Then **quit DSH from the tray icon and start it again** — bundles are composed at boot. The
Electron-managed profile cannot be booted through the `dsh` CLI (`profile "desktop" is managed
exclusively by the Electron application`), so restarting the app is the only way to apply it.
Removing the bundle name from `dsh.profile.bundles` and deleting the dependency disables the
plugin again; the wrappers are also restored at unload time.

## Configuration

The row ships sensible defaults; override them in the same profile's `cordis.patch.yml` when
you want something else:

```yaml
- id: human-wait
  name: 'dsh-human-wait'
  config:
    enabled: true
    humanWaitCapMs: 86400000   # 24 h; -1 = no cap at all
```

| Option | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Turn the pause on/off. `false` reproduces the shipped behaviour exactly. |
| `humanWaitCapMs` | `86400000` | Longest time one run may spend waiting for a human. `-1` removes the cap. |

How the clock works: the plugin re-arms a single timer on every accounting event (run start, a
wait starting or ending, or the timer itself firing), so there is no fixed sampling period and
no configuration knob for one.

Changes are read when the plugin loads, so restart DSH after editing.

## What counts as a human wait

- `userQuestions.ask` — blocking questions, including the `plan-review` question from
  `exit_plan_mode`;
- `userQuestions.askTimed` — timed questions;
- `approval.request` — sandbox/policy approvals that block on the user.

Tool calls that finish on their own (bash, file reads, web fetches, subagents) are **not**
waits: their time is still charged to the run, exactly as before.

## Behaviour notes

- **Fail-open.** If `ptcRuntime` / `userQuestions` / `approval` are missing, if
  `AbortSignal.any` is unavailable, or if a wrapper cannot be installed, the plugin logs one
  warning and leaves the shipped deadline untouched.
- **Restored on unload.** Every wrapper is removed when the plugin unloads (or is disabled and
  the profile restarted); the original methods are back.
- **The terminal error changes kind.** When the paused execution budget runs out, the runtime
  reports `kind: "abort"` instead of `kind: "timeout"`, because the plugin aborts the run
  through its signal. The message still contains `execution deadline reached (<budget>ms)`, so
  the surfaced text is the same.
- **Only PTC sessions are affected.** Standard sessions never had this timeout: their
  questions wait indefinitely by design.
- **Not a public extension point.** The plugin patches methods of two host services
  (`ptcRuntime`, `userQuestions`) and one approval service. That is the only way to implement
  this today; a future DSH release may change those internals and make the patch a no-op. The
  plugin is written so that this failure mode is safe, not fatal.

Verified against DSH desktop **0.2.1-rc.3** (`dsh-ptc-runtime-node` 0.2.1, node 24.21).
`ptc-runtime-node/lib/index.js` is where the shipped timer lives:

```js
const wallTimer = spec.timeoutMs === null ? void 0 : setTimeout(() => {
  timedOut = true;
  controller.abort("execution deadline reached");
}, spec.timeoutMs);
```

## Troubleshooting

- Look for `[dsh-human-wait]` lines in the DSH log; the plugin logs either
  `PTC run deadlines now pause while a human is waiting (wait cap: …)` or the reason it stayed
  out of the way.
- If a wait still dies with `execution deadline reached`, the wrapper did not see the wait.
  Check that PTC mode is actually in use (the session header shows the `PTC` badge) and that
  `enabled` is not `false`.

## Development

```powershell
npm test        # node --test, no dependencies
```

## License

MIT

## Acceptance record

Recorded 2026-10-26 against `dsh-human-wait` 0.1.0 in the desktop profile (PTC mode, shipped 120 s budget):

| Test | Scenario | Observed |
| --- | --- | --- |
| A | nested `ask_user_question`, answered after 294037 ms | answer delivered, run continued, no `execution deadline reached` |
| B | plan review submitted through `exit_plan_mode`, approved after 313073 ms | plan approved, run continued, no automatic cancellation at 120 s |
| C | `run_code` running `while (true) {}` | killed after ~120 s with `Error: code run failed (abort): execution deadline reached (120000ms)` |

Test C's `(abort)` label is expected — the plugin aborts through its own signal, so the runtime classifies the failure as `abort` instead of `timeout` while the message text stays `execution deadline reached (120000ms)`.

