# dsh-subagent-control

**Lets any agent list, steer and stop the subagents it started.**

`list_subagents` · `send_subagent_message` · `interrupt_subagent`

> English | [中文](README.md)

This repository holds five packages, each installed on its own. You are reading the first one: the subagent tools for agents. The other four are listed under Related plugins below.

In DSH an agent can hand part of the work to another agent; the one that takes it is called a subagent. This plugin lets the agent that handed the work out see those subagents, send them another line, and stop them.

## When you need it

- You started a few subagents to work in parallel and want to know who is still running
- You want to add one sentence to a subagent that is already working
- You want to stop the one that went off track
- A subagent started another level down, and you still want to manage it from above

## The three tools

| Tool | What it does | Parameters |
| --- | --- | --- |
| `list_subagents` | List the subagents you started | `scope`: `children` (default, direct children) / `descendants` (the whole subtree) |
| `send_subagent_message` | Send one more message to a subagent | `subagent_id`, `message` |
| `interrupt_subagent` | Stop a subagent's current turn | `subagent_id` |

Once it is installed, one `list_subagents` call returns a line per subagent:

```
3b0f9c1e  running   "review the patch"  depth=1
7d2a44b0  inactive  "check the tests"   depth=2
```

Left to right: the id, the current status, the task in quotes, and the depth. `depth=1` is one you started, `depth=2` is one it started. `running` means a turn is executing; `inactive` only means no turn is running at this moment, not that the subagent is gone, and a message wakes it.

Messaging and stopping are simpler still: `send_subagent_message` takes an id and one sentence, `interrupt_subagent` takes just the id, and they return a message id and whether the request was accepted.

## Install

1. Open **Settings → Plugins → Market** and search for `dsh-subagent-control`
2. Install it
3. **No restart needed** — this is a host-side plugin, and the three tools are available immediately

Plugins with a settings page need a full quit and relaunch; this one does not.

## Optional features (two, off by default)

| Row in the panel | Tool | What it does |
| --- | --- | --- |
| Wait for subagents | `wait_subagents` | Wait for the whole subtree in this turn instead of ending it first |
| Delegation budget | `subagent_budget` | Read-only report: depth limit, how many sit on each level, running / stopped |

Turn them on one by one under **Settings → Plugins → Installed → `dsh-subagent-control`**; each one registers exactly one tool.

## Related plugins

- [dsh-team-limits](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/team-limits) — set the Agent Team task limit and whether new sessions start with teams on
- [dsh-human-wait](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/human-wait) — stop the 120-second run limit from expiring while DSH waits for your answer, plan review or approval
- [dsh-find-session](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/dsh-find-session) — find text in the conversation or across every session
- [dsh-subagent-route](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/subagent-route) — send a subagent to another provider or model, from any conversation

They each do one thing, so they are four separate packages: install the one you want. None of them come with this package.

## FAQ

**How do I confirm it works?** Ask the agent to call `list_subagents` once. These tools are for the agent — no new button appears in the UI.

**Why does it list only one or two?** It lists direct children by default. Use `scope=descendants` for the whole tree.

**Can an `inactive` subagent still be used?** Yes. It just has no turn running; a message wakes it.

**Does it clash with `dsh-subagent-library`?** Both register `list_subagents`, and only one global registration can win — pick one.

## Privacy and cost

- Reads the subagent registry only; writes no files, opens no network connections, ships no config
- Zero dependencies

## Uninstall

Disable or remove it in the plugin panel. Nothing is left behind.

## Technical notes

Implementation, the boundary with the built-in tools, the two components and the tests: [docs/implementation.en.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/docs/implementation.en.md)

## License

MIT — see [LICENSE](./LICENSE). Source and issues: [github.com/SpaceRelay/dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control).
