# Changelog

## 0.2.1 — 2026-10-27

- Adds a browser half (`client.js`), so the plugin gets its own settings page under **Plugins**:
  a wait-cap field with 1 h / 24 h / unlimited quick values, an "overridden" chip and a
  "restore default" action.
- `enabled` and `humanWaitCapMs` are now volatile: they are re-read while the plugin runs, so a
  save applies in about 1.5 s without restarting DSH. The wrappers also check `enabled` on
  every call, so turning the plugin off through the patch takes effect immediately.
- The host half takes over the settings page (`settings.configure({ auto: false })`) instead of
  letting DSH auto-generate a second, schema-only one.
- Tests: adds `test/client.test.mjs` (bundle id, slot key, page and summary rendering) and two
  runtime cases for re-reading the settings.

## 0.1.1 — 2026-10-26

First release published by GitHub Actions with npm provenance (trusted publishing).

- No behaviour change from 0.1.0; the source is the same apart from this entry and the docs.
- README: installing from the registry is now the primary route, the tarball route moved to the
  fallback slot.

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
