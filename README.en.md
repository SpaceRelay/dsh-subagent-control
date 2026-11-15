# dsh-subagent-control

The subagents you started, still under your control.

You start three subagents to work in parallel. Ten minutes later all you remember is "there were three": which one is still running, and how far has it got? You want to add one sentence to one of them and there is no tool for it. One has gone off track and you can only wait for it to finish.

Looking, speaking and stopping are things DSH already knows how to do. Inside a team, though, those spots were taken by Agent Team's tools of the same name, so team members could not use them on their own subagents. This plugin registers three new names globally, so anyone can, including a team member managing what it started.

Once it is installed, the agent sees this:

```
list_subagents

3b0f9c1e  running   "review the patch"  depth=1
7d2a44b0  inactive  "check the tests"   depth=2
```

`running` means a turn is executing. `inactive` means no turn is running at this moment, not that the subagent is gone; a message wakes it up.

Direct children only by default; add `scope=descendants` to see the whole subtree. Team members are continuable subagents too, so they show up marked `team=teammate`; pass `include_teammates: false` if you only want the plain ones.

All three tools take very little:

| Tool | What it does | Parameters |
| --- | --- | --- |
| `list_subagents` | List the subagents you started | `scope`: `children` (default) or `descendants`; `include_teammates` defaults to `true` |
| `send_subagent_message` | Send one more message to a direct child | `subagent_id`, `message` |
| `interrupt_subagent` | Stop a subagent's current turn | `subagent_id` |

No restart is needed to install it: Settings → Plugins → Market, search for `dsh-subagent-control`, and the three tools work immediately. This package has no UI; plugins with a settings page are the ones that need a full quit and relaunch.

There are four optional extras, all off by default. Turn them on one at a time under Settings → Plugins → Installed → dsh-subagent-control; each one registers exactly one tool:

| Row in the panel | Tool | What it does |
| --- | --- | --- |
| Cross-layer relay | `relay_subagent_message` | Message a deeper descendant you cannot reach: delivered to the first hop, which is asked to forward it down |
| Wait for subagents | `wait_subagents` | Wait for subagents to finish in this turn instead of ending the turn first |
| Release subagents | `drain_subagents` | Stop and release direct children, freeing the run they occupy |
| Delegation budget | `subagent_budget` | Read-only report: depth limit, how many sit on each level, running and stopped counts |

Three more plugins sit alongside this one, each installed separately: `dsh-team-limits` adjusts the team limits DSH ships with, `dsh-human-wait` adjusts the PTC execution timer, and `dsh-find-session` is a UI plugin. All three change something that belongs to the host or to another plugin, so they should not switch on quietly with this package.

Wondering whether it works? Ask the agent to call `list_subagents` once. These tools are for the agent; no new button appears in the UI.

Only one or two shown? Direct children only by default; add `scope=descendants` for the whole tree.

Can an `inactive` one still be used? Yes. It just has no turn running at this moment; a message wakes it.

Does it clash with `dsh-subagent-library`? It does. Both register `list_subagents` and only one global registration can win, so pick one.

It only reads the subagent list: no files written, no network access, no configuration, and no dependencies.

Disable or remove it in the plugin panel and nothing is left behind.

Implementation details, the boundary with the built-in tools and the four components are in [docs/implementation.en.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/docs/implementation.en.md).

MIT, see [LICENSE](./LICENSE). Source and issues at [github.com/SpaceRelay/dsh-subagent-control](https://github.com/SpaceRelay/dsh-subagent-control).
