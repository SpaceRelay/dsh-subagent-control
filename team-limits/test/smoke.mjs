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

function harness(initialOverride) {
  const writes = []
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
    get() {
      return undefined
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

console.log('OK: 2.0.0 behaviour checks passed')
process.exit(0)
