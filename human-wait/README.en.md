# dsh-human-wait

**Stops the PTC `run_code` deadline while DSH is waiting for you.**

PTC mode wraps the whole program — including any question, plan review or approval raised mid-run — in one 120-second wall clock. Think a little too long and the run is already gone:

```
Error: code run failed (timeout): execution deadline reached (120000ms)
```

and the question card is reported as **interrupted**. With this plugin, the time you spend answering is no longer charged to that budget; a runaway program is still cut off when the budget runs out.

> English | [中文](README.md)

## When you need it

- You run programs in PTC mode that ask you questions or need approvals, and you want to read before answering
- You have seen a question card flip to "interrupted", or the timeout above

## What it changes, and what it does not

| Situation | Without it | With it |
| --- | --- | --- |
| A question inside the run, answered in 20 s | fine | fine |
| Same run, answered after 4 minutes | aborted at 120 s, question shown as interrupted | keeps waiting, the answer is delivered |
| Never answered | aborted at 120 s | aborted once the wait hits the cap (24 h by default) |
| A program that spins for 10 minutes without asking anything | aborted at 120 s | aborted at 120 s — unchanged |

## Install

1. Open **Settings → Plugins → Market** and search for `dsh-human-wait`
2. Install it
3. **Quit DSH completely, then start it again**

## Settings

**Settings → Plugins → Installed → Human wait**:

- **Longest wait** (24 hours by default; "unlimited" removes the cap)
- Quick buttons: 1 hour / 24 hours / unlimited
- **Restore default** appears once the field differs from the shipped value
- A one-line summary sits on the card

A change takes effect in about 1.5 seconds, no restart.

## FAQ

**It still timed out?** Check three things: the session header shows the `PTC` badge; the plugin's `enabled` is not set to false in the profile patch; the log has a line starting with `[dsh-human-wait]`. If the wrapper did not see that wait, it cannot pause for it.

**The error kind became `abort`?** Expected. The plugin aborts through its own signal, so the runtime classifies it as `abort` instead of `timeout`; the text still contains `execution deadline reached`.

**Does it affect standard sessions?** No. Standard sessions never had this timeout — they wait indefinitely by design.

## Privacy and cost

- Wraps three host service calls in memory only; writes no files and opens no network connections
- Does not modify the conversation, and does not change the program's own execution budget

## Uninstall

Disable or remove it in the plugin panel, then restart DSH; the host's original methods come back.

## Technical notes

How it works, the two settings, the fail-open behaviour and the acceptance record: [docs/implementation.en.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/human-wait/docs/implementation.en.md)

## License

MIT — see [LICENSE](./LICENSE). Issues: [github.com/SpaceRelay/dsh-subagent-control/issues](https://github.com/SpaceRelay/dsh-subagent-control/issues)
