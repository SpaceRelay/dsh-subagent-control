# Changelog

## 0.1.0 — 2026-10-27

First release.

- In-session find bar (`Ctrl+F`) searches the conversation it is docked in; the
  cross-session panel (`Ctrl+Shift+F`) searches every stored session and lists
  hits with the session title, workspace and timestamp. `F3` / `Shift+F3` step
  through the current result set (the bar must be open).
- Results jump to the turn (and the folded row inside it) and flash the target
  line; matches are painted with CSS Custom Highlight, so the page text itself is
  never mutated.
- Literal (default) and regular-expression modes, case-insensitive, with tools
  and thinking content opt-in — the default corpus is the conversation text.
- Filters: workspace, time window, archived sessions, agent preset, child
  sessions. The Host half scans with a Unicode-aware substring matcher instead of
  SQLite FTS, whose `unicode61` tokenizer treats a whole CJK run as one token and
  would never find 「会话」 inside 「会话上下文关键词查找」.
- The search input is non-controlled and treats a missing `compositionend` as
  harmless, so an IME composition interrupted by the Host stealing focus can no
  longer latch the field into "types once, then swallows every key".
- Shortcut defaults are declared for the desktop profiles only, and a page-level
  listener covers the two open gestures when the shortcut service is absent —
  a rejected default used to abort the whole registration batch silently.
- Tests: 22 offline tests (`node --test`, plus the Host smoke test) and the jsdom
  harnesses that drive the real `lib/client.js` (IME latch, shortcut dispatch,
  page fallback).
