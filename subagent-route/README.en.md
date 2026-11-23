# dsh-subagent-route

**Send one subagent to another provider or another model — in any conversation, including ones that already exist.**

When DSH starts a subagent it carries a note saying which provider and model to use. That note only has two sources today: the allow-list you ticked when the conversation was created, or the model you happen to be using. A conversation that has been open for weeks has neither, so its subagents are stuck on the main model.

This plugin adds a third source: name the route when you hand out the work.

> English | [中文](README.md)

## When you need it

- A conversation you have been in for a long time, and you want one subagent to take a side job on another provider without starting a new conversation for it
- The main conversation runs an expensive model for reasoning while the subagents only collate notes and run tests, and you want those on a cheaper route
- Two subagents on two different providers, so you can compare how each one does the same task
- A provider you just configured, and you want to try it with a subagent instead of switching the main conversation over

## Install

1. Open **Settings → Plugins → Market** and search for `dsh-subagent-route`
2. Install it
3. **Quit DSH completely, then start it again**

Do not skip the last step: plugins are assembled at startup, so reloading the page is not enough. You can also install it from npm by package name.

## Using it

Once installed, the model driving the conversation sees two tools: `subagent_route` hands out work and names the provider and model, and `list_routes` lists what this machine can actually reach.

Say which provider, which model, and what the work is. The example below uses the DeepSeek channel that ships with DSH:

```
Spawn a subagent on deepseek-official / deepseek-flash and have it find typos in every md file under docs/
```

`deepseek-flash` appears in the UI as DeepSeek-V4.1-Flash. To use another channel, replace `deepseek-official` and `deepseek-flash` with the provider id and model id on your machine — if you sign in with a DSH account, the built-in DeepSeek route is `deepseek-account`. If you are not sure how an id is spelled, ask it to list them first:

```
List the routes this machine can reach
```

Nothing else changes. The official `subagent` tool is untouched and behaves exactly as it does without the plugin, and existing conversations are not rewritten.

## Settings

**Settings → Plugins → Installed → Subagent route**:

That page has one job: **Allowed channels**. It lists the providers and models on your machine, and only the ones you tick can be used.

- Nothing ticked means no restriction: every provider and model configured on this machine can be used. That is the default
- Tick a few and only those are allowed; anything else is refused, and the error names what you did allow
- Routes you ticked earlier that the provider no longer offers are listed separately under "no longer offered" and can still be unticked
- If the model list cannot be read, the page says why and offers a retry

A one-line summary sits on the card: "No restriction", or "Only N route(s)".

Press **Save** to apply an edit. No restart is needed, and subagents that are already running are not affected.

When you want the plugin out of the way, just disable it — there is no switch to hunt for on this page.

## FAQ

**Is another provider more expensive?** Switching providers means everything said earlier has to be priced again, because the cache does not carry over. This tool suits work that is handed out and done on its own, not a subagent that continues the main conversation.

**Why not just tick the models on the DSH settings page?** That only affects conversations created afterwards, and it commits a whole list at once. This plugin is for "I want this one changed, right now".

**How does it relate to the "allowed models" list in DSH settings?** They are separate. That list reserves routes for new conversations; this plugin opens a second door at runtime, meant for the old ones.

**It says the channel has no such model. Should I believe it?** Just try the route. A model list is a catalogue, not a permission list — some channels happily call ids they never advertise. So when you ask about one named model the plugin asks the provider itself: if the provider accepts it, the model is shown with a note that the catalogue omitted it; only a real refusal is reported, with the provider's own reason.

**Does it really work in an existing conversation?** Yes. The plugin hands the provider and model to the DSH subagent service itself, so it does not go through the note recorded when the conversation was created.

**Does uninstalling leave anything behind?** No. It patches no official file, and the official subagent tool runs as before once it is gone. Ticks saved from the settings page stay in your DSH settings; delete that one entry if you want them gone.

## Privacy and cost

The plugin makes no network calls and collects nothing. It writes no files of its own. All it does is pass a provider name and a model name to the DSH subagent service. Any subagent it starts is billed by the provider you picked.

## Uninstall

**Settings → Plugins → Installed → `dsh-subagent-route`** → disable or remove it, then restart DSH.

## Technical details

How it works, the two settings and the acceptance record: [docs/implementation.en.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/subagent-route/docs/implementation.en.md). Notes from before the work started: [docs/exploration.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/subagent-route/docs/exploration.md).

## Licence

MIT, see [LICENSE](./LICENSE). Issues: [github.com/SpaceRelay/dsh-subagent-control/issues](https://github.com/SpaceRelay/dsh-subagent-control/issues)