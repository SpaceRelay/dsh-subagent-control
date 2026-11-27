# Changelog

## 1.0.12

Two components removed, one repaired, and the tool descriptions corrected for DSH 0.2.2.

- **Removed the cross-layer relay component** (`relay_subagent_message`). Its premise was that a
  message can only reach a direct child, so a deeper descendant needed the middle hops to forward
  it. The 0.2.2 subagent service delivers to any agent in the same tree, and the shipped
  `send_message` does it by name, so the relay was solving a problem that no longer exists.
- **Removed the release component** (`drain_subagents`, the "Release subagents" row). It called
  `drainChildren`, which the host no longer has; the replacement `drainDescendants` does not
  recycle run slots as advertised. It closes the whole tree's admission permanently — the host
  records the root in `closingRoots`, which is only cleared when that agent is disposed — so after
  one call the session can no longer start any subagent. Recycling slots is not worth losing the
  ability to delegate, so the component is gone rather than reworded.
- **Repaired the wait component** (`wait_subagents`). It called `waitForChildren`, which the host
  no longer has either; it now calls `waitForTreeWork`, and refuses to run outside a subagent tree
  root instead of reporting a wait that never happened.
- **Repaired `list_subagents`**. Its default scope called `listChildren`, which the host no longer
  has, so the plain call threw. It now reads the descendant catalog once and keeps the depth-1
  entries for the default scope.
- **Corrected the descriptions that 0.2.2 invalidated.** `list_subagents` no longer claims a
  `team=teammate` / `team=lead` marker (0.2.2 has no team markers — team membership is ordinary
  subagent ancestry), and `send_subagent_message` no longer claims only a direct child accepts a
  message. Both descriptions now also point at the shipped tool that does the same thing.
- **Dropped the "including a team member" clause** from the package description, both locale files,
  both READMEs and the market submission. Once teammates are plain subagents, singling them out
  reads like "including humans" — true but noise.
- The optional feature count in both READMEs and in `docs/implementation*.md` drops from four to
  two.

## 1.0.10

Documentation only, no behaviour change.

- The README opens by saying the repository holds five packages and pointing at the other four.
- The related plugins section lists `dsh-subagent-route`, and the team-limits and human-wait lines
  now match what those packages do today.

## 1.0.9

Packaging only, no behaviour change.

- The `description` in `package.json` no longer claims the package ships exactly three tools; it
  now says what the tools do, the same sentence the marketplace entry uses.

## 1.0.8

Documentation only, no behaviour change.

- The README explains what a subagent is before the word is used, drops internal terms (host,
  profile patch layer, wall-clock budget) and describes the companion bundles by what they do
  instead of justifying why they ship separately.

## 1.0.7

- Rewrote the README for users instead of maintainers: what the three tools are for, how to install
  from the market, when to use each optional component, FAQ, privacy and uninstall. The Chinese
  README is now the primary one and `README.en.md` is the English translation.
- The install example no longer pins a version, so it cannot go stale.
- Implementation notes, the boundary with the built-in tools and the test coverage moved to
  `docs/implementation.md` and `docs/implementation.en.md`.

## 1.0.6

- Declares the harness versions this bundle supports: `engines.dsh` is now
  `>=0.2.1-rc.1 <0.3.0-0`. The field was absent, so the installer had nothing to check against
  the running harness before installing.

## 1.0.5

- The `subagent_budget` tool says "not running" instead of "inactive", and its line now lists how
  many subagents sit on each level (`levels 1:3 2:1`).
- The `drain_subagents` description no longer claims a released child can never be woken again.
  Drain drops the activation and gives the run back; the session stays continuable, so a later
  message cold-resumes it.

## 1.0.4

- The single optional `extras` row is split into four independent components, each with its own
  switch in the plugin panel and its own localized title and description: Cross-layer relay,
  Wait for subagents, Release subagents, Delegation budget. Enabling one registers exactly one
  tool instead of all four.
- Removed the `dsh-subagent-control/extras` export in favour of `./relay`, `./wait`, `./drain`
  and `./budget`, each also exporting `package.json` and `locale/*.json` for the panel.
- Unchanged: the base row still registers exactly the three original tools, and every component
  still starts disabled.

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
