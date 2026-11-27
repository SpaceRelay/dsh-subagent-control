/**
 * Subagent control tools.
 *
 * The Harness ships `list_agents` / `send_message` / `wait_agent`, and those are
 * the tools to prefer: `list_agents` reports the whole tree from the root with
 * path names, and `send_message` reaches any agent in the same tree. This plugin
 * keeps three tools of its own for the gaps those leave:
 *
 * - `list_subagents` filters instead of listing everything, so a caller can ask
 *   for just its direct children.
 * - `interrupt_subagent` fills the hole left by the shipped `interrupt_agent`,
 *   which is disabled by default in the base profile.
 * - `subagent_budget` (opt-in component) reports the delegation budget, which no
 *   shipped tool exposes.
 *
 * As of DSH 0.2.2 the Agent Team plugin no longer registers tools with the shipped
 * names, and team membership is modelled as ordinary subagent ancestry, so there
 * is no team marker to resolve here any more.
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
      'List subagents below you, with their ids, labels and status. ' +
      'running means it is working; inactive means it is not working right now, which does not mean it is gone. ' +
      'You are notified when a subagent finishes, so there is no need to poll. ' +
      'Use send_subagent_message to continue a conversation with one of them, ' +
      'or list_agents for the whole tree from the root with path names.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: {
          type: 'string',
          enum: ['children', 'descendants'],
          description:
            'children (default) lists the subagents you started yourself, one level down. ' +
            'descendants lists the whole tree below you, with each entry parent and depth.',
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
      const rows = await ctx.subagents.listDescendants(caller.id, exec.signal)
      const scope = args.scope ?? 'children'
      const emit = (row) => project(ctx.agents, row, row)
      return rows
        .filter((row) => scope === 'descendants' || row.depth === 1)
        .map(emit)
        .filter(Boolean)
    },
  })

  /* ---------------------------------------------------------------- send */

  ctx.tools.register({
    name: 'send_subagent_message',
    description:
      'Send a follow-up message to a subagent in your tree, by id. ' +
      'A running subagent receives it at its next step; a finished one is resumed with it. ' +
      'Use list_subagents to find the id. ' +
      'This returns delivery confirmation, not the answer — the answer arrives as a new message. ' +
      'The shipped send_message does the same thing by agent name.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['subagent_id', 'message'],
      properties: {
        subagent_id: {
          type: 'string',
          description: 'The id of a subagent in your tree, from list_subagents.',
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
      'Subagents it started keep running; interrupt those separately with their own ids. ' +
      'The shipped interrupt_agent does the same thing but is disabled by default.',
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
