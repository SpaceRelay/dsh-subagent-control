# dsh-team-limits

**Set the Agent Team task limit and whether new sessions start with teams on.**

> English | [中文](README.md)

## When you need it

- The task board tops out at 256 and work starts queueing
- You do not want to switch Team collaboration on by hand in every new session
- You want the shipped values back without digging through config files

## Install

1. Open **Settings → Plugins → Market** and search for `dsh-team-limits`
2. Install it
3. **Quit DSH completely, then start it again**

Requires DSH 0.2.2 or newer.

## Where to change it

**Settings → Plugins → Installed → Team limits**:

| Setting | Shipped default | Meaning |
| --- | --- | --- |
| Tasks | 256 | How many tasks the shared board keeps at once |
| Teams on by default | Off | Whether a new session starts with Team collaboration on |

Edits are saved as you type — there is no Save button. As soon as a field differs from the shipped value, **Restore default** appears next to it.

## Good to know

- These settings live in DSH's configuration on this machine; they do not belong to this plugin.
- Members, message size and teardown timeout are handled by the subagent settings now, not here.
- Raising the task limit is not free: more tasks means more concurrent model sessions, and more tokens. Raise only what you need.

## FAQ

**Installed it and there is no page?** DSH was not fully quit. Quit from the tray and start it again.

**Changed a number and nothing happened?** Edits are written immediately and applied through the normal load path.

**How do I get the shipped numbers back?** Press **Restore default** on each field.

## Uninstall

Disable or remove it in the plugin panel. To restore the numbers as well, use **Restore default** first.

## Technical notes

How it works, where the two fields come from and how old config is cleaned up: [docs/implementation.en.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/team-limits/docs/implementation.en.md)

## License

MIT — see [LICENSE](./LICENSE). Issues: [github.com/SpaceRelay/dsh-subagent-control/issues](https://github.com/SpaceRelay/dsh-subagent-control/issues)
