# dsh-team-limits

**Adjust Agent Team's member count, task count, message size and teardown timeout from the plugin page.**

> English | [中文](README.md)

## When you need it

- 16 team members by default, and that is not enough
- Tasks start queueing (256 by default)
- Long messages from subagents get truncated (64 KB by default)
- You want the shipped values back without digging through config files

## Install

1. Open **Settings → Plugins → Market** and search for `dsh-team-limits`
2. Install it
3. **Quit DSH completely, then start it again**

## Where to change it

**Settings → Plugins → Installed → Team limits** — four number fields:

| Setting | Shipped default | This page starts at |
| --- | --- | --- |
| Members | 16 | **32** |
| Tasks | 256 | **512** |
| Message size (bytes) | 65536 | **131072** |
| Teardown timeout (ms) | 5000 | 5000 |

Edits are saved as you type — there is no Save button. As soon as a field differs from the shipped value, **Restore default** appears next to it.

## Good to know

- **The values live in the profile's patch layer.** Uninstalling the bundle does not roll them back; use **Restore default** first if you want the stock numbers.
- **Raising limits is not free.** More members means more concurrent model sessions, each costing tokens and a session directory. Raise only what you need.
- A terminal-only profile does not render the page, but the limits still apply.

## FAQ

**Installed it and there is no page?** DSH was not fully quit. Quit from the tray and start it again.

**Changed a number and nothing happened?** Edits are written immediately and applied through the normal load path; if the plugin is an old version, reinstall it.

**How do I get the stock numbers back?** Press **Restore default** on each field.

## Uninstall

Disable or remove it in the plugin panel. To restore the numbers as well, use **Restore default** first.

## Technical notes

How it works, where the four fields come from and how the values are written: [docs/implementation.en.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/team-limits/docs/implementation.en.md)

## License

MIT — see [LICENSE](./LICENSE). Issues: [github.com/SpaceRelay/dsh-subagent-control/issues](https://github.com/SpaceRelay/dsh-subagent-control/issues)
