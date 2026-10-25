/**
 * Drain: stop and release direct children, freeing their run.
 *
 * interrupt_subagent only ends the current turn and keeps the activation, so a
 * stopped subagent stays in the catalog. Drain removes the run itself, which is
 * why a released child can never be woken with another message.
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
