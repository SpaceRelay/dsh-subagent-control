import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/** Minimal React stand-in: enough for the page to render one element tree. */
function fakeReact() {
  return {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
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

/** A stand-in for the ConfigFormController the settings mirror hands out. */
function fakeForm(values) {
  const listeners = new Set()
  return {
    values,
    getSnapshot: () => ({ status: 'ready', value: values, revision: 1 }),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async set(key, value) {
      values[key] = value
    },
  }
}

/** A stand-in for the client context: just the two services the bundle injects. */
function fakeContext(form) {
  const registered = []
  return {
    registered,
    ctx: {
      configForms: { get: (ns) => (ns === 'human-wait' ? form : undefined), whileServed: (_namespaces, register) => register() },
      slots: {
        inject: (_name, register) => register(),
        register(meta, component) {
          registered.push({ meta, component })
          return () => {}
        },
      },
      effect: (fn) => fn(),
    },
  }
}

describe('client bundle', () => {
  it('loads under the package name and exports a mountable plugin', () => {
    const { id, module } = loadBundle()
    assert.equal(id, 'dsh-human-wait')
    assert.equal(module.name, 'dsh-human-wait')
    assert.deepEqual(module.inject, ['slots', 'configForms'])
    assert.equal(typeof module.apply, 'function')
  })

  it('registers the settings slot under the package name', () => {
    const { module } = loadBundle()
    const form = fakeForm({ enabled: true, humanWaitCapMs: 86_400_000 })
    const { ctx, registered } = fakeContext(form)
    module.apply(ctx)
    assert.equal(registered.length, 1)
    assert.equal(registered[0].meta.name, 'plugins.bundle.config')
    assert.equal(registered[0].meta.key, 'dsh-human-wait')
    assert.equal(registered[0].meta.inject().configForm, form)
  })

  it('renders the page with the current values', () => {
    const { module } = loadBundle()
    const form = fakeForm({ enabled: true, humanWaitCapMs: 3_600_000 })
    const { ctx, registered } = fakeContext(form)
    module.apply(ctx)
    const page = registered[0].component({ view: 'page', configForm: form })
    assert.equal(page.type, 'div')
    assert.equal(page.props.className, 'dhw')
    const text = JSON.stringify(page)
    assert.ok(text.includes('dhw-cap'))
    assert.ok(text.includes('3600000'))
    // The enable switch is not on the page: only the wait cap is editable here.
    assert.ok(!text.includes('dhw-enabled'))
    assert.ok(!text.includes('启用'))
    assert.ok(!text.includes('Runtime'))
  })

  it('renders a one-line summary', () => {
    const { module } = loadBundle()
    const form = fakeForm({ enabled: false, humanWaitCapMs: -1 })
    const { ctx, registered } = fakeContext(form)
    module.apply(ctx)
    const summary = registered[0].component({ view: 'summary', configForm: form })
    assert.equal(summary.type, 'span')
    const text = JSON.stringify(summary)
    assert.ok(text.includes('dhw-summary'))
    assert.ok(text.includes('unlimited') || text.includes('无限'))
    assert.ok(!text.includes('已启用') && !text.includes('已停用') && !text.includes('"on"'))
  })

  it('stays quiet when the settings service is missing', () => {
    const { module } = loadBundle()
    module.apply({ configForms: undefined, slots: {}, effect: (fn) => fn() })
  })
})
