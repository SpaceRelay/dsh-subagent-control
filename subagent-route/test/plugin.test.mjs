import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (name) => readFile(join(root, name), 'utf8')
const load = () => import(pathToFileURL(join(root, 'index.js')).href)

/**
 * A stand-in for the host context: only the services `apply` actually touches.
 * @param {{ subagents?: object, llm?: object }} parts
 */
function fakeHost(parts = {}) {
  const tools = new Map()
  const ctx = {
    fiber: {},
    logger: () => ({ info() {}, warn() {}, error() {} }),
    inject: (_names, run) => {
      run({ settings: { configure() {} } })
    },
    effect: (fn) => fn(),
    tools: {
      register(definition) {
        tools.set(definition.name, definition)
        return () => tools.delete(definition.name)
      },
    },
    subagents: parts.subagents ?? fakeSubagents(),
    llm: parts.llm ?? fakeLlm(),
  }
  return { ctx, tools }
}

function fakeSubagents(overrides = {}) {
  const started = []
  return {
    started,
    getProvider: (name) => (name === 'spawn' ? { name: 'spawn' } : undefined),
    resolveMaxDepth: () => 4,
    async startActivation(spec) {
      started.push(spec)
      return { name: spec.name ?? 'agent-1', childId: 'child-1', dispose() {} }
    },
    ...overrides,
  }
}

function fakeLlm(overrides = {}) {
  const calls = []
  return {
    calls,
    listProviders: () => [{ id: 'alpha', name: 'Alpha' }, { id: 'beta', name: 'Beta' }],
    async listModels(provider) {
      if (provider === 'alpha') return [{ provider, id: 'model-x', name: 'Model X' }]
      throw new Error('catalog down')
    },
    async resolveModelInfo(_provider, model) {
      return { id: model, name: model, reasoning: { defaultEffort: 'max', efforts: [{ id: 'low', name: 'Low' }, { id: 'max', name: 'Max' }] } }
    },
    async resolveCallConfig(config) {
      calls.push(config)
      return config
    },
    ...overrides,
  }
}

/** A parent agent whose current turn runs on alpha. */
function fakeParent() {
  return {
    options: { provider: 'alpha', model: 'model-x', reasoningEffort: 'max' },
    session: { requestHeader: () => ({ config: { provider: 'alpha', model: 'model-x', reasoningEffort: 'max' } }) },
  }
}

function exec(agent = fakeParent()) {
  return { agent, signal: { throwIfAborted() {}, aborted: false } }
}

const GOOD_ARGS = {
  description: 'check the other channel',
  prompt: 'Say hello and stop.',
  provider: 'beta',
  model: 'model-y',
}

test('the patch row name equals the package name', async () => {
  const pkg = JSON.parse(await read('package.json'))
  const patch = await read('cordis.patch.yml')
  const rows = [...patch.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(rows, [pkg.name])
})

test('the patch file does not disable its own row', async () => {
  const patch = await read('cordis.patch.yml').then((text) =>
    text
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n'),
  )
  assert.ok(!/disabled:\s*true/.test(patch))
})

test('the entry point declares a name and an apply function', async () => {
  const mod = await load()
  assert.equal(typeof mod.name, 'string')
  assert.ok(mod.name.length > 0)
  assert.equal(typeof mod.apply, 'function')
})

test('every file the package ships exists', async () => {
  const pkg = JSON.parse(await read('package.json'))
  const required = ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'README.md', 'README.en.md', 'CHANGELOG.md', 'LICENSE']
  for (const name of required) {
    assert.ok(pkg.files.includes(name) || pkg.files.some((f) => f.startsWith(name.split('/')[0])), name + ' is not listed in files')
    await read(name)
  }
})

test('the browser half is declared the way the Web host loads it', async () => {
  const pkg = JSON.parse(await read('package.json'))
  assert.equal(pkg.exports['./client'], './client.js')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'))
  assert.ok(pkg.files.includes('client.js'))
})

test('both locale files describe the plugin', async () => {
  for (const lang of ['zh', 'en']) {
    const locale = JSON.parse(await read('locale/' + lang + '.json'))
    assert.equal(typeof locale.meta?.title, 'string')
    assert.equal(typeof locale.meta?.description, 'string')
    assert.ok(locale.meta.title.length > 0)
  }
})

test('the exported name matches the package name', async () => {
  const pkg = JSON.parse(await read('package.json'))
  const mod = await load()
  assert.equal(mod.name, pkg.name)
})

test('normalizeConfig copes with volatile wrappers and missing fields', async () => {
  const { normalizeConfig } = await load()

  const plain = normalizeConfig({ allowedModels: [{ provider: 'beta', model: 'model-y' }] })
  assert.deepEqual(plain, { allowedModels: [{ provider: 'beta', model: 'model-y' }] })

  // The settings layer hands out volatile refs that only answer to get().
  const wrapped = normalizeConfig({
    allowedModels: { get: () => [{ provider: ' alpha ', model: 'model-y' }] },
  })
  assert.deepEqual(wrapped, { allowedModels: [{ provider: 'alpha', model: 'model-y' }] })

  // Junk must fall back to the shipped defaults, never to `undefined`.
  assert.deepEqual(normalizeConfig(undefined), { allowedModels: [] })
  assert.deepEqual(normalizeConfig({ allowedModels: 'nope' }), { allowedModels: [] })
  // Half-filled rows are dropped: a row needs both halves to name a route.
  assert.deepEqual(normalizeConfig({ allowedModels: [{ provider: 'x', model: '' }, { provider: '', model: '' }] }), { allowedModels: [] })
})

test('apply publishes both tools', async () => {
  const { apply } = await load()
  const { ctx, tools } = fakeHost()
  apply(ctx, { allowedModels: [] })
  assert.deepEqual([...tools.keys()].sort(), ['list_routes', 'subagent_route'])
  assert.deepEqual(tools.get('subagent_route').parameters.required, ['description', 'prompt', 'provider', 'model'])
})

test('subagent_route checks the route before it starts anything', async () => {
  const { apply } = await load()
  const llm = fakeLlm()
  const subagents = fakeSubagents()
  const { ctx, tools } = fakeHost({ llm, subagents })
  apply(ctx, {})

  const result = await tools.get('subagent_route').execute(GOOD_ARGS, exec())
  assert.deepEqual(result, { kind: 'activation', name: 'agent-1' })

  // Exactly one preflight, naming the requested route and no inherited effort:
  // the parent runs on another model, so its effort does not carry over.
  assert.equal(llm.calls.length, 1)
  assert.deepEqual(llm.calls[0], { provider: 'beta', model: 'model-y' })

  assert.equal(subagents.started.length, 1)
  const spec = subagents.started[0]
  assert.equal(spec.provider, 'spawn')
  assert.deepEqual(spec.agentOptions, { provider: 'beta', model: 'model-y' })
  assert.deepEqual(spec.prompt, [{ type: 'text', text: 'Say hello and stop.' }])
  assert.equal(spec.label, 'check the other channel')
  assert.equal(spec.maxDepth, 4)
  assert.equal(spec.delivery, 'parent')
  assert.equal(spec.parent, spec.parent)
})

test('subagent_route keeps the parent effort when the route does not change', async () => {
  const { apply } = await load()
  const llm = fakeLlm()
  const { ctx, tools } = fakeHost({ llm })
  apply(ctx, {})

  await tools.get('subagent_route').execute({ ...GOOD_ARGS, provider: 'alpha', model: 'model-x' }, exec())
  assert.equal(llm.calls[0].reasoningEffort, 'max')
})

test('subagent_route passes an explicit effort through', async () => {
  const { apply } = await load()
  const llm = fakeLlm()
  const { ctx, tools } = fakeHost({ llm })
  apply(ctx, {})

  await tools.get('subagent_route').execute({ ...GOOD_ARGS, reasoning_effort: 'low' }, exec())
  assert.equal(llm.calls[0].reasoningEffort, 'low')
})

test('subagent_route refuses to start when the route does not resolve', async () => {
  const { apply } = await load()
  const llm = fakeLlm({
    async resolveCallConfig() {
      throw new Error('provider "beta" model "model-y" does not support reasoning effort "max"')
    },
  })
  const subagents = fakeSubagents()
  const { ctx, tools } = fakeHost({ llm, subagents })
  apply(ctx, {})

  await assert.rejects(
    () => tools.get('subagent_route').execute(GOOD_ARGS, exec()),
    /does not support reasoning effort/,
  )
  assert.equal(subagents.started.length, 0)
})

test('subagent_route respects the allow-list only when one is set', async () => {
  const { apply } = await load()

  const open = fakeHost()
  apply(open.ctx, { allowedModels: [] })
  await open.tools.get('subagent_route').execute(GOOD_ARGS, exec())

  const closed = fakeHost()
  apply(closed.ctx, { allowedModels: [{ provider: 'alpha', model: 'model-x' }] })
  await assert.rejects(
    () => closed.tools.get('subagent_route').execute(GOOD_ARGS, exec()),
    /is not in this plugin's allow-list/,
  )
})

test('subagent_route says so when it has no calling agent', async () => {
  const { apply } = await load()
  const { ctx, tools } = fakeHost()
  apply(ctx, {})
  await assert.rejects(
    () => tools.get('subagent_route').execute(GOOD_ARGS, { signal: { throwIfAborted() {} } }),
    /requires a calling agent/,
  )
})

test('subagent_route reports a route no provider answers to', async () => {
  const { apply } = await load()
  const { ctx, tools } = fakeHost({ subagents: fakeSubagents({ getProvider: () => undefined }) })
  apply(ctx, {})
  await assert.rejects(() => tools.get('subagent_route').execute(GOOD_ARGS, exec()), /no subagent provider is registered under "spawn"/)
})

test('list_routes lists every provider and degrades quietly', async () => {
  const { apply } = await load()
  const { ctx, tools } = fakeHost()
  apply(ctx, {})

  const groups = await tools.get('list_routes').execute({}, exec())
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0], { provider: 'alpha', name: 'Alpha', models: [{ id: 'model-x', name: 'Model X' }] })
  // A provider whose catalog cannot be read still shows up, with a note.
  assert.equal(groups[1].provider, 'beta')
  assert.deepEqual(groups[1].models, [])
  assert.match(groups[1].note, /catalog down/)
})

test('list_routes narrows to one provider and reads one model\'s efforts', async () => {
  const { apply } = await load()
  const { ctx, tools } = fakeHost()
  apply(ctx, {})

  const groups = await tools.get('list_routes').execute({ provider: 'alpha', model: 'model-x' }, exec())
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].models[0].reasoning, {
    efforts: [{ id: 'low', name: 'Low' }, { id: 'max', name: 'Max' }],
    default_effort: 'max',
  })
})

test('list_routes rejects an unknown provider and a model without a provider', async () => {
  const { apply } = await load()
  const { ctx, tools } = fakeHost()
  apply(ctx, {})

  await assert.rejects(() => tools.get('list_routes').execute({ provider: 'nope' }, exec()), /no LLM provider is registered under "nope"/)
  await assert.rejects(() => tools.get('list_routes').execute({ model: 'model-y' }, exec()), /needs provider when model is given/)
})

test('list_routes keeps a model the catalogue omits but the provider accepts', async () => {
  const { apply } = await load()
  const { ctx, tools } = fakeHost()
  apply(ctx, {})

  // alpha lists only model-x, but its adapter still answers for other ids.
  const groups = await tools.get('list_routes').execute({ provider: 'alpha', model: 'not-there' }, exec())
  assert.deepEqual(groups[0].models.map((model) => model.id), ['not-there'])
  assert.match(groups[0].note, /not in this provider's model list, but the provider accepts it/)
  // The reasoning levels come from the provider, not from the catalogue.
  assert.deepEqual(groups[0].models[0].reasoning.default_effort, 'max')
})

test('list_routes says why a model the catalogue omits is refused', async () => {
  const { apply } = await load()
  const llm = fakeLlm({
    async resolveModelInfo() {
      throw new Error('pi-ai provider "alpha" has no configured model "not-there"')
    },
  })
  const { ctx, tools } = fakeHost({ llm })
  apply(ctx, {})

  const groups = await tools.get('list_routes').execute({ provider: 'alpha', model: 'not-there' }, exec())
  assert.deepEqual(groups[0].models, [])
  assert.match(groups[0].note, /"not-there" is not listed by this provider: pi-ai provider "alpha" has no configured model/)
})

test('the tool output renders a readable line per activation', async () => {
  const { apply } = await load()
  const { ctx, tools } = fakeHost()
  apply(ctx, {})
  const rendered = tools.get('subagent_route').output.render(GOOD_ARGS, { kind: 'activation', name: 'agent-1' })
  assert.deepEqual(rendered, [{ type: 'text', text: 'started subagent agent-1 on beta/model-y' }])
})