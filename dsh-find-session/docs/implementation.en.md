# dsh-find-session — implementation notes

For maintainers. User-facing docs live in [../README.en.md](../README.en.md).

## Relation to the official engine

DSH ships a session search (`dsh-experimental-session-search`) — a **model-side** tool for finding leads across past sessions. It is meant for the AI, not for a human pressing `Ctrl+F`. This plugin covers the human half.

The official engine goes through SQLite FTS5 with the `unicode61` tokenizer, which treats a whole run of CJK characters as one token. Searching `会话` therefore never matches `我们来做会话上下文关键词查找`. This plugin skips FTS5 and matches by code point: substring / whole word / regex, so two Chinese characters are enough.

## Structure

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

## Config overrides

The row defaults are enough for most people; to change them, override in the profile's `cordis.patch.yml`:

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

## Installing from a tarball (developers)

The plugin is an ordinary DSH bundle (one host row plus a browser half). Besides the market, it can be installed from a tarball: add the dependency and the bundle name to `<DSH_HOME>/profiles/<profile>/package.json`, then run pnpm:

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

An Electron-managed profile cannot be started from the `dsh` CLI (it fails with `profile "desktop" is managed exclusively by the Electron application`); quit from the tray and relaunch.

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
| `CSS.highlights` highlight + jump | pending one desktop click-through (see note below) |

The last UI pass needs a human click. Everything the implementation can verify is verified: the data path, route registration, the five mount points, and the matching and locating algorithms.

## Revision notes

> 2026-10-27: the find bar moved from `conversation.input.dock` to `shell.overlay`. The dock lives inside `[data-composer-seat]`, and a skin can hide and blur that seat while the transcript scrolls, which left the input unfocused after the first search — the "can only type once" symptom. `shell.overlay` sits outside the scroll containers and is unaffected. `SearchInput` also switched to a local draft value plus an `isComposing` check, so a lagging store cannot write back over keystrokes.

> 2026-11-15: the README split into a user-facing one and these maintainer notes.
