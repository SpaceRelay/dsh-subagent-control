# Changelog

## 1.0.1 — 2026-11-24

- `list_routes` no longer calls a model missing when only its catalogue is. Asking about one named
  model now goes to the provider itself: if the provider accepts the route, the model is shown with
  its reasoning levels and a note that the catalogue omitted it; if the provider refuses, the note
  carries the provider's own reason. A model list is a catalogue, not a permission list — adapters
  are free to accept ids they never advertise, and a hidden or not-yet-synced catalogue used to look
  like a dead route.
- The reasoning-level copy shared by both paths moved into one helper; behaviour is unchanged.
- 35 unit tests, all green.

## 1.0.0 — 2026-11-24

First release.

- `subagent_route` starts a subagent on a provider and model named in the call, in any
  conversation, including ones that already existed. The route is checked with a single
  `llm.resolveCallConfig()` before the child is created, so a wrong provider, a wrong model or an
  unsupported reasoning level fails immediately.
- `list_routes` lists the providers and models this machine can reach, and reads one model's
  reasoning levels on request. A provider whose catalog cannot be read still appears, with a note
  instead of a model list.
- A settings page whose allow-list is ticked out of the live model catalogue, provider by
  provider, rather than typed in by hand. Empty means every configured route is allowed. A stored
  route the provider no longer offers stays listed so it can still be unticked, and a catalogue that
  cannot be read says why and offers a retry. There is no on/off switch: disable the plugin instead.
- When the route changes, the parent's reasoning level is not carried over — the new model may not
  have it. An explicit `reasoning_effort` always wins.
- The official `subagent` tool is untouched; no official file is patched and no event is written
  into user sessions.