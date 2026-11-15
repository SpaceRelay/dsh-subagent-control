# dsh-team-limits — implementation notes

For maintainers. User-facing docs live in [../README.en.md](../README.en.md).

## What it changes

Since DSH 0.2.2 the shipped `@deepseek-ai/dsh-agent-team` row (called
`@deepseek-ai/dsh-experimental-agent-team` before 0.2.2) takes exactly two limit fields:

| Field | Shipped default | This bundle |
| --- | --- | --- |
| `maxTasks` | 256 | 256 |
| `defaultEnabled` | false | false |

0.2.2 also dropped `maxMembers`, `maxMessageBytes` and `disposalTimeoutMs`: teammates are plain
subagents now, so team size belongs to the subagent-side `maxActiveSubagents` / `maxDepth`, and the
message-size and teardown knobs went away with the old implementation.

## Structure

- `index.js` — the host half. Declares a `Config` with two `.volatile()` fields and, in `apply`,
  pushes the current values onto the `agent-team` row through `ctx.configEditor`:
  `configuration()` finds the row, `edit(entry, current => nextOverride(...))` writes it. `edit()`
  runs inside `hmr.runExclusive(...)` while a plugin's `apply` already runs inside an HMR
  transaction, so calling it directly throws `HMR transactions cannot be nested`; the push is wrapped
  in `ctx.get('hmr').executing.exit(...)`. Pushes retry three times (1.3 s / 4 s / 8 s), and a 1.5 s
  poll picks up edits made on the page, which do not remount the plugin because the fields are
  volatile.
- `client.js` — the browser half, hand-written with no build step, registered on the
  `plugins.bundle.config` slot with key `dsh-team-limits`. One number field (task limit) and one
  switch (teams on by default); edits stay in a local draft until **Save** writes them back to
  `Config` (**Discard changes** drops the draft), each field with an "overridden" chip and
  "restore default", plus a card summary such as `1024 tasks · off by default`.
- `cordis.patch.yml` — inserts one `team-limits` row and holds no numbers.

## Why the removed keys must be deleted

The 0.2.2 `TeamService` iterates `REMOVED_CONFIG_KEYS = ['maxMembers', 'maxMessageBytes',
'disposalTimeoutMs']` while constructing and throws on the first hit:

```
agent-team: <key> is no longer supported; teammates are subagents, so subagent limits and inbox
delivery apply
```

So a push cannot merely add our two values — it must remove the three old keys from the row's
override, or a user upgrading from 1.3.x ends up with a team row that refuses to load.
`nextOverride()` does that, and `alreadyApplied()` treats "an old key is still present" as not yet
done, so the cleanup happens exactly once.

## How a change takes effect

1. The user edits a field → the value goes back into this plugin's `Config` → the `push` triggered by
   `apply` (or by the poll) writes it into the profile's patch layer with `configEditor.edit()`
2. The Loader's normal reconciliation re-applies the `agent-team` row
3. This plugin's own two fields are volatile, so its own config never remounts it; the `agent-team`
   row's fields are not volatile, so a write reloads that row once (steady state writes nothing)

## Version boundary

Installing 1.3.x on 0.2.2 pushes three fields the row no longer accepts and trips
`TEAM_INVALID_CONFIG`. 2.0.0 therefore narrows `engines.dsh` to `>=0.2.2-rc.1 <0.3.0-0`; users on
0.2.1 stay on 1.3.x.

## Uninstall behaviour

Uninstalling does not roll the values back — they belong to this machine's DSH configuration, not to
this bundle. To restore the shipped values, press **Restore default** first.

## Tests

```powershell
npm test    # runs node test/smoke.mjs
```

Coverage: the `Config` shape (when schemastery can be loaded), removal of the three old keys on push,
"already applied" not writing again, and the fail-open path when `configEditor` is absent.
