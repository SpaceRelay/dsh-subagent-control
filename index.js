/**
 * Subagent control tools.
 *
 * The Harness already registers `list_agents` / `send_message` /
 * `interrupt_agent`, but the Agent Team plugin registers tools with those same
 * three names in each team member's exact Agent scope, so inside a teammate
 * scope the team versions win: they resolve `target` against the team roster
 * only, and `interrupt_agent` is Lead-only. A team member therefore cannot
 * list, steer, or stop the subagents it started, even though
 * `ctx.subagents` already supports all three operations for any live agent.
 *
 * This plugin registers three differently named tools instead of fighting over
 * the taken names. They are registered globally, so the Lead and every team
 * member get them; the subagent service itself enforces that a caller can only
 * reach its own direct children (`sendMessage`) or its own descendants
 * (`interrupt`).
 *
 * This module deliberately imports nothing: the tool definitions below are
 * plain registry-ready objects with explicit JSON Schemas, so the package has
 * no runtime or peer dependencies and installs the same way from npm or from a
 * linked checkout.
 */

export const name = 'subagent-control'

export const inject = ['tools', 'subagents', 'agents']

/** Detail rows returned by the subagent catalog. */
const CHILD_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'id', 'label', 'status'],
  properties: {
    kind: { type: 'string', enum: ['child'] },
    id: { type: 'string' },
    label: { type: 'string' },
    status: { type: 'string', enum: ['running', 'inactive'] },
    parent: { type: 'string' },
    depth: { type: 'number' },
  },
}

const DIAGNOSTIC_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'id', 'reason'],
  properties: {
    kind: { type: 'string', enum: ['diagnostic'] },
    id: { type: 'string' },
    reason: { type: 'string', enum: ['corrupt', 'unsupported', 'unavailable'] },
    parent: { type: 'string' },
    depth: { type: 'number' },
  },
}

/** A tool needs a calling agent; a schedule or an external call has none. */
function requireAgent(exec, tool) {
  const agent = exec.agent
  if (agent === undefined) {
    throw new Error(`${tool} requires a calling agent (exec.agent was undefined)`)
  }
  return agent
}

/** Report only whether the subagent is working, never whether it is loaded. */
function statusOf(agents, id) {
  return agents.get(id)?.status === 'running' ? 'running' : 'inactive'
}

/** One catalog row to one model-visible entry; one-shot children are omitted. */
function project(agents, entry, position) {
  const at = position === undefined ? {} : { parent: position.parentId, depth: position.depth }
  if (entry.kind === 'diagnostic') {
    return { kind: 'diagnostic', id: entry.id, reason: entry.reason, ...at }
  }
  if (entry.mode !== 'continuable') return undefined
  return {
    kind: 'child',
    id: entry.id,
    label: entry.label,
    status: statusOf(agents, entry.id),
    ...at,
  }
}

function renderEntry(entry) {
  if (entry.kind === 'diagnostic') {
    const at = entry.parent === undefined ? '' : `  parent=${entry.parent}`
    return `[${entry.reason}] ${entry.id}${at}`
  }
  const depth = entry.depth === undefined ? '' : `  depth=${entry.depth}`
  return `${entry.id}  ${entry.status}  ${JSON.stringify(entry.label)}${depth}`
}

export function apply(ctx) {
  /* ---------------------------------------------------------------- list */

  ctx.tools.register({
    name: 'list_subagents',
    description:
      'List the subagents you started, with their ids, labels and status. ' +
      'running means it is working; inactive means it is not working right now, which does not mean it is gone. ' +
      'You are notified when a subagent finishes, so there is no need to poll. ' +
      'Use send_subagent_message to continue a conversation with one of them.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: {
          type: 'string',
          enum: ['children', 'descendants'],
          description:
            'children (default) lists your direct children, which accept send_subagent_message in any status. ' +
            'descendants lists the whole tree below you with each entry parent and depth; ' +
            'entries deeper than one level accept only interrupt_subagent.',
        },
      },
    },
    output: {
      schema: { type: 'array', items: { oneOf: [CHILD_ITEM, DIAGNOSTIC_ITEM] } },
      render: (_args, entries) => [
        {
          type: 'text',
          text: entries.length === 0 ? '(no subagents)' : entries.map(renderEntry).join('\n'),
        },
      ],
    },
    async execute(args, exec) {
      const caller = requireAgent(exec, 'list_subagents')
      if ((args.scope ?? 'children') === 'descendants') {
        const rows = await ctx.subagents.listDescendants(caller.id, exec.signal)
        return rows.map((row) => project(ctx.agents, row, row)).filter(Boolean)
      }
      const rows = await ctx.subagents.listChildren(caller.id, exec.signal)
      return rows.map((row) => project(ctx.agents, row)).filter(Boolean)
    },
  })

  /* ---------------------------------------------------------------- send */

  ctx.tools.register({
    name: 'send_subagent_message',
    description:
      'Send a follow-up message to a subagent you started. ' +
      'A running subagent receives it at its next step; a finished one is resumed with it. ' +
      'Only a direct child accepts a message; use list_subagents to find its id. ' +
      'This returns delivery confirmation, not the answer — the answer arrives as a new message.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['subagent_id', 'message'],
      properties: {
        subagent_id: {
          type: 'string',
          description: 'The id of your direct subagent, from list_subagents.',
        },
        message: { type: 'string', description: 'The message to deliver.' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['messageId'],
        properties: { messageId: { type: 'string' } },
      },
      render: (args) => [{ type: 'text', text: `message delivered to subagent ${args.subagent_id}` }],
    },
    async execute(args, exec) {
      const caller = requireAgent(exec, 'send_subagent_message')
      const content = [{ type: 'text', text: args.message }]
      const messageId = await ctx.subagents.sendMessage(caller, args.subagent_id, content, {
        signal: exec.signal,
      })
      return { messageId }
    },
  })

  /* ----------------------------------------------------------- interrupt */

  ctx.tools.register({
    name: 'interrupt_subagent',
    description:
      'Ask a subagent under you to stop its current work. Returns without waiting for it to stop. ' +
      'A subagent that finished on its own is unaffected. ' +
      'Subagents it started keep running; interrupt those separately with their own ids.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['subagent_id'],
      properties: {
        subagent_id: {
          type: 'string',
          description:
            'The id of a subagent created under you: a direct child or any deeper descendant.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['accepted'],
        properties: { accepted: { type: 'boolean' } },
      },
      render: (args) => [{ type: 'text', text: `interrupt requested for subagent ${args.subagent_id}` }],
    },
    execute(args, exec) {
      const caller = requireAgent(exec, 'interrupt_subagent')
      ctx.subagents.interrupt(args.subagent_id, { kind: 'ancestor', agent: caller })
      return Promise.resolve({ accepted: true })
    },
  })
}
