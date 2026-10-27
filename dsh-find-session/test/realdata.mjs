/**
 * End-to-end validation of the Host half against REAL session files on disk.
 *
 * The unit tests use hand-built fixtures; this harness replays the actual
 * `session.v4.jsonl.zstd` logs of this machine through `apply()`'s RPC handler
 * with a fake Cordis ctx, which is the closest thing to the running Host we can
 * get without restarting it.
 *
 * Run: node test/realdata.mjs [query]
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import { apply } from '../lib/index.js'

const SESSIONS_ROOT = 'C:/Users/Administrator/.dsh/sessions'

/** Decode one `session.v4.jsonl.zstd` file into its events. */
function readLog(dir) {
  const file = path.join(dir, 'session.v4.jsonl.zstd')
  const text = zlib.zstdDecompressSync(fs.readFileSync(file)).toString('utf8')
  const events = []
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    try {
      events.push(JSON.parse(line))
    } catch {
      // A torn tail line is expected while a session is still being written.
    }
  }
  return events
}

/** Minimal stand-in for `sessionPersistence`, backed by the real session dirs. */
function createPersistence(root) {
  const dirs = new Map()
  // Layout is `<root>/<cwd slug>/<session id>/session.v4.jsonl.zstd`.
  for (const slug of fs.readdirSync(root)) {
    const slugDir = path.join(root, slug)
    if (!fs.statSync(slugDir).isDirectory()) continue
    for (const name of fs.readdirSync(slugDir)) {
      const dir = path.join(slugDir, name)
      const file = path.join(dir, 'session.v4.jsonl.zstd')
      if (!fs.existsSync(file)) continue
      let events
      try {
        events = readLog(dir)
      } catch {
        continue
      }
      const header = events.find((event) => event.type === 'session')
      if (header === undefined || typeof header.id !== 'string') continue
      dirs.set(header.id, { header, events })
    }
  }

  return {
    async list() {
      return [...dirs.values()].map((entry) => ({ header: entry.header }))
    },
    async open(id) {
      const entry = dirs.get(id)
      if (entry === undefined) throw new Error(`no such session: ${id}`)
      return {
        id,
        header: entry.header,
        async read() {
          return { eventState: 'shared-frozen', events: entry.events }
        },
        async close() {},
      }
    },
  }
}

/** A fake Cordis ctx exposing only what `apply()` touches. */
function createCtx(connection, services) {
  const handler = { current: undefined }
  const ctx = {
    logger: { warn() {}, info() {} },
    get(name) {
      if (name === 'sessionPersistence') return services.persistence
      if (name === 'sessions') return services.sessions
      if (name === 'connection') return connection
      return undefined
    },
    inject(_deps, callback) {
      const scope = {
        root: { connection },
        get: (name) => ctx.get(name),
        effect: (factory) => {
          const dispose = typeof factory === 'function' ? factory() : undefined
          return () => {
            if (typeof dispose === 'function') dispose()
          }
        },
      }
      callback(scope)
    },
    effect(factory) {
      return typeof factory === 'function' ? factory() : undefined
    },
  }
  return { ctx, handler }
}

const services = { persistence: createPersistence(SESSIONS_ROOT), sessions: undefined }
const connection = {
  rpc: {
    handle(channel, fn) {
      services.channel = channel
      services.fn = fn
      return () => {}
    },
  },
}
const { ctx } = createCtx(connection, services)
apply(ctx)

if (typeof services.fn !== 'function') {
  console.error('FAIL: apply() did not register an RPC handler')
  process.exit(1)
}

const call = (endpoint, payload) => services.fn(endpoint, payload, new AbortController().signal)

const query = process.argv[2] ?? '会话'
let failures = 0
const check = (ok, label, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  ${detail}`}`)
  if (!ok) failures += 1
}

const ping = await call('ping', {})
check(ping?.ok === true, 'ping answers ok')

const listed = await call('sessions', { filters: {} })
check(listed?.ok === true, 'sessions answers ok')
check((listed?.value?.items ?? []).length > 0, 'sessions lists real logs', `${listed?.value?.items?.length} sessions`)
check((listed?.value?.cwds ?? []).length > 0, 'sessions reports cwds', JSON.stringify(listed?.value?.cwds))

const global = await call('search', { target: 'global', query, limit: 200 })
check(global?.ok === true, 'global search answers ok', JSON.stringify(global?.error ?? ''))
const globalItems = global?.value?.items ?? []
check(globalItems.length > 0, 'global search finds real hits', `${globalItems.length} hits for ${JSON.stringify(query)}`)
check(
  globalItems.every((item) => typeof item.seq === 'number' && item.seq > 0),
  'every hit carries a seq',
)
const anchored = globalItems.filter((item) => typeof item.turn === 'number')
check(
  anchored.length === globalItems.length,
  'every hit carries a turn anchor for jump-to',
  `${anchored.length}/${globalItems.length}`,
)
const titled = globalItems.filter((item) => typeof item.sessionTitle === 'string' && item.sessionTitle !== '')
check(titled.length === globalItems.length, 'every hit carries a session title', `${titled.length}/${globalItems.length}`)
check(
  globalItems.every((item) => item.snippet.includes(query) || query.length === 0 || item.kind === 'tool'),
  'snippets contain the matched text',
)

if (globalItems.length > 0) {
  const firstSession = globalItems[0].sessionId
  const inSession = await call('search', { target: 'session', sessionId: firstSession, query, limit: 50 })
  check(inSession?.ok === true, 'in-session search answers ok')
  const inItems = inSession?.value?.items ?? []
  check(inItems.length > 0, 'in-session search finds hits', `${inItems.length} hits`)
  check(
    inItems.every((item, index) => index === 0 || inItems[index - 1].seq <= item.seq),
    'in-session hits are ordered by seq',
  )

  const around = await call('context', { sessionId: firstSession, seq: inItems[0].seq, before: 1, after: 1 })
  check(around?.ok === true, 'context answers ok')
  check(around?.value?.anchored === true, 'context anchors on the asked seq')
  check(Array.isArray(around?.value?.before) && around.value.before.length <= 1, 'context respects before')
}

const empty = await call('search', { target: 'global', query: '' })
check(empty?.ok === true && (empty.value.items ?? []).length === 0, 'an empty query returns an empty page')
check(empty?.value?.total === 0, 'an empty query reports total 0')

const badRegex = await call('search', { target: 'global', query: '(', match: 'regex' })
check(badRegex?.ok === false && badRegex.error?.code === 'bad-regex', 'a bad regex reports the compile error')

const timed = Date.now()
await call('search', { target: 'global', query: 'the', limit: 50 })
check(Date.now() - timed < 30000, 'a broad global scan finishes inside the client timeout', `${Date.now() - timed} ms`)

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
