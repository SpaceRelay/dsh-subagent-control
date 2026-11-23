# Implementation notes

For anyone who wants to know what it actually does. Not needed for everyday use.

## Why the plugin exists

The official `subagent` tool only accepts `provider` / `model` arguments when the current
conversation recorded a `subagent/model-selection-policy` event at creation time. Without that
event the tool's rule is "the child must use exactly the parent's route". The event is written once,
on the condition `target.firstLiveSeq === 0 && target.eventAt(0)?.type !== 'session/end-seed'`, so a
conversation that already exists can never gain one.

The allow-list on the settings page exists to seed that event for new conversations. It cannot help
an old one.

## Why a second door instead of fixing the first

- The official tool's JSON Schema is generated from its config, and tool registration rejects
  duplicate names. Adding a field would mean replacing the whole definition — a fork of the official
  implementation.
- Writing a policy event into an existing conversation would mean rewriting the user's history. The
  projection only accepts the first event, and `append` requires the session to be inside a
  publication entry, so it is both fragile and dishonest.

The plugin therefore registers its own tool and calls `ctx.subagents.startActivation()` directly.
The policy gate lives only in the official tool's entry point, not in the service, so calls that
enter through the service are not subject to it.

## The tools

`subagent_route` arguments:

| Argument | Required | Meaning |
|---|---|---|
| `description` | yes | Short display label, same field name as the official `subagent` tool |
| `prompt` | yes | The complete task. The child does not see this conversation, so write it all out |
| `provider` | yes | Provider id |
| `model` | yes | Model id |
| `reasoning_effort` | no | Reasoning level; omitted means the model's own default |
| `name` | no | Short name for the child |
| `cwd` | no | Working directory for the child; defaults to this conversation's |

`list_routes` takes two optional arguments: `provider` alone lists that provider's models;
`provider` plus `model` also lists the reasoning levels that model supports.

When one named model is missing from the provider's list, the plugin does not declare it dead: it
calls `ctx.llm.resolveModelInfo(provider, model)` and asks the provider itself. The comment on that
call in DSH is explicit — `catalog membership remains advisory and does not control request
routing` — a model list is a catalogue, not a permission list. The two adapter families differ in
practice: the pi-ai side throws `UNKNOWN_MODEL` for an id it has no configuration for, while the
DeepSeek side accepts any id and merely downgrades to text-only without catalogue metadata. So a
route that resolves is shown with a note that the catalogue omitted it, and only a genuine refusal
is reported, carrying the provider's own reason. The full listing deliberately skips this probe:
running it for every model would resurface models the user chose to hide.

## Check the route before handing out work

Before doing anything, the tool calls `ctx.llm.resolveCallConfig({ provider, model, reasoningEffort })`
once. That single call answers three questions: does the provider exist, does the model exist, does
this model support this level. Any failure is thrown right there, so the user sees the original
`provider "X" model "Y" does not support reasoning effort "Z"` instead of a child that has already
started and cannot answer.

Only then is the `startActivation` request assembled: `agentOptions` carries just `provider`,
`model` and `reasoningEffort`. Everything else — the parent's preset, the depth limit — is filled in
by the subagent service itself.

`maxDepth` comes from `ctx.subagents.resolveMaxDepth()`, the same call the official tool makes: when
the setting is `'provider-managed'` nothing is passed, otherwise the current limit is.

## Reasoning level across a route change

A parent running at `max` does not drag that level onto another model, because the other model may
not have a `max` level at all. The rule: same route inherits the parent's level, a changed route
uses the new model's default, and an explicit `reasoning_effort` always wins.

This lives in the plugin's `preflightRoute` and mirrors the official `preflightChildLlmRoute`.

## The plugin's own allow-list

The settings page carries an "allowed channels" list, empty by default. Empty means everything
configured in this profile is allowed; tick entries to narrow it down.

It is not the same list as the official one in DSH settings. The official list is written into the
conversation record and only affects new conversations; this one is a runtime switch, takes effect
immediately, and governs only `subagent_route`.

The list is not typed in by hand: it is ticked out of the live model catalogue,
`ctx.remote.session.modelCatalog()` — the same source the official settings page reads — so renamed
providers and withdrawn models show up on their own. A route that is stored but no longer offered is
not silently dropped: it appears under "no longer offered" and only disappears from the config once
it is unticked. When the catalogue cannot be read the page shows the reason and a retry button
instead of an empty list.

Saving is one `form.mutate([{ op: 'set', path: ['allowedModels'], value }], snapshot.revision)` call,
fenced to the revision the page rendered. If the settings were changed elsewhere in the meantime the
write fails and the page asks for a fresh choice instead of overwriting silently.

## Configuration

| Setting | Default | Meaning |
|---|---|---|
| `allowedModels` | `[]` | Allowed routes; empty allows everything |

`allowedModels` is `volatile`: saving on the settings page takes effect without a restart. There is
no on/off setting — disable the plugin itself when you want it out of the way.

## Known costs

- Switching providers invalidates the cache; earlier turns are priced again. That is the physical
  cost of changing provider, unrelated to forking.
- Subagents still count against `maxDepth` and `maxActiveSubagents`.
- There is no fork variant. A fork copies this whole conversation to the child, and after a provider
  change that prefix is no longer cached — full price for a full replay, which is not worth it.

## Install paths

The usual way is **Settings → Plugins → Market**, search for `dsh-subagent-route`, install, then
quit DSH completely and start it again. During development the directory can be linked into a
profile's dependencies and installed with pnpm instead.

## Tests

`npm test` runs `test/plugin.test.mjs` and `test/client.test.mjs`. The first uses a fake host
context to cover route preflight, the allow-list, the `list_routes` fallback branches (an unreadable
catalogue, a named model the catalogue omits but the provider accepts, a named model the provider
refuses) and the rendered text; the second loads `client.js` the way `window.__ModuleLoader__` does, mounts the settings page
on a fake React that runs state and effects, and walks the catalogue groups, restoring stored ticks,
keeping a withdrawn route, what a save writes and the revision it carries, retrying a failed
catalogue, the summary view and the "settings service missing" path.

## Acceptance record

Verified on a real desktop instance, in three levels:

- 35 unit tests, all green.
- In an isolated instance, `list_routes` listed this machine's providers and models; a subagent
  started by `subagent_route` recorded the requested provider, model and reasoning level; a route
  left out of the allow-list was refused with `route "X/Y" is not in this plugin's allow-list`; an
  unknown provider was stopped before any child was created.
- In a conversation created two weeks earlier that had never recorded a policy event, the plugin
  sent a subagent to another provider and the result came back; the same conversation, using the
  official `subagent` tool with the same route, was refused by the policy gate.

## Uninstall

The plugin patches no official file and writes no events into user sessions. The official subagent
tool runs as before once it is gone. Ticks saved from the settings page stay in your DSH settings;
delete the `allowedModels` entry if you want them gone.