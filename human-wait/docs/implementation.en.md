# dsh-human-wait — implementation notes

For maintainers. User-facing docs live in [../README.en.md](../README.en.md).

## The problem

In PTC mode, `dsh-ptc-runtime-node` puts one wall-clock budget around the entire `run_code` program, nested tool calls and approval waits included:

```js
const wallTimer = spec.timeoutMs === null ? void 0 : setTimeout(() => {
  timedOut = true
  controller.abort("execution deadline reached")
}, spec.timeoutMs)
```

So the time spent waiting for you burns the budget too. This project takes the timer over and charges it only while no human-interaction wait is pending.

## How it works

1. Wrap `ptcRuntime.run`: the deadline moves into the plugin, which can pause it.
2. Wrap the three points where a human is actually being waited on: `userQuestions.ask`, `userQuestions.askTimed`, `approval.request`.
3. Use `node:async_hooks` `AsyncLocalStorage` to scope the accounting to the run that is really waiting, charging the budget only while no such wait is pending.

A single `run_code` call can still pass its own `timeoutMs`; that number keeps working as the execution budget.

## Configuration

The row ships sensible defaults; override them in the same profile's `cordis.patch.yml`:

```yaml
- id: human-wait
  name: 'dsh-human-wait'
  config:
    enabled: true
    humanWaitCapMs: 86400000   # 24 h; -1 = no cap at all
```

| Option | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Master switch for pausing. `false` reproduces the shipped behaviour exactly. |
| `humanWaitCapMs` | `86400000` | Longest time one run may spend waiting for a human. `-1` removes the cap. |

Both options are **volatile**: they are re-read while the plugin runs, so a change applies in about 1.5 seconds without a restart. A hand-edited patch is read at boot.

## Settings page

`client.js` is a hand-written browser half registered on the `plugins.bundle.config` slot (key `dsh-human-wait`): a `humanWaitCapMs` number field, 1 hour / 24 hours / unlimited quick buttons, a field-level "overridden" chip with "restore default", and a one-line summary on the card. `enabled` stays in the patch layer.

## Behaviour notes

- **Fail-open.** If `ptcRuntime` / `userQuestions` / `approval` are missing, if `AbortSignal.any` is unavailable, or if a wrapper cannot be installed, the plugin logs one warning and leaves the shipped deadline untouched.
- **Restored on unload.** Every wrapper is removed when the plugin unloads (or is disabled and the profile restarted); the original methods are back.
- **The terminal error changes kind.** When the paused execution budget runs out, the runtime reports `kind: "abort"` instead of `kind: "timeout"`, because the plugin aborts the run through its signal. The message still contains `execution deadline reached (<budget>ms)`.
- **Only PTC sessions are affected.** Standard sessions never had this timeout: their questions wait indefinitely by design.
- **Not a public extension point.** The plugin patches methods of two host services (`ptcRuntime`, `userQuestions`) and one approval service. That is the only way to implement this today; a future DSH release may change those internals and make the patch a no-op. The plugin is written so that this failure mode is safe, not fatal.

## Verified environment and acceptance record

Verified against DSH desktop **0.2.1-rc.3** (`dsh-ptc-runtime-node` 0.2.1, Node 24.21).

Recorded 2026-10-26 against `dsh-human-wait` 0.1.0 in the desktop profile (PTC mode, shipped 120 s budget):

| Test | Scenario | Observed |
| --- | --- | --- |
| A | nested `ask_user_question`, answered after 294037 ms | answer delivered, run continued, no `execution deadline reached` |
| B | plan review submitted through `exit_plan_mode`, approved after 313073 ms | plan approved, run continued, no automatic cancellation at 120 s |
| C | `run_code` running `while (true) {}` | killed after ~120 s with `Error: code run failed (abort): execution deadline reached (120000ms)` |

Test C's `(abort)` label is expected — the plugin aborts through its own signal, so the runtime classifies the failure as `abort` instead of `timeout` while the message text stays `execution deadline reached (120000ms)`.

## Tests

```powershell
npm test    # node --test, no dependencies
```

Coverage: re-reading both settings, wrapping and restoring the three wait points, the fail-open branches, and the browser half (bundle id, slot key, page rendering).
