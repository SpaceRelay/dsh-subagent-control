# Changelog

## 0.2.4 — 2026-11-16

The settings page saves on an explicit button instead of 700 ms after you stop typing.

- Editing a field only changes a draft; nothing is written until you press **Save**. **Discard**
  drops the draft and shows the saved values again.
- The quick buttons (1 hour / 24 hours / unlimited) and **Restore default** also edit the draft
  only, so a half-finished edit cannot reach the running plugin.
- The card summary now reports the saved values, not the draft.

## 0.2.3 — 2026-11-15

Documentation only, no behaviour change.

- The opening line states the scope and the outcome (only in PTC mode; the 120-second deadline
  pauses while DSH waits for you) instead of saying a timeout counts down.
- The FAQ keeps only questions readers actually ask. The defensive "does it affect standard
  sessions?" entry is gone: the scope already says PTC mode, so there is nothing to warn about.
- Plain wording throughout, including the "it still timed out" checklist and the privacy note.

## 0.2.2 — 2026-11-15

- Rewrote the README for users: when the plugin helps, what it does and does not change (a table
  with the four cases), how to install and where the setting lives. The Chinese README is now
  primary and `README.en.md` is the English translation.
- Moved the implementation notes, the acceptance record and the tests to `docs/implementation.md`
  and `docs/implementation.en.md`.

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
