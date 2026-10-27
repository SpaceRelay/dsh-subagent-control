/**
 * Delegation budget: a read-only look at what the caller has below it.
 *
 * Use it before planning a fan-out: how deep the chain already goes, how many
 * agents sit on each level, and how many are running. It never starts, stops or
 * messages anything.
 */
import { childrenOf, requireAgent } from '../shared.js'

export const name = 'subagent-control-budget'

export const inject = ['tools', 'subagents', 'agents']

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

export function apply(ctx) {
  ctx.tools.register({
    name: 'subagent_budget',
    description:
      'Report the delegation budget this agent is working with: the configured depth limit, ' +
      'how deep the agents below it already go, how many sit on each level, and how many are running. ' +
      'Read-only; it never starts, stops or messages anything.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    output: {
      schema: BUDGET_SCHEMA,
      render: (_args, budget) => {
        const parts = []
        if (budget.maxDepth !== undefined) parts.push(`depth limit ${budget.maxDepth}`)
        parts.push(`${budget.running} running`, `${budget.inactive} not running`)
        if (budget.deepest !== undefined) parts.push(`deepest ${budget.deepest}`)
        if (budget.levels !== undefined && budget.levels.length > 0) {
          parts.push(`levels ${budget.levels.map((level) => `${level.depth}:${level.count}`).join(' ')}`)
        }
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
}
