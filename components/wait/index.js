/**
 * Wait for the whole tree to settle inside the current turn.
 *
 * The official `wait_agent` returns as soon as the next input is pending, so it
 * does not wait for a whole fan-out. `waitForTreeWork` does wait for every
 * subagent under a root, but the host wraps it in no tool, and it only acts on a
 * real tree root — anywhere else it returns false, which is easy to mistake for
 * "nothing was waited for". So this tool refuses to run outside a root.
 *
 * The wait is bounded and never cancels anything: when the bound expires it
 * reports how many subagents were still running.
 */
import { requireAgent } from '../shared.js'

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
      'Wait for every subagent in your tree to finish instead of ending your turn first. ' +
      'The wait is bounded by timeout_seconds and never cancels them. Only the root of a ' +
      'subagent tree can wait on the tree; a subagent cannot. ' +
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
      if (ctx.subagents.rootOf(caller) !== caller) {
        throw new Error(
          'wait_subagents only works from the root of a subagent tree; ' +
            'a subagent cannot wait on the tree. Ask the root session instead.',
        )
      }
      const requested = typeof args.timeout_seconds === 'number' ? args.timeout_seconds : 120
      const timeoutMs = Math.min(Math.max(requested, 5), 600) * 1000

      let timedOut = false
      let timer
      const wait = ctx.subagents.waitForTreeWork(caller)
      const joined = await Promise.race([
        wait,
        new Promise((resolve) => {
          timer = setTimeout(() => {
            timedOut = true
            resolve(false)
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
      const running = rows
        .filter((row) => row.kind === 'child')
        .filter((row) => ctx.agents.get(row.id)?.status === 'running').length
      return { joined: timedOut ? false : joined === true, timedOut, running }
    },
  })
}
