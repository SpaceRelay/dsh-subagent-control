/**
 * Cross-layer relay: hand a message to the first hop and ask it to forward.
 *
 * The subagent service only accepts messages for a direct child, so a deeper
 * descendant is reached by a prompt-level relay. It is best effort by nature:
 * the middle agent has to cooperate, and may summarize instead of forwarding.
 */
import { childrenOf, pathToTarget, requireAgent } from '../shared.js'

export const name = 'subagent-control-relay'

export const inject = ['tools', 'subagents', 'agents']

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

export function apply(ctx) {
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
      render: (_args, result) => [
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
}
