# Changelog

## 0.1.0 — 2026-10-26

First release.

- Pauses the PTC `run_code` execution deadline while DSH is waiting for a human:
  `ptcRuntime.run` is wrapped so the wall-clock budget is measured by this plugin and only
  charged while no human-interaction wait is pending.
- Recognises human waits through `userQuestions.ask`, `userQuestions.askTimed` and
  `approval.request`; wait accounting is scoped to the waiting run with `AsyncLocalStorage`.
- `humanWaitCapMs` (default 24 h, `-1` = uncapped) bounds how long a run may wait.
- `enabled` / `humanWaitCapMs` options; all wrappers are restored when the plugin unloads.
- No sampling interval: the deadline is re-armed on accounting events, not on a tick.
- Fail-open: missing services, unavailable `AbortSignal.any` or an unexpected runtime shape
  leave the shipped deadline in place and log a single warning.
- Bundle patch inserts one host row; no client half.
