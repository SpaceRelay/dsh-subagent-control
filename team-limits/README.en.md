# dsh-team-limits

The four Agent Team limits, as numbers you can type.

16 team members by default, tasks queue up once there are many, and long messages coming back from subagents get truncated. Adjusting any of it used to mean finding the right line in a config file. Now the four numbers sit on a plugin page and apply as you type.

Installing it takes a full quit and relaunch of DSH. The plugin carries a settings page, and those are composed at boot, so refreshing the window will not show it.

Afterwards, Settings → Plugins → Installed → Team limits has four fields:

| Setting | Shipped default | This page starts at |
| --- | --- | --- |
| Members | 16 | 32 |
| Tasks | 256 | 512 |
| Message size (bytes) | 65536 | 131072 |
| Teardown timeout (ms) | 5000 | 5000 |

Edits save as you type; there is no Save button. Once a field differs from the shipped value, Restore default appears next to it.

Two things are worth knowing up front.

The values are stored in your profile's patch layer, so uninstalling this plugin does not put them back. To get the defaults back, press Restore default first, then uninstall.

Raising a limit is not free. Each extra member is another concurrent model session, spending tokens and holding a session directory. Raise what you actually need.

No page after installing? DSH was not fully quit; quit from the tray and start it again.

Changed a number and nothing happened? Edits are written immediately and applied through the normal load path. If you are on an old version of the plugin, reinstall it.

Want everything back at the shipped values? Press Restore default on each field.

A terminal-only DSH does not render the page, but the limits still apply.

Uninstalling is just disabling or removing it in the plugin panel. To restore the numbers as well, press Restore default first.

How it works, where the four fields come from and how the values are written are in [docs/implementation.en.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/team-limits/docs/implementation.en.md).

MIT, see [LICENSE](./LICENSE). Issues: [github.com/SpaceRelay/dsh-subagent-control/issues](https://github.com/SpaceRelay/dsh-subagent-control/issues).
