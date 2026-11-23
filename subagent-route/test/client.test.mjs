import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * Minimal React stand-in. Hooks keep their state between renders of the same
 * mounted tree, so a test can click something and re-render, the way the host
 * does. Effects run after each render pass.
 */
let ACTIVE = null

function fakeReact() {
  return {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) {
      const runtime = ACTIVE
      const index = runtime.cursor++
      if (runtime.hooks[index] === undefined) {
        runtime.hooks[index] = { value: typeof initial === 'function' ? initial() : initial }
      }
      const slot = runtime.hooks[index]
      const set = (next) => {
        const value = typeof next === 'function' ? next(slot.value) : next
        if (!Object.is(value, slot.value)) {
          slot.value = value
          runtime.changed = true
        }
      }
      return [slot.value, set]
    },
    useEffect(effect, deps) {
      const runtime = ACTIVE
      const index = runtime.cursor++
      const slot = runtime.hooks[index] ?? (runtime.hooks[index] = { deps: undefined })
      const previous = slot.deps
      const same = previous !== undefined && deps !== undefined &&
        previous.length === deps.length && previous.every((value, i) => Object.is(value, deps[i]))
      slot.deps = deps === undefined ? undefined : deps.slice()
      if (!same) runtime.effects.push(effect)
    },
  }
}

/** Load `client.js` the way the Web host does, through `window.__ModuleLoader__`. */
function loadBundle() {
  let definition
  globalThis.window = {
    __ModuleLoader__: {
      load(candidate) {
        definition = candidate
      },
    },
  }
  const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  new Function('window', source)(globalThis.window)
  const module = definition.factory((name) => {
    if (name === 'react') return fakeReact()
    throw new Error(`unexpected require: ${name}`)
  })
  return { id: definition.id, module }
}

/** Render a component until its state stops changing, then hand back the tree. */
function mount(component, props) {
  const runtime = { hooks: [], cursor: 0, effects: [], changed: false }
  ACTIVE = runtime
  function render() {
    for (let pass = 0; pass < 50; pass += 1) {
      runtime.cursor = 0
      runtime.changed = false
      runtime.effects = []
      const tree = component(props)
      const effects = runtime.effects
      runtime.effects = []
      // Effects run after the render that asked for them, as React does.
      for (const effect of effects) effect()
      if (!runtime.changed) return tree
    }
    throw new Error('the page never settled: a state update keeps re-rendering')
  }
  return { render }
}

/** Let pending promises resolve so a catalogue answer reaches the page. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** A stand-in for the ConfigFormController the settings mirror hands out. */
function fakeForm(values) {
  const listeners = new Set()
  const calls = []
  let revision = 1
  return {
    values,
    calls,
    getSnapshot: () => ({ status: 'ready', value: values, revision, writable: true }),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async mutate(ops, expected) {
      calls.push({ ops, expected })
      for (const op of ops) {
        if (op.op === 'set') values[op.path[0]] = op.value
      }
      revision += 1
      return true
    },
    async set(key, value) {
      calls.push({ key, value })
      values[key] = value
      revision += 1
      return true
    },
  }
}

/** A remote whose model catalogue answers with the given groups. */
function fakeRemote(groups, options = {}) {
  const remote = {
    asked: 0,
    session: {
      async modelCatalog() {
        remote.asked += 1
        if (options.message !== undefined) {
          return { ok: false, error: { code: 'unavailable', message: options.message } }
        }
        return { ok: true, value: { groups, failures: options.failures ?? [] } }
      },
    },
  }
  return remote
}

/** A stand-in for the client context: just the services the bundle injects. */
function fakeContext(form, remote) {
  const registered = []
  return {
    registered,
    ctx: {
      configForms: {
        get: (ns) => (ns === 'subagent-route' ? form : undefined),
        whileServed: (_namespaces, register) => register(),
      },
      slots: {
        inject: (_name, register) => register(),
        register(meta, component) {
          registered.push({ meta, component })
          return () => {}
        },
      },
      effect: (fn) => fn(),
      remote,
    },
  }
}

/** The rendered tree without its <style> block, so class-name assertions mean markup. */
function markup(page) {
  return JSON.stringify(page, (key, value) => {
    if (key === 'children' && Array.isArray(value)) {
      return value.filter((child) => child === null || typeof child !== 'object' || child.type !== 'style')
    }
    return value
  })
}

/** Walk the tree and return every node that matches, flattening child arrays. */
function find(page, predicate) {
  const hits = []
  const stack = [page]
  while (stack.length > 0) {
    const node = stack.pop()
    if (node === null || typeof node !== 'object') continue
    if (Array.isArray(node)) {
      stack.push(...node)
      continue
    }
    if (predicate(node)) hits.push(node)
    if (Array.isArray(node.children)) stack.push(...node.children)
  }
  return hits
}

/** One checkbox in the model list. */
function checkbox(page, provider, model) {
  const rows = find(page, (node) => node.type === 'label' && node.props.className === 'dsr-model')
  const hit = rows.find((row) => markup(row).includes(provider + ' / ' + model))
  assert.ok(hit, `no checkbox for ${provider}/${model}`)
  return hit.children.find((child) => child !== null && typeof child === 'object' && child.props.type === 'checkbox')
}

/** Click a button by its visible class name. */
function button(page, className) {
  const hit = find(page, (node) => node.type === 'button' && node.props.className === className)[0]
  assert.ok(hit, `no ${className} button`)
  return hit
}

const ALPHA_X = { id: 'alpha', name: 'Alpha', models: [{ id: 'model-x', name: 'Model X' }] }
const BETA_Y = { id: 'beta', name: 'Beta', models: [{ id: 'model-y', name: 'Model Y' }] }

/** Mount the registered page against a form and a catalogue. */
async function page(values, groups = [ALPHA_X, BETA_Y], options = {}) {
  const { module } = loadBundle()
  const form = fakeForm(values)
  const remote = options.remote ?? fakeRemote(groups, options)
  const { ctx, registered } = fakeContext(form, remote)
  module.apply(ctx)
  const view = mount(registered[0].component, { view: options.view ?? 'page', configForm: form, remote })
  const first = view.render()
  await settle()
  return { form, remote, view, page: view.render(), first, registered, module }
}

describe('client bundle', () => {
  it('loads under the package name and exports a mountable plugin', () => {
    const { id, module } = loadBundle()
    assert.equal(id, 'dsh-subagent-route')
    assert.equal(module.name, 'dsh-subagent-route')
    assert.deepEqual(module.inject, ['slots', 'configForms', 'remote', 'remote.session'])
    assert.equal(typeof module.apply, 'function')
  })

  it('registers the settings slot under the package name', () => {
    const { module } = loadBundle()
    const form = fakeForm({ allowedModels: [] })
    const remote = fakeRemote([])
    const { ctx, registered } = fakeContext(form, remote)
    module.apply(ctx)
    assert.equal(registered.length, 1)
    assert.equal(registered[0].meta.name, 'plugins.bundle.config')
    assert.equal(registered[0].meta.key, 'dsh-subagent-route')
    assert.equal(registered[0].meta.inject().configForm, form)
    assert.equal(registered[0].meta.inject().remote, remote)
  })

  it('lists every offered model, grouped by channel', async () => {
    const { page: tree } = await page({ allowedModels: [] })
    const text = markup(tree)
    assert.ok(text.includes('Alpha'), 'the channel name is the group heading')
    assert.ok(text.includes('alpha / model-x'))
    assert.ok(text.includes('Model Y'))
    assert.ok(text.includes('beta / model-y'))
  })

  it('starts with nothing checked and says that means no restriction', async () => {
    const { page: tree } = await page({ allowedModels: [] })
    const text = markup(tree)
    assert.ok(!text.includes('"checked":true'), 'nothing is checked to begin with')
    assert.ok(text.includes('dsr-hint'))
    assert.ok(!text.includes('dsr-actions'), 'an untouched page offers nothing to save')
  })

  it('checks the routes that are already stored', async () => {
    const { page: tree } = await page({ allowedModels: [{ provider: 'beta', model: 'model-y' }] })
    assert.equal(checkbox(tree, 'beta', 'model-y').props.checked, true)
    assert.equal(checkbox(tree, 'alpha', 'model-x').props.checked, false)
  })

  it('reads volatile refs the settings layer may hand through', async () => {
    const { page: tree } = await page({ allowedModels: { get: () => [{ provider: 'alpha', model: 'model-x' }] } })
    assert.equal(checkbox(tree, 'alpha', 'model-x').props.checked, true)
  })

  it('keeps a stored route that its channel no longer offers, so it can be unticked', async () => {
    const { page: tree } = await page(
      { allowedModels: [{ provider: 'gamma', model: 'model-old' }] },
      [ALPHA_X],
    )
    const text = markup(tree)
    assert.ok(text.includes('gamma / model-old'), 'the stale route is still listed')
    assert.ok(text.includes('dsr-gone'), 'and it is flagged as no longer offered')
    assert.equal(checkbox(tree, 'gamma', 'model-old').props.checked, true)
  })

  it('ticking a model offers a save, and saving writes the allow-list once', async () => {
    const held = await page({ allowedModels: [] })
    const ticked = checkbox(held.page, 'beta', 'model-y')
    ticked.props.onChange()

    const withSave = held.view.render()
    assert.ok(markup(withSave).includes('dsr-actions'), 'a change offers to be saved')

    button(withSave, 'dsr-save').props.onClick()
    await settle()
    held.view.render()

    assert.equal(held.form.calls.length, 1, 'one write, not one per field')
    assert.deepEqual(held.form.calls[0].ops, [{
      op: 'set',
      path: ['allowedModels'],
      value: [{ provider: 'beta', model: 'model-y' }],
    }])
    assert.equal(held.form.calls[0].expected, 1, 'the write is fenced to the revision the page rendered')
  })

  it('unticking a stored route writes a shorter allow-list', async () => {
    const held = await page({ allowedModels: [{ provider: 'alpha', model: 'model-x' }, { provider: 'beta', model: 'model-y' }] })
    checkbox(held.page, 'alpha', 'model-x').props.onChange()
    const withSave = held.view.render()
    button(withSave, 'dsr-save').props.onClick()
    await settle()
    assert.deepEqual(held.form.calls[0].ops[0].value, [{ provider: 'beta', model: 'model-y' }])
  })

  it('offers a retry when the catalogue cannot be read', async () => {
    const held = await page({ allowedModels: [] }, [], { message: 'the host did not answer' })
    const first = markup(held.page)
    assert.ok(first.includes('the host did not answer'))
    assert.ok(first.includes('dsr-retry'))

    button(held.page, 'dsr-retry').props.onClick()
    await settle()
    assert.equal(held.remote.asked, 2, 'pressing retry asks again')
  })

  it('renders a one-line summary without reading the catalogue', async () => {
    const { page: tree, remote } = await page(
      { allowedModels: [{ provider: 'beta', model: 'model-y' }] },
      [ALPHA_X, BETA_Y],
      { view: 'summary' },
    )
    assert.equal(tree.type, 'span')
    assert.ok(markup(tree).includes('dsr-summary'))
    assert.equal(remote.asked, 0, 'the summary row never touches the model list')
  })

  it('shows a loading line while the host has handed over no form yet', () => {
    const { module } = loadBundle()
    const { ctx, registered } = fakeContext(fakeForm({ allowedModels: [] }), fakeRemote([]))
    module.apply(ctx)
    // No configForm prop: that is what the host passes before the mirror answers.
    const tree = mount(registered[0].component, { view: 'page' }).render()
    assert.equal(tree.type, 'p')
    assert.equal(tree.props.className, 'dsr-foot')
  })

  it('stays quiet when the settings service is missing', () => {
    const { module } = loadBundle()
    const original = console.error
    console.error = () => {}
    try {
      module.apply({ configForms: undefined, slots: {}, effect: (fn) => fn(), remote: undefined })
    } finally {
      console.error = original
    }
  })
})