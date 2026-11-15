# dsh-subagent-control — implementation notes

For maintainers. User-facing docs live in [../README.en.md](../README.en.md).

## Why these three tools exist

The Harness ships `list_agents`, `send_message` and `interrupt_agent`. When the Agent Team bundle is active, it registers tools with **those same three names** in every team member's exact Agent scope, and the more specific registration wins. Inside a teammate scope the team versions take over: they resolve `target` against the team roster only, and interrupting is a Lead-only operation.

The result: a teammate can start a subagent with `subagent`, but cannot list it, follow up with it, or stop it — even though the subagent service (`ctx.subagents`) has supported all three for any live agent all along, and its authority rules already allow an ancestor to manage its own descendants.

This bundle does not fight over the taken names. It registers three **new** names, globally, so the Lead and every teammate get them at once.

## Tools and the calls underneath

| Tool | Parameters | Underlying call |
| --- | --- | --- |
| `list_subagents` | `scope?`: `children` \| `descendants` (default `children`); `include_teammates?` (default `true`) | `ctx.subagents.listChildren()` / `listDescendants()` |
| `send_subagent_message` | `subagent_id`, `message` (both required) | `ctx.subagents.sendMessage()` |
| `interrupt_subagent` | `subagent_id` (required) | `ctx.subagents.interrupt()` with ancestor authority |

Each listing line is `id  status  "label"  depth=`; `status` comes from `ctx.agents.get(id)?.status === 'running'`.

## Behaviour and limits

- **One-shot subagents are hidden.** They cannot accept a follow-up message, so listing them would only invite a call that is guaranteed to fail.
- **A broken record is reported, not thrown.** A child whose state cannot be read comes back as a diagnostic entry (`corrupt` / `unsupported` / `unavailable`) instead of turning the whole listing into an error.
- **`send_subagent_message` reaches direct children only.** That is the service's own rule; the plugin does not widen it.
- **`interrupt_subagent` reaches descendants**, so a team Lead can also stop a grandchild.
- **Every failure names its cause**: no calling agent, unknown id, or an id that is not yours.
- **No config, no storage.** The bundle writes nothing and reads nothing outside the three services.

## Compatibility

- DSH with the `tools`, `subagents` and `agents` services (0.2.x and later).
- Node `^22.19.0 || >=24.0.0`.
- **Zero dependencies** — no runtime dependency, no peer dependency, not a single `import`. The tools are plain tool-table objects with explicit JSON Schemas, so they install and behave identically from npm or from a linked checkout.

## Name collisions

`dsh-subagent-library` also registers a global `list_subagents` tool. Two global registrations of one name cannot both win: install one of them, or remember that the other may shadow this one.

The three new names were chosen precisely because they do **not** collide with the built-in `list_agents` / `send_message` / `interrupt_agent`.

## Installing as a developer

Through the plugin panel / market, or with `plugin_manager install_bundle`. From a checkout, pass the **directory path** instead of the npm spec. A host-side plugin applies immediately — no restart — and the three tool names are visible right away.

## The four optional components

Four extra tools ship as **separate components**, each with its own row and switch in the plugin panel (Cross-layer relay, Wait for subagents, Release subagents, Delegation budget). All four start disabled; turning one on registers exactly one tool.

| Component | Tool | What it does | Risk |
| --- | --- | --- | --- |
| Cross-layer relay | `relay_subagent_message` | Best-effort message to a deeper descendant: delivered to the first hop with a request to forward it down | intermediate agents may summarize; not guaranteed |
| Wait for subagents | `wait_subagents` | Wait for descendants (bounded by `timeout_seconds`) instead of ending your turn first | blocks up to the timeout |
| Release subagents | `drain_subagents` | Stop **and release** direct children, unlike `interrupt_subagent`, which only stops the current turn | a released child is not woken by a message |
| Delegation budget | `subagent_budget` | Read-only report: depth limit, how deep the tree goes, running/inactive counts | none |

## Tests

```powershell
npm test    # node test/smoke.mjs && node test/smoke-extras.mjs
```

Coverage: registry shape, projection and rendering, the parameters of the three service calls, the error when there is no calling agent, and that each of the four components mounts alone and registers exactly one tool.
