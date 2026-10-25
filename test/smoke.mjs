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
  agentTeams: {
    listMembers() {
      return [
        { id: 'lead', role: 'lead', name: 'lead', status: 'running', diagnostics: [] },
        { id: 'child-running', role: 'teammate', name: 'runner', status: 'running', diagnostics: [] },
      ]
    },
    tryMembership(agent) {
      return agent.id === 'child-running' ? { role: 'teammate', name: 'runner' } : undefined
    },
  },
  get(name) {
    return name === 'agentTeams' ? this.agentTeams : undefined
  },
  subagents: {
    async listChildren(parentId) {
      calls.push(['listChildren', parentId])
      return [
        { id: 'child-running', label: 'compute pi', mode: 'continuable', createdAt: 'now' },
        { id: 'child-idle', label: 'review notes', mode: 'continuable', createdAt: 'now' },
        { id: 'child-oneshot', label: 'one shot', mode: 'one-shot', createdAt: 'now' },
      ]
    },
    async listDescendants(rootId) {
      calls.push(['listDescendants', rootId])
      return [
        { kind: 'child', id: 'child-running', label: 'compute pi', mode: 'continuable', parentId: rootId, depth: 1, activity: 'running', hasChildren: false },
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
  check(typeof definition.description === 'string' && definition.description.length > 40, `${toolName}: description`)
  check(definition.parameters?.type === 'object', `${toolName}: parameters.type`)
  check(typeof definition.output?.schema === 'object', `${toolName}: output.schema`)
  check(typeof definition.output?.render === 'function', `${toolName}: output.render`)
  check(typeof definition.execute === 'function', `${toolName}: execute`)
}

const children = await list.execute({}, exec)
check(children.length === 2, `children: one-shot filtered out (got ${children.length})`)
check(children[0].status === 'running' && children[1].status === 'inactive', 'children: status mapping')
check(children[0].kind === 'child', 'children: kind')
check(!('depth' in children[0]), 'children: no depth at top level')
check(children[0].team === 'teammate', `children: teammate marked (${children[0].team})`)
check(children[1].team === undefined, 'children: plain worker unmarked')

const onlyWorkers = await list.execute({ include_teammates: false }, exec)
check(
  onlyWorkers.length === 1 && onlyWorkers[0].id === 'child-idle',
  `children: teammates filtered (${JSON.stringify(onlyWorkers)})`,
)

const listText = list.output.render({}, children)[0].text
check(listText.includes('child-running') && listText.split('\n').length === 2, 'children: render')
check(listText.includes('team=teammate'), 'children: render marks the teammate')

const emptyText = list.output.render({}, [])[0].text
check(emptyText === '(no subagents)', 'children: empty render')

const descendants = await list.execute({ scope: 'descendants' }, exec)
check(descendants.length === 2, `descendants: rows (got ${descendants.length})`)
check(descendants[0].depth === 1 && descendants[0].parent === 'lead', 'descendants: position')
check(descendants[1].kind === 'diagnostic' && descendants[1].reason === 'corrupt', 'descendants: diagnostic kept')
check(descendants[0].team === 'teammate', 'descendants: teammate marked')
check(list.output.render({}, descendants)[0].text.includes('[corrupt]'), 'descendants: diagnostic render')

const sent = await send.execute({ subagent_id: 'child-running', message: 'also try e' }, exec)
check(sent.messageId === 'msg-1', 'send: messageId')
check(calls.at(-1)[1] === 'lead' && calls.at(-1)[2] === 'child-running', 'send: sender + target')
check(calls.at(-1)[3][0].type === 'text' && calls.at(-1)[3][0].text === 'also try e', 'send: content block')
check(send.output.render({ subagent_id: 'child-running' }, sent)[0].text.includes('child-running'), 'send: render')

const stopped = await interrupt.execute({ subagent_id: 'child-running' }, exec)
check(stopped.accepted === true, 'interrupt: accepted')
const [, target, authority] = calls.at(-1)
check(target === 'child-running' && authority.kind === 'ancestor' && authority.agent === caller, 'interrupt: authority')

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
