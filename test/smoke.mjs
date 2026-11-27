/**
 * Offline smoke test for dsh-subagent-control.
 *
 * Imports the plugin with a fake ctx and exercises the three tools end to end
 * against the shapes the real subagent service returns. It proves the module
 * loads, the definitions are registry-shaped, and the render/project paths do
 * not throw; it cannot prove the live Harness accepts the JSON Schemas, which
 * only `install_bundle` + a real tool call can show.
 */
import { apply } from '../index.js'

const registered = new Map()
const calls = []

const ctx = {
  tools: {
    register(definition) {
      registered.set(definition.name, definition)
      return () => registered.delete(definition.name)
    },
  },
  agents: {
    get(id) {
      return { id, status: id === 'child-running' ? 'running' : 'idle' }
    },
  },
  get() {
    return undefined
  },
  subagents: {
    async listDescendants(rootId) {
      calls.push(['listDescendants', rootId])
      return [
        {
          kind: 'child',
          id: 'child-running',
          label: 'compute pi',
          mode: 'continuable',
          parentId: rootId,
          depth: 1,
          activity: 'running',
          hasChildren: true,
        },
        {
          kind: 'child',
          id: 'child-idle',
          label: 'review notes',
          mode: 'continuable',
          parentId: rootId,
          depth: 1,
          activity: 'inactive',
          hasChildren: false,
        },
        {
          kind: 'child',
          id: 'child-oneshot',
          label: 'one shot',
          mode: 'one-shot',
          parentId: rootId,
          depth: 1,
          activity: 'inactive',
          hasChildren: false,
        },
        {
          kind: 'child',
          id: 'grandchild',
          label: 'deeper work',
          mode: 'continuable',
          parentId: 'child-running',
          depth: 2,
          activity: 'inactive',
          hasChildren: false,
        },
        { kind: 'diagnostic', id: 'broken', reason: 'corrupt', parentId: rootId, depth: 1 },
      ]
    },
    async sendMessage(sender, targetId, content, options) {
      calls.push(['sendMessage', sender.id, targetId, content, options])
      return 'msg-1'
    },
    interrupt(targetId, authority) {
      calls.push(['interrupt', targetId, authority])
    },
  },
}

apply(ctx)

const problems = []
const check = (ok, message) => {
  if (!ok) problems.push(message)
}

const caller = { id: 'lead' }
const exec = { agent: caller, signal: undefined }

const list = registered.get('list_subagents')
const send = registered.get('send_subagent_message')
const interrupt = registered.get('interrupt_subagent')

check(list && send && interrupt, 'all three tools registered')

for (const [toolName, definition] of registered) {
  check(typeof definition.name === 'string' && definition.name === toolName, `${toolName}: name`)
  check(
    typeof definition.description === 'string' && definition.description.length > 40,
    `${toolName}: description`,
  )
  check(definition.parameters?.type === 'object', `${toolName}: parameters.type`)
  check(typeof definition.output?.schema === 'object', `${toolName}: output.schema`)
  check(typeof definition.output?.render === 'function', `${toolName}: output.render`)
  check(typeof definition.execute === 'function', `${toolName}: execute`)
  check(
    !/team=|team=teammate|include_teammates/.test(definition.description ?? ''),
    `${toolName}: no stale team wording`,
  )
}

/* Default scope asks the service for the whole tree, then keeps depth 1. */
const children = await list.execute({}, exec)
check(calls.at(-1)[0] === 'listDescendants', 'children: reads the descendant catalog')
check(children.length === 3, `children: one-shot filtered out, diagnostic kept (got ${children.length})`)
check(children[0].status === 'running' && children[1].status === 'inactive', 'children: status mapping')
check(children[0].kind === 'child', 'children: kind')
check(children[0].depth === 1 && children[0].parent === 'lead', 'children: position kept')
check(!('team' in children[0]), 'children: no team marker any more')
check(
  children.every((entry) => entry.depth === 1),
  'children: deeper rows excluded from the default scope',
)
check(
  children.some((entry) => entry.kind === 'diagnostic' && entry.id === 'broken'),
  'children: a broken direct child still shows up as a diagnostic',
)

const listText = list.output.render({}, children)[0].text
check(listText.includes('child-running'), 'children: render lists the id')
check(listText.includes('depth=1'), 'children: render shows depth')
check(!listText.includes('team='), 'children: render has no team segment')
check(listText.split('\n').length === 3, 'children: one line per entry')

const emptyText = list.output.render({}, [])[0].text
check(emptyText === '(no subagents)', 'children: empty render')

const descendants = await list.execute({ scope: 'descendants' }, exec)
check(descendants.length === 4, `descendants: rows including the grandchild (got ${descendants.length})`)
check(descendants[0].depth === 1 && descendants[0].parent === 'lead', 'descendants: position')
check(
  descendants[2].id === 'grandchild' && descendants[2].depth === 2,
  'descendants: deeper row',
)
check(
  descendants.some((entry) => entry.kind === 'diagnostic' && entry.reason === 'corrupt'),
  'descendants: diagnostic kept',
)
check(list.output.render({}, descendants)[0].text.includes('[corrupt]'), 'descendants: diagnostic render')

const sent = await send.execute({ subagent_id: 'child-running', message: 'also try e' }, exec)
check(sent.messageId === 'msg-1', 'send: messageId')
check(calls.at(-1)[1] === 'lead' && calls.at(-1)[2] === 'child-running', 'send: sender + target')
check(calls.at(-1)[3][0].type === 'text' && calls.at(-1)[3][0].text === 'also try e', 'send: content block')
check(
  send.output.render({ subagent_id: 'child-running' }, sent)[0].text.includes('child-running'),
  'send: render',
)

const stopped = await interrupt.execute({ subagent_id: 'child-running' }, exec)
check(stopped.accepted === true, 'interrupt: accepted')
const [, target, authority] = calls.at(-1)
check(
  target === 'child-running' && authority.kind === 'ancestor' && authority.agent === caller,
  'interrupt: authority',
)

let noAgent = false
try {
  await list.execute({}, { agent: undefined })
} catch (error) {
  noAgent = /requires a calling agent/.test(error.message)
}
check(noAgent, 'list: rejects a caller with no agent')

if (problems.length > 0) {
  console.error('FAILED:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('OK: 3 tools, registry shape, projection, render and service calls all behave.')
