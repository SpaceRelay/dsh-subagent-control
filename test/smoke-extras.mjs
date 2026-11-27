/**
 * Offline smoke test for the two opt-in components.
 *
 * Each component is a separate module with its own switch. The fake ctx mirrors
 * the shapes the real subagent service returns: this proves the modules load,
 * the definitions are registry-shaped, and the call paths behave. It cannot
 * prove the live Harness accepts the JSON Schemas.
 */
import { apply as waitApply } from '../components/wait/index.js'
import { apply as budgetApply } from '../components/budget/index.js'

const registered = new Map()
const calls = []

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
    rootOf(caller) {
      calls.push(['rootOf', caller.id])
      return caller
    },
    async waitForTreeWork(root) {
      calls.push(['waitForTreeWork', root.id])
      return true
    },
  },
}

const problems = []
const check = (ok, message) => {
  if (!ok) problems.push(message)
}

/** Each component must mount on its own and register exactly one tool. */
for (const [label, apply, toolName] of [
  ['wait', waitApply, 'wait_subagents'],
  ['budget', budgetApply, 'subagent_budget'],
]) {
  const before = new Set(registered.keys())
  apply(ctx)
  const added = [...registered.keys()].filter((name) => !before.has(name))
  check(added.length === 1 && added[0] === toolName, `${label}: registers exactly ${toolName} (got ${added.join(', ') || 'none'})`)
}

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

const budget = registered.get('subagent_budget')
const wait = registered.get('wait_subagents')

check(budget && wait, 'both tools registered')

const report = await budget.execute({}, exec)
check(report.maxDepth === 4, `budget: maxDepth (${report.maxDepth})`)
check(report.running === 2, `budget: running (${report.running})`)
check(report.inactive === 1, `budget: inactive (${report.inactive})`)
check(report.deepest === 3, `budget: deepest (${report.deepest})`)
check(report.levels.length === 3, `budget: levels (${report.levels.length})`)
check(budget.output.render({}, report)[0].text.includes('depth limit 4'), 'budget: render')

const waited = await wait.execute({}, exec)
check(waited.joined === true && waited.timedOut === false, `wait: joined (${JSON.stringify(waited)})`)
check(waited.running === 2, `wait: running (${waited.running})`)
check(calls.some(([name, id]) => name === 'waitForTreeWork' && id === 'lead'), 'wait: asks the service for tree work')

const realRootOf = ctx.subagents.rootOf
ctx.subagents.rootOf = () => ({ id: 'someone-else' })
let waitNotRoot = false
try {
  await wait.execute({}, exec)
} catch (error) {
  waitNotRoot = /only works from the root/.test(error.message)
}
check(waitNotRoot, 'wait: refuses to run below the root')
ctx.subagents.rootOf = realRootOf

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
console.log('OK: 2 opt-in components mount individually; registry shape, budget projection and wait calls all behave.')
