# dsh-find-session

**Press `Ctrl+F` to find any line in the conversation, or search every session at once.**

DSH loads a conversation in pages, so the browser's own find only sees what is already rendered — earlier turns are invisible to it. This plugin brings search into the conversation: hits are highlighted and you can step between them, or switch to **All sessions** and search your whole history.

> English | [中文](README.md)

## When you need it

- A long conversation, and you want to know "which step was it where we settled that plan"
- You remember discussing an error but not which session — search everything once
- You only want your own questions, without drowning in tool output

## Install

1. Open **Settings → Plugins → Market** and search for `dsh-find-session`
2. Install it
3. **Quit DSH completely, then start it again**

The last step is not optional: plugins are composed at boot, so reloading the page does nothing.

You can also install it from npm by the package name `dsh-find-session` (the plugin manager's "install from npm").

## Usage

| What you want | How |
| --- | --- |
| Find in the current conversation | `Ctrl+F`, type, highlighting follows; `Enter` next, `Shift+Enter` previous |
| Find in every session | `Ctrl+Shift+F`, or the **Find** icon in the left rail, then switch to **All sessions** |
| Check a hit before jumping | Click it to expand the preview (two events either side), then decide |
| Jump | Click **Open** — switches to that session and locates the turn |
| Read the conversation while browsing results | **Dock to sidebar** in the top-right of the Find page |
| Close the find bar | `Esc` |

Shortcuts are editable under **Settings → Shortcuts**.

## Settings

**Settings → Find**:

- **Default match mode**: substring / whole word / regex
- **Content scope**: body, tool calls and reasoning as three independent switches (body only by default)
- **Result limit**

## FAQ

**Installed it and nothing changed?** DSH was not fully quit. Quit from the tray and start it again; reloading the page is not enough.

**Only part of the current conversation is found?** In-session find highlights only what is rendered. Jumping to an earlier hit makes the plugin load history first, but how much one call pulls is up to DSH.

**Global results are truncated?** One scan has a budget (30k text chunks by default). Narrow the time range or workspace and it will cover everything.

**Can I search two Chinese characters?** Yes. The plugin does not tokenize — it matches by character, so `会话` finds `我们来做会话上下文关键词查找`.

## Privacy and cost

- Reads local session logs only; no network, nothing uploaded
- Never modifies a session, the profile, or the settings document
- A global scan reads at most 30k text chunks by default and tells you when results are truncated; results are cached, so repeating a query does not rescan

## Uninstall

**Settings → Plugins → Installed → `dsh-find-session`** → disable or uninstall, then restart DSH.

## Technical notes

Implementation, `cordis.patch.yml` overrides, tests and the acceptance record: [docs/implementation.en.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/dsh-find-session/docs/implementation.en.md)

## License

MIT
