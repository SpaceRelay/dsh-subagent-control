# Changelog

## 1.0.1

- Documentation: bilingual README (English + 简体中文) with usage examples, the
  security model, and the name-collision note.
- Release: publishing now runs on GitHub Actions with npm trusted publishing
  (OIDC) and provenance. No npm token is stored in the repository.
- No runtime change: the three tools and their JSON Schemas are identical to
  1.0.0.

## 1.0.0

First release.

- `list_subagents` — list the caller's direct children or its whole descendant tree, with `running` / `inactive` status.
- `send_subagent_message` — send a follow-up message to a subagent the caller started.
- `interrupt_subagent` — stop a subagent (or any descendant) the caller started.
- Registers three new global tool names instead of shadowing the team bundle's `list_agents` / `send_message` / `interrupt_agent`.
- No runtime or peer dependencies; the module imports nothing.
- Localized display metadata (zh / en) and an SVG icon.
