/**
 * Offline smoke test for dsh-subagent-control/extras.
 *
 * The fake ctx mirrors the shapes the real subagent service returns. This test
 * proves the module loads, the four definitions are registry-shaped, and the
 * projection / call paths behave; it cannot prove the live Harness accepts the
 * JSON Schemas — only a real install and tool call can show that.
 */
import { apply } from '../extras.js'

const registered = new Map()
const calls = []

const parentOf = {
  'child-a': 'lead',
  'grand-b': 'child-a',
  'great-c': 'grand-b',
}

const catalog = [
  { kind: 'child', id: 'child-a', label: 'child a', mode: 'continuable', depth: 1, parentId: 'lead', hasChildren: true },
  { kind: 'child', id: 'grand-b', label: 'grand b', mode: 'continuable', depth: 2, parentId: 'child-a', hasChildren: true },
  { kind: 'child', id: 'great-c', label: 'great c', mode: 'continuable', depth: 3, parentId: 'grand-b', hasChildren: false },
  { kind: 'diagnostic', id: 'broken', reason: 'corrupt', depth: 1, parentId: 'lead' },
]

const ctx = {
  tools: {
    register(definition) {
      registered.set(definition.name, definition)
      return () => registered.delete(definition.name)
    },
  },
  agents: {
    get(id) {
      return id === 'child-a' || id === 'grand-b' ? { status: 'running' } : { status: 'idle' }
    },
  },
  subagents: {
    resolveMaxDepth: () => 4,
    async listDescendants() {
      calls.push(['listDescendants'])
      return catalog
    },
    async sendMessage(sender, targetId, content, options) {
      calls.push(['sendMessage', sender.id, targetId, content[0].text, options])
      return 'msg-1'
    },
    async waitForChildren(parent) {
      calls.push(['waitForChildren', parent.id])
      return true
    },
    async drainChildren(parent, ids) {
      calls.push(['drainChildren', parent.id, ids])
    },
  },
}

apply(ctx)

const problems = []
const check = (ok, message) => {
  if (!ok) problems.push(message)
}

const budget = registered.get('subagent_budget')
const relay = registered.get('relay_subagent_message')
const wait = registered.get('wait_subagents')
const drain = registered.get('drain_subagents')

check(budget && relay && wait && drain, 'all four tools registered')

for (const [toolName, definition] of registered) {
  check(typeof definition.name === 'string' && definition.name === toolName, `${toolName}: name`)
  check(typeof definition.description === 'string' && definition.description.length > 40, `${toolName}: description`)
  check(definition.parameters?.type === 'object', `${toolName}: parameters.type`)
  check(typeof definition.output?.schema === 'object', `${toolName}: output.schema`)
  check(typeof definition.output?.render === 'function', `${toolName}: render`)
  check(typeof definition.execute === 'function', `${toolName}: execute`)
}

const caller = { id: 'lead' }
const exec = { agent: caller, signal: undefined }

const report = await budget.execute({}, exec)
check(report.maxDepth === 4, `budget: maxDepth (${report.maxDepth})`)
check(report.running === 2, `budget: running (${report.running})`)
check(report.inactive === 1, `budget: inactive (${report.inactive})`)
check(report.deepest === 3, `budget: deepest (${report.deepest})`)
check(report.levels.length === 3, `budget: levels (${report.levels.length})`)
check(budget.output.render({}, report)[0].text.includes('depth limit 4'), 'budget: render')

const direct = await relay.execute({ subagent_id: 'child-a', message: 'hello a' }, exec)
check(direct.hops === 0 && direct.nextHop === 'child-a', `relay: direct child (${JSON.stringify(direct)})`)
check(calls.at(-1)[1] === 'lead' && calls.at(-1)[2] === 'child-a', 'relay: direct target')

const deep = await relay.execute({ subagent_id: 'great-c', message: 'hello c' }, exec)
check(deep.hops === 1 && deep.nextHop === 'child-a', `relay: first hop (${JSON.stringify(deep)})`)
check(deep.remainingDepth === 2, `relay: remainingDepth (${deep.remainingDepth})`)
const forwarded = calls.at(-1)
check(forwarded[2] === 'child-a' && forwarded[3].includes('great-c'), 'relay: forward text names the target')
check(forwarded[3].includes('hello c'), 'relay: forward text carries the message')
check(relay.output.render({}, deep)[0].text.includes('best effort'), 'relay: render')

let notMine = false
try {
  await relay.execute({ subagent_id: 'nobody', message: 'x' }, exec)
} catch (error) {
  notMine = /not under this agent/.test(error.message)
}
check(notMine, 'relay: rejects a target outside the subtree')

const waited = await wait.execute({}, exec)
check(waited.joined === true && waited.timedOut === false, `wait: joined (${JSON.stringify(waited)})`)
check(waited.running === 2, `wait: running (${waited.running})`)

const released = await drain.execute({ subagent_ids: ['child-a'] }, exec)
check(released.released.length === 1, 'drain: released list')
check(calls.at(-1)[0] === 'drainChildren' && calls.at(-1)[2][0] === 'child-a', 'drain: service call')

let emptyDrain = false
try {
  await drain.execute({ subagent_ids: [] }, exec)
} catch (error) {
  emptyDrain = /at least one/.test(error.message)
}
check(emptyDrain, 'drain: rejects an empty list')

let noAgent = false
try {
  await budget.execute({}, { agent: undefined })
} catch (error) {
  noAgent = /requires a calling agent/.test(error.message)
}
check(noAgent, 'budget: rejects a caller with no agent')

if (problems.length > 0) {
  console.error('FAILED:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('OK: 4 extras tools, registry shape, budget projection, relay path, wait and drain calls all behave.')
