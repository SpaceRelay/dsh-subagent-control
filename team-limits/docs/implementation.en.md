# dsh-team-limits — implementation notes

For maintainers. User-facing docs live in [../README.en.md](../README.en.md).

## What it changes

The bundle attaches to the shipped `agent-team` row and turns four limit fields into editable values. Shipped defaults:

| Field | Shipped default | This bundle |
| --- | --- | --- |
| `maxMembers` | 16 | 32 |
| `maxTasks` | 256 | 512 |
| `maxMessageBytes` | 65536 | 131072 |
| `disposalTimeoutMs` | 5000 | 5000 |

## Structure

- `index.js` — the host half. Declares a `Config` (all four fields `.volatile()`) and, in `apply`, pushes the current values onto the `agent-team` row through `ctx.configEditor`: `configuration()` finds the row, `edit(entry, current => ({ ...current, ...values }))` writes it. `edit()` runs inside `hmr.runExclusive(...)`, and a plugin's `apply` already runs inside an HMR transaction, so calling it directly throws `HMR transactions cannot be nested`; the push is therefore wrapped in `ctx.get('hmr').executing.exit(...)`.
- `client.js` — the browser half, hand-written with no build step, registered on the `plugins.bundle.config` slot with key `dsh-team-limits`. The page reads and writes values through `ctx.configForms`, and each field carries an "overridden" marker plus "restore default".
- `cordis.patch.yml` — inserts one `team-limits` row (a placeholder component so the package has a mountable entry and a listed component) and **holds no numbers**.

## Why the patch has no numbers

Before 1.2.0 the numbers were written straight into the patch as an `agent-team` override. Two problems: a DSH upgrade that changed the shipped defaults would silently resurrect old numbers, and users could not change anything from the UI. Now the values live only in the profile's patch layer (written by `configEditor`), and this package's own patch stays empty.

## How a change takes effect

1. The user edits a field → the client writes it back to `Config` → `apply` pushes it with `configEditor.edit()` into the profile patch layer
2. The Loader's normal reconciliation re-applies the `agent-team` row
3. All four fields are volatile: a change does not remount the plugin, and the plugin polls every 1.5 s to notice it and push again

## Uninstall behaviour

Uninstalling does not roll the values back — they belong to the profile's patch layer, not to this bundle. To restore the shipped values, press **Restore default**, or delete the `config` under the `agent-team` row in the profile patch.

## Tests

```powershell
node test/smoke.mjs
```

Coverage: registry shape, the four defaults, the parameters of the push, and degradation when `configEditor` is absent.
