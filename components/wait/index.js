/**
 * Wait for subagents inside the current turn.
 *
 * The wait is bounded and never cancels anything: it only decides whether this
 * turn keeps going or reports a timeout with what is still running.
 */
import { childrenOf, requireAgent } from '../shared.js'

export const name = 'subagent-control-wait'

export const inject = ['tools', 'subagents', 'agents']

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

export function apply(ctx) {
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
}
