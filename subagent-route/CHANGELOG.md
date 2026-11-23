# Changelog

## 1.0.2 — 2026-11-24

- The preflight description now matches what it actually rejects. Both the tool description and the
  comments say it catches a provider nothing is registered for and a reasoning level the model does
  not offer; they no longer claim that an unknown model id is caught. Catalogues are advisory, and
  an adapter such as the DeepSeek one accepts an id it never advertised and degrades instead of
  refusing — that was measured, not assumed. `list_routes` remains the way to check a model id
  before sending work to it.
- Adds `assets/icon-256.png` for storefronts that only accept a GitHub-hosted raster image. The
  `icon.svg` shipped in `package.json` is unchanged, so the in-app icon looks the same.
- 35 unit tests, all green.

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
  `llm.resolveCallConfig()` before the child is created, so an unknown provider or an unsupported
  reasoning level fails immediately. A model id the catalog does not list is not refused on that
  basis: catalogs are advisory, and the DeepSeek adapter accepts such ids and degrades them.
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