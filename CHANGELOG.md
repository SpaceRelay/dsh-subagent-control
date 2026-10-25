# Changelog

## 1.0.3

- `list_subagents` marks Team members, which are continuable subagents: each row carries
  `team=teammate` (or `team=lead`) when the Agent Teams service can resolve it.
- New `include_teammates` parameter (default `true`); set it to `false` to keep only plain
  subagents. Existing behaviour is unchanged for callers that pass nothing.

## 1.0.2

- New optional `extras` component (`dsh-subagent-control/extras`), shipped **disabled**:
  `relay_subagent_message`, `wait_subagents`, `drain_subagents`, `subagent_budget`.
- The default install is unchanged: still exactly the three original tools while extras stays off.
- New companion bundle `dsh-team-limits`, published separately, for raising the Agent Team
  member/task/message limits by overriding the `agent-team` row.

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
