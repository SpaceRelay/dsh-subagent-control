# dsh-find-session

Press `Ctrl+F` to find any line in a conversation, or search every session at once.

DSH loads a conversation in pages, so the browser's own find only sees the part already rendered; earlier turns are invisible to it. This plugin puts search inside the conversation: hits are highlighted and you can step between them, or switch to All sessions and search everything at once.

Installing takes a full quit and relaunch of DSH; plugins are composed at boot, so reloading the window will not do it. You can also install it from npm by the package name `dsh-find-session` in the plugin manager.

How to use it:

| What you want | How |
| --- | --- |
| Find in the current conversation | `Ctrl+F`, type, highlighting follows; `Enter` next, `Shift+Enter` previous |
| Find in every session | `Ctrl+Shift+F`, or the Find icon in the left rail, then switch to All sessions |
| Check a hit before jumping | Click it to expand the preview (two events either side), then decide |
| Jump there | Click Open to switch to that session and locate the turn |
| Read the conversation while browsing results | Dock to sidebar, top right of the Find page |
| Close the find bar | `Esc` |

Shortcuts are editable under Settings → Shortcuts.

Settings → Find has three options: default match mode (substring / whole word / regex), default content range (body, tool calls and reasoning as three independent switches; body only by default), and the per-search result limit.

Installed it and nothing changed? DSH was not fully quit. Quit from the tray and start it again; reloading the window is not enough.

Only part of the current conversation is found? In-conversation search highlights what is rendered. Jumping to an older hit loads history first, but how much loads at once is up to DSH.

The all-sessions results were truncated? One scan has a budget (30000 text blocks by default). Narrow the time range or the workspace and it will search more.

Can it find two Chinese characters? Yes. It does not tokenise; it matches substrings character by character, so `会话` finds "我们来做会话上下文关键词查找".

It only reads local session logs: no network, nothing uploaded, and it does not modify sessions or your profile. A global scan reads at most 30000 text blocks by default and tells you to narrow the query when it hits the budget; results are cached, so the same query is not rescanned.

Uninstall: Settings → Plugins → Installed → `dsh-find-session` → disable or remove, then restart DSH.

The implementation, the `cordis.patch.yml` overrides, tests and the acceptance record are in [docs/implementation.en.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/dsh-find-session/docs/implementation.en.md).

MIT.
