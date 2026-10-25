/**
 * dsh-team-limits is a configuration-only bundle: the actual work happens in
 * cordis.patch.yml, which overrides the shipped `agent-team` row.
 *
 * This module registers nothing. It exists so the bundle has a real entry
 * artifact and one visible component row in the plugin panel, which is how a
 * user can tell that the bundle is installed and enabled.
 */
export const name = 'dsh-team-limits'

export function apply() {}
