# dsh-human-wait

The PTC clock pauses while you are answering.

PTC (that is, `run_code`) wraps the whole program in a 120-second budget, and any question, plan review or approval raised mid-run counts against it. Think for three minutes and you come back to:

```
Error: code run failed (timeout): execution deadline reached (120000ms)
```

with the question card marked interrupted. This plugin does one thing: the time you spend answering is not charged to that budget. A program that goes off and spins is still cut off when the budget runs out.

With it installed, four situations behave like this:

- A question inside the program, answered in 20 seconds: same as before.
- Same program, answered after 4 minutes: it used to be aborted at 120 seconds; now it keeps waiting and the answer is delivered.
- You never answer: it stops at the cap you set (24 hours by default) instead of hanging forever.
- The program spins in a loop regardless of you: aborted at 120 seconds, unchanged.

Installing takes a full quit and relaunch of DSH; the plugin has a settings page.

Settings → Plugins → Installed → Human wait has one Longest wait field (24 hours by default; unlimited removes the cap) with 1 hour / 24 hours / unlimited buttons beside it. Once the value differs from the shipped one, Restore default appears, and the card shows a one-line summary. A change applies in about 1.5 seconds, no restart.

Still timed out? Check three things: the session header shows the PTC badge, the plugin is not turned off with `enabled: false` in the profile patch, and the log has a line starting with `[dsh-human-wait]`. If the plugin did not see that particular wait, it could not pause for it.

Did the error kind become `abort`? That is expected. The plugin aborts through its own signal, so the runtime classifies it as `abort` rather than `timeout`; the text still contains `execution deadline reached`.

Do standard sessions change? No. They never had this timeout; they wait for you indefinitely by design.

It wraps three host service calls in memory only: no files, no network, and the conversation is untouched. Disable or remove it, restart DSH, and the host's original methods are back.

How it works, the two settings, the fail-open behaviour and the acceptance record are in [docs/implementation.en.md](https://github.com/SpaceRelay/dsh-subagent-control/blob/main/human-wait/docs/implementation.en.md).

MIT, see [LICENSE](./LICENSE). Issues: [github.com/SpaceRelay/dsh-subagent-control/issues](https://github.com/SpaceRelay/dsh-subagent-control/issues).
