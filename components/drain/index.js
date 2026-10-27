/**
 * Drain: stop and release direct children, freeing their run.
 *
 * interrupt_subagent only ends the current turn and keeps the activation, so a
 * stopped subagent stays resident. Drain drops the activation and gives the run
 * back; the session itself stays continuable, so a later message cold-resumes it.
 */
import { requireAgent } from '../shared.js'

export const name = 'subagent-control-drain'

export const inject = ['tools', 'subagents', 'agents']

const DRAIN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['released'],
  properties: {
    released: { type: 'array', items: { type: 'string' } },
  },
}

export function apply(ctx) {
  ctx.tools.register({
    name: 'drain_subagents',
    description:
      'Stop subagents you started without waiting for them to finish and free the run ' +
      'they occupy. Direct children only; a later message still wakes a released child. ' +
      'Use interrupt_subagent when you only want to stop the current work.',
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
