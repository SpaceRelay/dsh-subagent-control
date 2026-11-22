// Offline checks for dsh-team-limits 2.0.0: no DSH process, no network.
//
// What this proves: the plugin pushes the two live settings onto the shipped
// `agent-team` row and deletes the three keys DSH 0.2.2 removed, does not write
// again when the row already matches, and never throws when the config editor
// is missing. What it does not prove: that the harness accepts the row — that
// needs a running DSH (`Config.listConfigs` for `include:agent-team`).

import assert from 'node:assert/strict'
import { apply, Config, inject, name } from '../index.js'

const ROW = 'agent-team'
const OLD = {
  maxMembers: 32,
  maxTasks: 512,
  maxMessageBytes: 131072,
  disposalTimeoutMs: 5000,
}
const GONE = ['maxMembers', 'maxMessageBytes', 'disposalTimeoutMs']

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function harness(initialOverride, options = {}) {
  const writes = []
  const listeners = new Map()
  let override = initialOverride
  const ctx = {
    settings: {
      configure() {},
    },
    configEditor: {
      configuration() {
        return [{ entry: { options: { id: ROW } }, inherited: {}, override }]
      },
      async edit(_entry, change) {
        override = change(override, {})
        writes.push(override)
      },
    },
    get(name) {
      return name === 'agentTeams' ? options.teams : undefined
    },
    on(type, listener) {
      const list = listeners.get(type) ?? []
      list.push(listener)
      listeners.set(type, list)
      return () => {}
    },
    emit(type, payload) {
      for (const listener of listeners.get(type) ?? []) listener(payload)
    },
    inject(_names, callback) {
      callback(ctx)
    },
    effect(setup) {
      return setup()
    },
    fiber: {},
  }
  return { ctx, writes, override: () => override }
}

assert.equal(name, 'dsh-team-limits')
assert.deepEqual(inject, ['configEditor'])
console.log('ok: module exports name=%s inject=%j', name, inject)

if (Config === undefined) {
  console.log('skip: @deepseek-ai/schemastery is not resolvable here, Config schema not checked')
} else {
  assert.ok(Config !== undefined && Config !== null)
  console.log('ok: Config schema is exported')
}

// 1. A row carrying the old four keys is rewritten to exactly the two live ones.
{
  const { ctx, writes, override } = harness(OLD)
  apply(ctx, { maxTasks: 1024, defaultEnabled: true })
  await sleep(1500)
  assert.equal(writes.length, 1, 'expected exactly one write')
  assert.deepEqual(override(), { maxTasks: 1024, defaultEnabled: true })
  for (const key of GONE) {
    assert.equal(Object.hasOwn(override(), key), false, `${key} must be removed`)
  }
  console.log('ok: push removes %j and writes %j', GONE, override())
}

// 2. An already-clean row is left alone.
{
  const { ctx, writes } = harness({ maxTasks: 1024, defaultEnabled: true })
  apply(ctx, { maxTasks: 1024, defaultEnabled: true })
  await sleep(1500)
  assert.equal(writes.length, 0, 'a matching row must not be rewritten')
  console.log('ok: no write when the row already matches')
}

// 3. Missing configEditor: apply must not throw and must not block startup.
{
  const bare = {
    get() {
      return undefined
    },
    inject() {},
    effect(setup) {
      return setup()
    },
    fiber: {},
  }
  assert.doesNotThrow(() => apply(bare, { maxTasks: 256, defaultEnabled: false }))
  console.log('ok: fail-open without configEditor')
}

// 4. A fresh root session is turned on when the saved default is true.
{
  const calls = []
  const teams = {
    setEnabled(agent, enabled) {
      calls.push([agent, enabled])
      return Promise.resolve()
    },
  }
  const { ctx } = harness({ maxTasks: 1024, defaultEnabled: true }, { teams })
  apply(ctx, { maxTasks: 1024, defaultEnabled: true })
  const agent = { session: { header: { id: 'fresh' }, log: [{ type: 'permission/preset' }, { type: 'sandbox/mode' }] } }
  ctx.emit('agent/created', { agent })
  await sleep(0)
  assert.equal(calls.length, 1, 'a fresh session must be enabled once')
  assert.equal(calls[0][0], agent)
  assert.equal(calls[0][1], true)
  console.log('ok: fresh root session is enabled by default')
}

// 5. A session that already chose, or already ran, is left alone.
{
  const calls = []
  const teams = { setEnabled: (agent, enabled) => calls.push([agent, enabled]) }
  const { ctx } = harness({ maxTasks: 1024, defaultEnabled: true }, { teams })
  apply(ctx, { maxTasks: 1024, defaultEnabled: true })
  ctx.emit('agent/created', { agent: { session: { header: {}, log: [{ type: 'team/mode', data: { enabled: false } }] } } })
  ctx.emit('agent/created', { agent: { session: { header: {}, log: [{ type: 'turn/start' }] } } })
  ctx.emit('agent/created', { agent: { session: { header: { origin: 'subagent' }, log: [] } } })
  await sleep(0)
  assert.equal(calls.length, 0, 'chosen, used or delegated sessions must not be touched')
  console.log('ok: no override for a session that chose, ran or is a subagent')
}

// 6. With the default off nothing happens at all.
{
  const calls = []
  const teams = { setEnabled: (agent, enabled) => calls.push([agent, enabled]) }
  const { ctx } = harness({ maxTasks: 1024, defaultEnabled: false }, { teams })
  apply(ctx, { maxTasks: 1024, defaultEnabled: false })
  ctx.emit('agent/created', { agent: { session: { header: {}, log: [] } } })
  await sleep(0)
  assert.equal(calls.length, 0)
  console.log('ok: nothing happens while the default is off')
}

// 7. A missing team service is not fatal.
{
  const { ctx } = harness({ maxTasks: 1024, defaultEnabled: true }, {})
  apply(ctx, { maxTasks: 1024, defaultEnabled: true })
  assert.doesNotThrow(() => ctx.emit('agent/created', { agent: { session: { header: {}, log: [] } } }))
  console.log('ok: fail-open without the agentTeams service')
}

console.log('OK: 2.2.0 behaviour checks passed')
process.exit(0)