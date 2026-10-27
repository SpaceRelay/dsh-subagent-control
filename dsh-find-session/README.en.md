# dsh-find-session

**Keyword find for the conversation.** Press `Ctrl+F` to search the current conversation with live highlighting, or open the **Find** page in the left rail to search **across every session** — hits come with a snippet, timestamp and a type badge, and one click jumps you to that message.

> English | [中文](README.md)

DSH's own session search (`dsh-experimental-session-search`) is a **model-facing** tool: it lets the assistant dig through past sessions. It is not something you press `Ctrl+F` on. This plugin provides **the human's half**: locating "which step was it where we settled this plan" while reading a long conversation.

## The problem

There are three usual ways to locate a passage in a long conversation, and none of them works well:

| Approach | Why it is not enough |
| --- | --- |
| The browser's own find (`Ctrl+F`) | Only sees what is **already rendered**. DSH loads a conversation in pages, so earlier turns are not in the DOM at all; folded tool cards do not match either. |
| Ask the model to search for you | Costs a full round trip, cannot highlight, cannot step "next / previous". |
| The official `dsh-experimental-session-search` | A tool for the model, not an interface for a person. |

The official engine also uses SQLite FTS5 with the `unicode61` tokenizer, which treats a whole run of CJK characters as **one token**. Searching `会话` therefore never matches `我们来做会话上下文关键词查找`. This plugin skips FTS5 and matches by code point instead — substring, whole word and regex — so two-character Chinese queries work.

## Features

- **In-session find bar** — `Ctrl+F` opens a bar above the composer. Search-as-you-type with a 200 ms debounce. `Enter` / `Shift+Enter` or `F3` / `Shift+F3` step through hits.
- **Highlighting** — the CSS Custom Highlight API paints every hit **in the currently rendered window** pale yellow and the current one orange, scrolling it into view. The row you jump to also flashes.
- **Cross-session find** — the **Find** page in the left rail; switch to **All sessions** to search every session's log. Results are newest-first with session, time, and type (tool / reasoning) badges.
- **Hit preview** — click a global result to expand its context: two events either side, so you can confirm it is the right one before jumping.
- **Jump** — **Open** switches to the target session and locates the turn. If that turn is not loaded yet, the plugin calls the session's own `loadThrough` to pull history in first, then locates.
- **Filters** — this workspace / all workspaces, today / last 7 days / last 30 days / any, include archived, include subagent sessions.
- **Content scope** — body / tool calls / reasoning as three independent switches. Body only by default: tool output is mostly noise, turn it on when needed.
- **Right-sidebar results panel** — dock the results into the right sidebar and scroll them while reading the conversation.
- **Settings** — Settings → Find, for the default match mode, default content scope, and result limit.
- **Shortcuts** — `Ctrl+F` / `Ctrl+Shift+F` / `F3` / `Shift+F3` by default, editable under Settings → Shortcuts.

## Install

The plugin is a normal DSH bundle (one host row plus a browser half). Pick one route:

**A. From a tarball, by hand.** In `<DSH_HOME>/profiles/<profile>/package.json` add the dependency and the bundle name, then install it:

```jsonc
{
  "dependencies": {
    "dsh-find-session": "file:D:/path/to/dsh-find-session-0.1.0.tgz"
  },
  "dsh": { "profile": { "bundles": ["dsh-find-session"] } }
}
```

```powershell
# pnpm ships with the desktop runtime
& "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\pnpm.cjs" install --dir "$env:USERPROFILE\.dsh\profiles\desktop"
```

**B. From the registry, once published.** Use the Plugins settings page (or a `plugin_manager install_bundle` call in a session) with the spec `dsh-find-session@0.1.0`; the plugin manager adds both the dependency and the bundle entry for you.

Then **quit DSH from the tray icon and start it again** — bundles are composed at boot. The Electron-managed profile cannot be booted through the `dsh` CLI (`profile "desktop" is managed exclusively by the Electron application`), so restarting the app is the only way to apply it. Removing the bundle name from `dsh.profile.bundles` and deleting the dependency disables the plugin again.

## Usage

| What you want | How |
| --- | --- |
| Find in the current conversation | `Ctrl+F`, type, `Enter` for next, `Shift+Enter` for previous |
| Find in every session | `Ctrl+Shift+F`, or the **Find** icon in the left rail, then switch to **All sessions** |
| See where a hit is before jumping | Click the result to expand the preview, then **Open** |
| Dock results to the right sidebar | **Dock to sidebar** in the top-right of the Find page |
| Change the defaults | Settings → Find |

## Configuration

The row ships sensible defaults; override them in the same profile's `cordis.patch.yml`:

```yaml
- id: dsh-find-session
  name: 'dsh-find-session'
  config:
    maxDocumentsPerScan: 30000
    concurrency: 4
    eventSoftCap: 40000
```

| Option | Default | Meaning |
| --- | --- | --- |
| `maxDocumentsPerScan` | `30000` | Most text chunks one global scan will read. Past this the results are truncated and the UI says so. |
| `concurrency` | `4` | How many session logs are read in parallel. |
| `eventSoftCap` | `40000` | Sessions with more events than this are skipped, so one huge session cannot stall the UI. |

Changes are read when the plugin loads, so restart DSH after editing.

## How it works

- **Host half** (`lib/index.js`) registers one read-only RPC channel, `/dsh-find-session`, with the endpoints `search` / `context` / `sessions` / `ping`. It reads logs through `sessionQuery.readSession` and enumerates sessions through `listSessions`. It **writes nothing** — not the session log, not the profile, not the settings document.
- **Text extraction** (`lib/extract.js`) turns events into typed text chunks. The official `extractSessionEventText` **drops `reasoning` blocks**, so it cannot back a "reasoning" scope switch; this plugin implements its own dispatch. Each tool call is recorded once (the `tool-call` block inside `assistant/message` is skipped in favour of the standalone `tool/call` event), otherwise every tool hit would appear twice.
- **Matching** (`lib/match.js`) is a dependency-free pure function: substring / whole word (CJK neighbours count as boundaries) / regex, all three with an optional case-sensitive flag. Zero-width regexes have a loop guard.
- **Caching**: 1 s TTL for the active session, 60 s for finished ones (their log no longer changes). At most 400 sessions cached, oldest evicted first.
- **Browser half** (`lib/client.js`) is hand-written with no build step, wrapped in the Harness ModuleLoader envelope. It mounts at five points: `shell.overlay` (the find bar), `conversation.session.header.actions` (a header toggle), `sidebar.panellist` + `main` (the rail icon and the Find page), `sidebar.right.pane.tab` (the results panel), and `settings.section` (the settings card).
  - The find bar **must** live in `shell.overlay`, never in `conversation.input.dock`. The dock sits inside `[data-composer-seat]`, and a skin may hide that whole seat — the maid skin writes `data-maid-composer-hidden` → `opacity:0;pointer-events:none` and blurs whatever inside it holds focus. Searching necessarily scrolls the transcript, so a box in the dock loses focus the moment the seat is hidden and then stops receiving keys: the reported "can only type once" symptom. `shell.overlay` sits outside every scroll container, so no scroll-driven hiding can reach it. **Caveat:** that is a structural argument, not a verdict on one incident — the maid skin is currently `disabled` in this profile, so if the failure happened with no skin active, something else triggered it (see the revision note below).
- **Highlighting** uses `CSS.highlights` + `::highlight()`, degrading silently to scroll-and-flash where unsupported.
- **Locating** goes by `[data-chat-turn="N"]` because the host returns `turn` alongside each hit — steadier than parsing DOM structure.

One deviation from the original design, stated plainly: **UI preferences live in `localStorage['dsh.session-find.prefs.v1']`**, not in the DSH settings document. The client service catalog has no settings service (only layout / locale / sessions / slots / theme / timer / uiWorkspace / workspaces), and writing into DSH's settings would need an extra RPC endpoint that stores a file — not worth the risk for four checkboxes. Desktop `localStorage` is part of the persistent profile, so it survives restarts.

Verified against DSH desktop **0.2.1-rc.3**, Node 24. The `unicode61` behaviour described above is exactly what `@deepseek-ai/dsh-session-query-sqlite` does: `会话` does not match `我们来做会话上下文关键词查找`.

## Known limits

- In-session find only highlights hits **currently rendered**. Jumping to unloaded history calls `loadThrough` first, but how much one call pulls is up to DSH.
- Global scanning has a budget (30k text chunks by default). Past it the results truncate and the UI says "more results — narrow the query"; narrowing by time or workspace gets you the rest.
- Read-only. The plugin offers no write, delete or export.

## Development

```powershell
npm test                 # node --test, no third-party dependencies (28 assertions)
node test/smoke.mjs      # host RPC smoke test (22 assertions, fake ctx)
node test/realdata.mjs   # replay this machine's real session logs (optional, needs ~/.dsh/sessions)
```

Coverage: the three matcher modes and CJK boundaries, the extractor's event dispatch (including turn anchoring and title folding), and every host RPC endpoint (filtering, paging, caching, read-failure degradation, mid-scan cancellation).

`realdata.mjs` is a machine-local acceptance script: it decompresses the real `session.v4.jsonl.zstd` files under `~/.dsh/sessions`, presents them as a fake `sessionPersistence`, drives `apply()`, and checks every endpoint. On this machine: 222 sessions, 200 hits for `会话`, every hit carrying a turn anchor and a session title, a broad scan in 97 ms.

## License

MIT

## Acceptance record

Verified on this machine (Windows 10 desktop, DSH 0.2.1-rc.3, Node 24):

| Item | Result |
| --- | --- |
| `npm test` | 28 / 28 pass |
| `node test/smoke.mjs` | 22 / 22 pass |
| `node test/realdata.mjs` | all pass (222 sessions / 200 hits / 97 ms) |
| Host RPC channel `/dsh-find-session` | registered (unauthenticated probe returns 401, same as `/dsh-rewind`) |
| Sidebar icon + find page | mounted |
| `shell.overlay` find bar | mounted (order 40) |
| `conversation.session.header.actions` toggle | mounted (order 40) |
| `sidebar.right.pane.tab` results panel | mounted |
| `settings.section` settings card | mounted |
| `CSS.highlights` highlight + jump | needs one manual pass (see below) |

The final UI walk-through needs a human hand. Everything that can be verified without it is verified: the data path, route registration, all five mounts, and the matching and locating algorithms. What is left is three gestures — press Ctrl+F, see the bar; type, see the highlights; press Enter, land on the hit.

> 2026-10-27 revision: the find bar moved from `conversation.input.dock` to `shell.overlay`. The dock lives inside `[data-composer-seat]`, which a skin may hide and blur while the transcript scrolls, so the box lost focus after the first search and looked like it "only accepted one character". `shell.overlay` is outside every scroll container. `SearchInput` also switched to a local draft value plus an `isComposing` check, so a lagging store can no longer make React rewrite the keystrokes away.
