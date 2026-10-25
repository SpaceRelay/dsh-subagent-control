# Changelog

## 1.0.0

First release.

- `list_subagents` — list the caller's direct children or its whole descendant tree, with `running` / `inactive` status.
- `send_subagent_message` — send a follow-up message to a subagent the caller started.
- `interrupt_subagent` — stop a subagent (or any descendant) the caller started.
- Registers three new global tool names instead of shadowing the team bundle's `list_agents` / `send_message` / `interrupt_agent`.
- No runtime or peer dependencies; the module imports nothing.
- Localized display metadata (zh / en) and an SVG icon.
