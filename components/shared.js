/**
 * Helpers shared by the optional components.
 *
 * Plain relative module: this package imports no bare specifier, so a linked
 * checkout and an npm install resolve exactly the same way.
 */

/** A tool needs a calling agent; a schedule or an external call has none. */
export function requireAgent(exec, tool) {
  const agent = exec.agent
  if (agent === undefined) {
    throw new Error(`${tool} requires a calling agent (exec.agent was undefined)`)
  }
  return agent
}

/** Rows from the descendant catalog, without diagnostics. */
export function childrenOf(rows) {
  return rows.filter((row) => row.kind === 'child')
}

/** Build the chain from the caller's direct child down to the target. */
export function pathToTarget(rows, targetId, callerId) {
  const byId = new Map()
  for (const row of childrenOf(rows)) byId.set(row.id, row)
  let cursor = byId.get(targetId)
  if (cursor === undefined) return undefined
  const path = [cursor]
  for (let guard = 0; guard < 16; guard += 1) {
    if (cursor.depth === 1) break
    const parent = byId.get(cursor.parentId)
    if (parent === undefined || parent.id === callerId) break
    path.unshift(parent)
    cursor = parent
  }
  return path
}
