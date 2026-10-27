/**
 * Offline smoke test for dsh-find-session's Host half.
 *
 * Imports the plugin with a fake `ctx`/`sessionPersistence` and drives the real RPC
 * handler the browser half talks to. It proves the module loads, the channel is
 * registered under the expected name, and the search / context / sessions
 * paths produce the shapes `lib/client.js` consumes.
 *
 * It cannot prove the live Harness accepts the payload — only installing the
 * bundle and opening the panel shows that.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, inject, name } from '../lib/index.js'

// --------------------------------------------------------------- fake Host --

const NOW = Date.UTC(2025, 4, 20, 12, 0, 0)
const DAY = 24 * 60 * 60 * 1000

/** Three sessions: a live one, an archived one, and a subagent. */
const HEADERS = {
  'sess-live': {
    id: 'sess-live',
    cwd: 'D:\\DeepSeek harness\\my projects',
    createdAt: NOW - 2 * DAY,
    agentPreset: 'default',
  },
  'sess-old': {
    id: 'sess-old',
    cwd: 'C:\\work\\other',
    createdAt: NOW - 40 * DAY,
    agentPreset: 'reviewer',
  },
  'sess-child': {
    id: 'sess-child',
    cwd: 'D:\\DeepSeek harness\\my projects',
    createdAt: NOW - 1 * DAY,
    agentPreset: 'default',
    parentSession: 'sess-live',
  },
}

const EVENTS = {
  'sess-live': [
    {
      seq: 1,
      type: 'user/message',
      time: NOW - 2 * DAY,
      data: { content: [{ type: 'text', text: '搓个会话上下文关键词查找' }] },
    },
    {
      seq: 2,
      type: 'assistant/message',
      time: NOW - 2 * DAY + 1000,
      data: {
        turn: 1,
        message: {
          role: 'assistant',
          content: [
            { type: 'reasoning', text: '先确认 FTS5 的 unicode61 分词对 CJK 的处理' },
            { type: 'text', text: '我来做会话内查找。' },
          ],
        },
      },
    },
    {
      seq: 3,
      type: 'tool/call',
      time: NOW - 2 * DAY + 2000,
      data: { turn: 1, name: 'grep', arguments: '{"pattern":"unicode61"}' },
    },
    {
      seq: 4,
      type: 'tool/result',
      time: NOW - 2 * DAY + 3000,
      data: { turn: 1, message: { role: 'user', content: [{ type: 'text', text: 'no matches' }] } },
    },
    {
      seq: 5,
      type: 'assistant/message',
      time: NOW - 2 * DAY + 4000,
      data: { turn: 1, message: { role: 'assistant', content: [{ type: 'text', text: '分词确认完毕。' }] } },
    },
  ],
  'sess-old': [
    {
      seq: 1,
      type: 'user/message',
      time: NOW - 40 * DAY,
      data: { content: [{ type: 'text', text: 'old session about unicode61 tokenizer' }] },
    },
  ],
  'sess-child': [
    {
      seq: 1,
      type: 'user/message',
      time: NOW - 1 * DAY,
      data: { content: [{ type: 'text', text: '子会话：unicode61 与 CJK' }] },
    },
  ],
}

/**
 * The two Host services `lib/index.js` actually gates on in this profile:
 * `sessionPersistence` (durable store) and `sessions` (in-memory live store).
 */
function makeStore(overrides = {}) {
  const calls = []
  const store = {
    calls,
    persistence: {
      async list() {
        calls.push(['list'])
        return Object.keys(HEADERS).map((id) => ({ header: HEADERS[id] }))
      },
      async open(id, access, options) {
        calls.push(['open', id, access])
        assert.equal(access, 'read', 'the search half only ever opens read handles')
        const events = EVENTS[id]
        if (events === undefined) throw new Error(`no such session: ${id}`)
        let closed = false
        return {
          id,
          header: HEADERS[id],
          inheritedEventCount: 0,
          access,
          async read(offset, length, readOptions) {
            calls.push(['read', id, offset])
            assert.equal(offset, 0, 'the whole log is read in one call')
            assert.equal(length, undefined)
            void readOptions
            return { eventState: 'shared-frozen', events }
          },
          async close() {
            assert.equal(closed, false, 'a handle is closed exactly once')
            closed = true
            calls.push(['close', id])
          },
          ...options === undefined ? {} : {},
        }
      },
    },
    sessions: {
      list() {
        return [{ id: 'sess-live', header: HEADERS['sess-live'] }]
      },
    },
    ...overrides,
  }
  return store
}

/** A `ctx` that records the RPC channel and lets the test call it. */
function makeCtx(store) {
  const state = { handler: undefined, channel: undefined, disposers: [] }
  const ctx = {
    // The route is gated on `connection` alone so a deferred data service can
    // never silently disable the feature; data services resolve per request.
    inject(services, run) {
      assert.deepEqual(services, ['connection'])
      run({
        get(service) {
          if (service === 'connection') {
            return {
              rpc: {
                handle(channel, handler) {
                  state.channel = channel
                  state.handler = handler
                  return () => {
                    state.handler = undefined
                  }
                },
              },
            }
          }
          return undefined
        },
        effect(dispose) {
          state.disposers.push(dispose)
          return dispose
        },
      })
      return () => {}
    },
    get(service) {
      if (service === 'sessionPersistence') return store.persistence
      if (service === 'sessions') return store.sessions
      return undefined
    },
    effect(dispose, label) {
      assert.equal(typeof dispose, 'function')
      assert.equal(typeof label, 'string')
      const fn = dispose()
      if (typeof fn === 'function') state.disposers.push(fn)
      return fn
    },
  }
  return { ctx, state }
}

async function boot() {
  const store = makeStore()
  const { ctx, state } = makeCtx(store)
  apply(ctx)
  assert.equal(state.channel, '/dsh-find-session', 'channel name is shared with the client')
  assert.equal(typeof state.handler, 'function', 'rpc handler registered')
  const call = (endpoint, payload) => state.handler(endpoint, payload, undefined, undefined)
  return { store, state, call }
}

// -------------------------------------------------------------------- tests --

test('module shape', () => {
  assert.equal(name, 'dsh-find-session')
  assert.deepEqual(inject, [])
  assert.equal(typeof apply, 'function')
})

test('the RPC channel name matches the one lib/client.js posts to', async () => {
  const { state } = await boot()
  assert.equal(state.channel, '/dsh-find-session')
})

test('ping reports readiness', async () => {
  const { call } = await boot()
  const reply = await call('ping', {})
  assert.deepEqual(reply, { ok: true, value: { ready: true } })
})

test('an unknown endpoint fails instead of throwing', async () => {
  const { call } = await boot()
  const reply = await call('nope', {})
  assert.equal(reply.ok, false)
  assert.equal(reply.error.code, 'unknown-endpoint')
})

test('in-session search finds CJK text that FTS5 unicode61 would tokenize whole', async () => {
  const { call } = await boot()
  const reply = await call('search', { query: '会话', target: 'session', sessionId: 'sess-live' })
  assert.equal(reply.ok, true)
  const { items } = reply.value
  assert.ok(items.length >= 2, `expected several hits, got ${items.length}`)
  for (const item of items) {
    assert.equal(item.sessionId, 'sess-live')
    assert.equal(item.kind, 'body')
    assert.ok(item.text.includes('会话'))
  }
  // Reports the snippet offsets of the FIRST hit inside the snippet string.
  const first = items[0]
  assert.equal(first.snippet.slice(first.matchStart, first.matchEnd), '会话')
})

test('in-session search requires a sessionId', async () => {
  const { call } = await boot()
  const reply = await call('search', { query: '会话', target: 'session' })
  assert.equal(reply.ok, false)
  assert.equal(reply.error.code, 'no-session')
})

test('an empty query returns an empty page rather than everything', async () => {
  const { call } = await boot()
  const reply = await call('search', { query: '', target: 'session', sessionId: 'sess-live' })
  assert.deepEqual(reply, { ok: true, value: { items: [], total: 0, hasMore: false, offset: 0 } })
})

test('an invalid regex reports the compile error', async () => {
  const { call } = await boot()
  const reply = await call('search', { query: '(', match: 'regex', target: 'session', sessionId: 'sess-live' })
  assert.equal(reply.ok, false)
  assert.equal(reply.error.code, 'bad-regex')
})

test('scope is off by default for tool and thinking chunks', async () => {
  const { call } = await boot()
  const bodyOnly = await call('search', { query: 'unicode61', target: 'session', sessionId: 'sess-live' })
  assert.equal(bodyOnly.value.total, 0, 'the only unicode61 mention lives in a tool call')

  const withTools = await call('search', {
    query: 'unicode61',
    target: 'session',
    sessionId: 'sess-live',
    scope: { body: true, tools: true },
  })
  assert.equal(withTools.value.total, 1)
  assert.equal(withTools.value.items[0].kind, 'tool')

  const withThinking = await call('search', {
    query: 'unicode61',
    target: 'session',
    sessionId: 'sess-live',
    scope: { body: true, thinking: true },
  })
  assert.equal(withThinking.value.total, 1)
  assert.equal(withThinking.value.items[0].kind, 'thinking')
})

test('global search spans sessions and sorts newest first', async () => {
  const { call } = await boot()
  const reply = await call('search', { query: 'unicode61', target: 'global', scope: { body: true, tools: true } })
  assert.equal(reply.ok, true)
  const ids = reply.value.items.map((item) => item.sessionId)
  assert.deepEqual([...new Set(ids)].sort(), ['sess-child', 'sess-live', 'sess-old'])
  const times = reply.value.items.map((item) => item.time)
  assert.deepEqual(times, [...times].sort((left, right) => right - left))
})

test('global search honours the cwd filter', async () => {
  const { call } = await boot()
  const reply = await call('search', {
    query: 'unicode61',
    target: 'global',
    scope: { body: true, tools: true },
    filters: { cwds: ['D:\\DeepSeek harness\\my projects'] },
  })
  const ids = [...new Set(reply.value.items.map((item) => item.sessionId))].sort()
  assert.deepEqual(ids, ['sess-child', 'sess-live'])
})

test('global search can exclude subagent sessions', async () => {
  const { call } = await boot()
  const reply = await call('search', {
    query: 'unicode61',
    target: 'global',
    scope: { body: true, tools: true },
    filters: { includeSubagents: false },
  })
  const ids = [...new Set(reply.value.items.map((item) => item.sessionId))].sort()
  assert.deepEqual(ids, ['sess-live', 'sess-old'])
})

test('global search honours the created-at window', async () => {
  const { call } = await boot()
  const reply = await call('search', {
    query: 'unicode61',
    target: 'global',
    scope: { body: true, tools: true },
    filters: { from: NOW - 7 * DAY },
  })
  const ids = [...new Set(reply.value.items.map((item) => item.sessionId))].sort()
  assert.deepEqual(ids, ['sess-child', 'sess-live'])
})

test('paging reports hasMore and slices by offset', async () => {
  const { call } = await boot()
  const first = await call('search', {
    query: 'unicode61',
    target: 'global',
    scope: { body: true, tools: true },
    limit: 1,
    offset: 0,
  })
  assert.equal(first.value.items.length, 1)
  assert.equal(first.value.hasMore, true)

  const second = await call('search', {
    query: 'unicode61',
    target: 'global',
    scope: { body: true, tools: true },
    limit: 1,
    offset: 1,
  })
  assert.equal(second.value.items.length, 1)
  assert.notEqual(second.value.items[0].sessionId + second.value.items[0].seq, first.value.items[0].sessionId + first.value.items[0].seq)
})

test('context returns neighbours around a known seq', async () => {
  const { call } = await boot()
  const reply = await call('context', { sessionId: 'sess-live', seq: 3, before: 1, after: 1, scope: { body: true, tools: true } })
  assert.equal(reply.ok, true)
  assert.equal(reply.value.anchored, true)
  assert.equal(reply.value.target.seq, 3)
  assert.equal(reply.value.before.length, 1)
  assert.equal(reply.value.after.length, 1)
  assert.equal(reply.value.before[0].seq, 2)
  assert.equal(reply.value.after[0].seq, 4)
})

test('context anchors on the closest earlier document when the seq is unknown', async () => {
  const { call } = await boot()
  const reply = await call('context', { sessionId: 'sess-live', seq: 999, before: 0, after: 0, scope: { body: true } })
  assert.equal(reply.ok, true)
  assert.equal(reply.value.anchored, false)
  assert.equal(reply.value.target.seq, 5)
})

test('context rejects a missing sessionId', async () => {
  const { call } = await boot()
  const reply = await call('context', { seq: 1 })
  assert.equal(reply.ok, false)
  assert.equal(reply.error.code, 'no-session')
})

test('sessions lists the filter values the dropdowns need', async () => {
  const { call } = await boot()
  const reply = await call('sessions', {})
  assert.equal(reply.ok, true)
  assert.deepEqual(reply.value.cwds, ['C:\\work\\other', 'D:\\DeepSeek harness\\my projects'])
  assert.deepEqual(reply.value.presets, ['default', 'reviewer'])
  assert.equal(reply.value.total, 3)
  const live = reply.value.items.find((item) => item.sessionId === 'sess-live')
  assert.equal(live.live, true)
  const child = reply.value.items.find((item) => item.sessionId === 'sess-child')
  assert.equal(child.isSubagent, true)
})

test('a session that fails to read is skipped, not fatal', async () => {
  const store = makeStore()
  const open = store.persistence.open.bind(store.persistence)
  store.persistence.open = async (id, access, options) => {
    if (id === 'sess-old') throw new Error('boom')
    return open(id, access, options)
  }
  const { ctx, state } = makeCtx(store)
  apply(ctx)
  const reply = await state.handler('search', { query: 'unicode61', target: 'global', scope: { body: true, tools: true } }, undefined, undefined)
  assert.equal(reply.ok, true)
  const ids = [...new Set(reply.value.items.map((item) => item.sessionId))].sort()
  assert.deepEqual(ids, ['sess-child', 'sess-live'])
})

test('an aborted signal stops a global scan without an error', async () => {
  const { state } = await boot()
  const controller = new AbortController()
  controller.abort()
  const reply = await state.handler('search', { query: 'unicode61', target: 'global' }, controller.signal, undefined)
  assert.equal(reply.ok, true)
  assert.deepEqual(reply.value.items, [])
})

test('the live cache is reused across two identical in-session searches', async () => {
  const { call, store } = await boot()
  await call('search', { query: '会话', target: 'session', sessionId: 'sess-live' })
  const afterFirst = store.calls.filter((entry) => entry[0] === 'read').length
  await call('search', { query: '会话', target: 'session', sessionId: 'sess-live' })
  const afterSecond = store.calls.filter((entry) => entry[0] === 'read').length
  assert.equal(afterSecond, afterFirst, 'the second search within LIVE_CACHE_MS must not re-read the log')
})

test('every opened handle is closed on both the search and the context path', async () => {
  // Separate boots so the document cache cannot satisfy the second path.
  const search = await boot()
  await search.call('search', { query: '会话', target: 'session', sessionId: 'sess-live' })
  const context = await boot()
  await context.call('context', { sessionId: 'sess-live', seq: 1 })

  for (const [label, store] of [['search', search.store], ['context', context.store]]) {
    const opened = store.calls.filter((entry) => entry[0] === 'open').length
    const closed = store.calls.filter((entry) => entry[0] === 'close').length
    assert.equal(opened, 1, `the ${label} path reads the log exactly once`)
    assert.equal(closed, opened, `the ${label} path must not leak a read handle`)
  }
})
