# dsh-subagent-control

**Lets any agent — including a team member — list, steer and stop the subagents it started.**

`list_subagents` · `send_subagent_message` · `interrupt_subagent`

> English | [中文](README.md)

## When you need it

- You started a few subagents to work in parallel and want to know who is still running
- You want to add one sentence to a subagent that is already working
- You want to stop the one that went off track
- Inside a team, a Lead's grandchildren should still be manageable top-down

## The three tools

| Tool | What it does | Parameters |
| --- | --- | --- |
| `list_subagents` | List the subagents you started | `scope`: `children` (default, direct children) / `descendants` (the whole subtree); `include_teammates`: `true` by default |
| `send_subagent_message` | Send one more message to a direct child | `subagent_id`, `message` |
| `interrupt_subagent` | Stop a subagent's current turn | `subagent_id` |

It looks like this:

```
list_subagents
→ 3b0f9c1e  running  "review the patch"  depth=1

list_subagents scope=descendants
→ 3b0f9c1e  running  "review the patch"  depth=1
  7d2a44b0  inactive "check the tests"    depth=2

send_subagent_message subagent_id=3b0f9c1e message="also look at locale/zh.json"
→ messageId=...

interrupt_subagent subagent_id=3b0f9c1e
→ accepted=true
```

Each line is `id  status  "label"  depth=`. `running` means a turn is executing; `inactive` only means no turn is running right now — **the subagent is still there**, and a message wakes it.

Team members are continuable subagents too, so they show up in the list marked `team=teammate`. Pass `include_teammates: false` when you only want the plain subagents you started.

## Install

1. Open **Settings → Plugins → Market** and search for `dsh-subagent-control`
2. Install it
3. **No restart needed** — this is a host-side plugin, and the three tools are available immediately

Plugins with a settings page need a full quit and relaunch; this one does not.

## Optional features (four, off by default)

| Row in the panel | Tool | What it does |
| --- | --- | --- |
| Cross-layer relay | `relay_subagent_message` | Message a deeper descendant: delivered to the first hop with a request to forward it down |
| Wait for subagents | `wait_subagents` | Wait for subagents in this turn instead of ending it first |
| Release subagents | `drain_subagents` | Stop and release direct children, freeing the run they occupy |
| Delegation budget | `subagent_budget` | Read-only report: depth limit, how many sit on each level, running / stopped |

Turn them on one by one under **Settings → Plugins → Installed → `dsh-subagent-control`**; each one registers exactly one tool.

## Related plugins

- [dsh-team-limits](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/team-limits) — make the Agent Team limits editable fields on the plugin page
- [dsh-human-wait](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/human-wait) — keep PTC mode from burning its budget while you answer
- [dsh-find-session](https://github.com/SpaceRelay/dsh-subagent-control/tree/main/dsh-find-session) — find text in the conversation or across every session

All three install separately: they override a shipped row or another plugin's behaviour, and that should never happen implicitly.

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

Implementation, the boundary with the built-in tools, the four components and the tests: [docs/implementation.en.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/docs/implementation.en.md)

## License

MIT — see [LICENSE](./LICENSE). Source and issues: [github.com/SpaceRelay/dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control).
