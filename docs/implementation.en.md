# dsh-subagent-control — implementation notes

For maintainers. User-facing docs live in [../README.en.md](../README.en.md).

## Why these three tools are still useful

The Harness ships `list_agents`, `send_message` and `interrupt_agent`, and those are the tools to prefer. What they leave open: `list_agents` lists the whole tree from the root and offers no "only the ones I started" filter; `send_message` addresses any agent in the same tree by name; `interrupt_agent` is disabled in the shipped configuration.

As of DSH 0.2.2 the Agent Team bundle no longer registers tools with the shipped names, and team membership is ordinary subagent ancestry, so there is no team marker to resolve. This bundle fills those three gaps and nothing else.

## Tools and the calls underneath

| Tool | Parameters | Underlying call |
| --- | --- | --- |
| `list_subagents` | `scope?`: `children` \| `descendants` (default `children`) | `ctx.subagents.listDescendants()`, keeping `depth === 1` by default |
| `send_subagent_message` | `subagent_id`, `message` (both required) | `ctx.subagents.sendMessage()` |
| `interrupt_subagent` | `subagent_id` (required) | `ctx.subagents.interrupt()` with ancestor authority |

Each listing line is `id  status  "label"  depth=`; `status` comes from `ctx.agents.get(id)?.status === 'running'`.

## Behaviour and limits

- **One-shot subagents are hidden.** They cannot accept a follow-up message, so listing them would only invite a call that is guaranteed to fail.
- **A broken record is reported, not thrown.** A child whose state cannot be read comes back as a diagnostic entry (`corrupt` / `unsupported` / `unavailable`) instead of turning the whole listing into an error.
- **`send_subagent_message` reaches any agent in the same tree.** That is the service rule as of 0.2.2, and the plugin does not widen it; the shipped `send_message` does the same thing, addressed by name.
- **`interrupt_subagent` reaches descendants**, so any ancestor can also stop a grandchild.
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

## The two optional components

Two extra tools ship as **separate components**, each with its own row and switch in the plugin panel (Wait for subagents, Delegation budget). Both start disabled; turning one on registers exactly one tool.

| Component | Tool | What it does | Risk |
| --- | --- | --- | --- |
| Wait for subagents | `wait_subagents` | Wait for the whole subtree (bounded by `timeout_seconds`) instead of ending your turn first | blocks up to the timeout |
| Delegation budget | `subagent_budget` | Read-only report: depth limit, how deep the tree goes, running/inactive counts | none |

## Tests

```powershell
npm test    # node test/smoke.mjs && node test/smoke-extras.mjs
```

Coverage: registry shape, projection and rendering, the parameters of the three service calls, the error when there is no calling agent, and that each of the two components mounts alone and registers exactly one tool.
