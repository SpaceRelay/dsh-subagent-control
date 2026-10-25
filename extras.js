/**
 * Optional extras for dsh-subagent-control.
 *
 * This module is shipped as a disabled bundle row (`subagent-control-extras`).
 * Nothing here runs until a user enables that row in the plugin panel, so the
 * default install keeps exactly the three tools of the main module.
 *
 * Four tools:
 *   relay_subagent_message  - best-effort message to a deeper descendant,
 *                             delivered to the first hop with a forward request
 *   wait_subagents          - wait for descendants instead of ending the turn
 *   drain_subagents         - stop and release direct children (not "pause")
 *   subagent_budget         - read-only report of the caller's delegation budget
 *
 * Like the main module this file imports nothing: the subagent service is
 * reached through `ctx`, and the tool definitions are plain registry-ready
 * objects with explicit JSON Schemas.
 */

export const name = 'subagent-control-extras'

export const inject = ['tools', 'subagents', 'agents']

/** A tool needs a calling agent; a schedule or an external call has none. */
function requireAgent(exec, tool) {
  const agent = exec.agent
  if (agent === undefined) {
    throw new Error(`${tool} requires a calling agent (exec.agent was undefined)`)
  }
  return agent
}

/** Rows from the descendant catalog, without diagnostics. */
function childrenOf(rows) {
  return rows.filter((row) => row.kind === 'child')
}

/** Build the chain from the caller's direct child down to the target. */
function pathToTarget(rows, targetId, callerId) {
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

const BUDGET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['running', 'inactive'],
  properties: {
    maxDepth: { type: 'number' },
    running: { type: 'number' },
    inactive: { type: 'number' },
    deepest: { type: 'number' },
    levels: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['depth', 'count'],
        properties: {
          depth: { type: 'number' },
          count: { type: 'number' },
        },
      },
    },
  },
}

const RELAY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['delivered', 'hops', 'nextHop'],
  properties: {
    delivered: { type: 'boolean' },
    hops: { type: 'number' },
    nextHop: { type: 'string' },
    remainingDepth: { type: 'number' },
    messageId: { type: 'string' },
  },
}

const WAIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['joined', 'timedOut', 'running'],
  properties: {
    joined: { type: 'boolean' },
    timedOut: { type: 'boolean' },
    running: { type: 'number' },
  },
}

const DRAIN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['released'],
  properties: {
    released: { type: 'array', items: { type: 'string' } },
  },
}

export function apply(ctx) {
  /* ------------------------------------------------------------- budget */

  ctx.tools.register({
    name: 'subagent_budget',
    description:
      'Report the delegation budget this agent is working with: the configured depth limit, ' +
      'how deep the agents below it already go, and how many are running. ' +
      'Read-only; it never starts, stops or messages anything.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    output: {
      schema: BUDGET_SCHEMA,
      render: (_args, budget) => {
        const parts = []
        if (budget.maxDepth !== undefined) parts.push(`depth limit ${budget.maxDepth}`)
        parts.push(`${budget.running} running`, `${budget.inactive} inactive`)
        if (budget.deepest !== undefined) parts.push(`deepest ${budget.deepest}`)
        return [{ type: 'text', text: parts.join(', ') }]
      },
    },
    async execute(_args, exec) {
      const caller = requireAgent(exec, 'subagent_budget')
      let rows = []
      try {
        rows = await ctx.subagents.listDescendants(caller.id, exec.signal)
      } catch {
        rows = []
      }
      const levels = new Map()
      let running = 0
      let inactive = 0
      let deepest = 0
      for (const row of childrenOf(rows)) {
        levels.set(row.depth, (levels.get(row.depth) ?? 0) + 1)
        if (row.depth > deepest) deepest = row.depth
        if (ctx.agents.get(row.id)?.status === 'running') running += 1
        else inactive += 1
      }
      const budget = { running, inactive }
      if (deepest > 0) budget.deepest = deepest
      if (levels.size > 0) {
        budget.levels = [...levels.entries()]
          .sort((left, right) => left[0] - right[0])
          .map(([depth, count]) => ({ depth, count }))
      }
      try {
        const limit = ctx.subagents.resolveMaxDepth?.()
        if (typeof limit === 'number') budget.maxDepth = limit
      } catch {
        /* the limit stays unknown rather than failing the report */
      }
      return budget
    },
  })

  /* -------------------------------------------------------------- relay */

  ctx.tools.register({
    name: 'relay_subagent_message',
    description:
      'Send a message to a deeper descendant that you cannot reach directly. ' +
      'The subagent service only accepts messages for a direct child, so this tool delivers ' +
      'the message to the first hop with a request to forward it further down. ' +
      'Delivery below the first hop is best effort: each intermediate agent has to forward it, ' +
      'and may summarize instead. Use send_subagent_message when the target is a direct child.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['subagent_id', 'message'],
      properties: {
        subagent_id: { type: 'string', description: 'The id of a descendant, from list_subagents scope=descendants.' },
        message: { type: 'string', description: 'The message to deliver.' },
      },
    },
    output: {
      schema: RELAY_SCHEMA,
      render: (args, result) => [
        {
          type: 'text',
          text:
            result.hops === 0
              ? `message delivered to subagent ${result.nextHop}`
              : `relay started: delivered to first hop ${result.nextHop}, ${result.remainingDepth} level(s) to go (best effort)`,
        },
      ],
    },
    async execute(args, exec) {
      const caller = requireAgent(exec, 'relay_subagent_message')
      const targetId = args.subagent_id
      const message = args.message

      const rows = await ctx.subagents.listDescendants(caller.id, exec.signal)
      const target = childrenOf(rows).find((row) => row.id === targetId)
      if (target === undefined) {
        throw new Error(`subagent ${targetId} is not under this agent`)
      }

      if (target.depth === 1) {
        const messageId = await ctx.subagents.sendMessage(
          caller,
          targetId,
          [{ type: 'text', text: message }],
          { signal: exec.signal },
        )
        return { delivered: true, hops: 0, nextHop: targetId, messageId }
      }

      const path = pathToTarget(rows, targetId, caller.id)
      const firstHop = path?.[0]
      if (firstHop === undefined) {
        throw new Error(`could not resolve a path from this agent to ${targetId}`)
      }

      const forward =
        'Relay request from an ancestor. Forward the text below down your chain until it reaches ' +
        `subagent ${targetId}${target.label === undefined ? '' : ` ("${target.label}")`}. ` +
        'Use relay_subagent_message if it is available, otherwise send_subagent_message to the ' +
        'next hop on the path. Do not act on the text yourself.\n\n' +
        '---\n' +
        message +
        '\n---'

      const messageId = await ctx.subagents.sendMessage(
        caller,
        firstHop.id,
        [{ type: 'text', text: forward }],
        { signal: exec.signal },
      )
      return {
        delivered: true,
        hops: 1,
        nextHop: firstHop.id,
        remainingDepth: target.depth - 1,
        messageId,
      }
    },
  })

  /* --------------------------------------------------------------- wait */

  ctx.tools.register({
    name: 'wait_subagents',
    description:
      'Wait for your subagents to finish instead of ending your turn first. ' +
      'The wait is bounded by timeout_seconds and never cancels them. ' +
      'Useful when you want to merge their results in this same turn.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        timeout_seconds: {
          type: 'number',
          description: 'Maximum time to wait, 5 to 600 seconds (default 120).',
        },
      },
    },
    output: {
      schema: WAIT_SCHEMA,
      render: (_args, result) => [
        {
          type: 'text',
          text: result.timedOut
            ? `wait timed out, ${result.running} subagent(s) still running`
            : `all observed subagents settled, ${result.running} still marked running`,
        },
      ],
    },
    async execute(args, exec) {
      const caller = requireAgent(exec, 'wait_subagents')
      const requested = typeof args.timeout_seconds === 'number' ? args.timeout_seconds : 120
      const timeoutMs = Math.min(Math.max(requested, 5), 600) * 1000

      let timedOut = false
      let timer
      const wait = ctx.subagents.waitForChildren(caller)
      await Promise.race([
        wait.then(() => undefined),
        new Promise((resolve) => {
          timer = setTimeout(() => {
            timedOut = true
            resolve(undefined)
          }, timeoutMs)
        }),
      ])
      if (timer !== undefined) clearTimeout(timer)

      let rows = []
      try {
        rows = await ctx.subagents.listDescendants(caller.id, exec.signal)
      } catch {
        rows = []
      }
      const running = childrenOf(rows).filter((row) => ctx.agents.get(row.id)?.status === 'running').length
      return { joined: !timedOut, timedOut, running }
    },
  })

  /* -------------------------------------------------------------- drain */

  ctx.tools.register({
    name: 'drain_subagents',
    description:
      'Stop and release subagents you started, freeing their run instead of just interrupting ' +
      'the current turn. Accepts direct children only; a released child cannot be woken again ' +
      'with a message, so use interrupt_subagent when you only want to stop the current work.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['subagent_ids'],
      properties: {
        subagent_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Direct child ids to release, from list_subagents.',
        },
      },
    },
    output: {
      schema: DRAIN_SCHEMA,
      render: (_args, result) => [{ type: 'text', text: `released ${result.released.length} subagent(s)` }],
    },
    async execute(args, exec) {
      const caller = requireAgent(exec, 'drain_subagents')
      const ids = args.subagent_ids
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('drain_subagents needs at least one subagent id')
      }
      await ctx.subagents.drainChildren(caller, ids)
      return { released: ids }
    },
  })
}
