/**
 * dsh-find-session — Host half.
 *
 * Registers one RPC channel (`/dsh-find-session`) that the browser half calls to
 * scan session logs on demand. The scan is deliberately NOT SQLite FTS: the
 * shipped engine tokenizes with `unicode61`, which turns a whole CJK run into a
 * single token, so 「会话」 never matches 「我们来做会话上下文关键词查找」.
 *
 * Everything here is read-only. Nothing is written to the session log, the
 * profile, or the settings document.
 */

import { appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildDocuments, foldTitle } from './extract.js'
import { compileMatcher, snippetAround } from './match.js'

const name = 'dsh-find-session'
const inject = []

/** Single RPC channel shared with `lib/client.js`. */
const CHANNEL = '/dsh-find-session'

/** Hard ceiling on documents scanned by one global query before paging out. */
const GLOBAL_DOCUMENT_BUDGET = 30000
/** Sessions scanned concurrently. */
const GLOBAL_CONCURRENCY = 4
/** Default page size when the caller does not ask for one. */
const DEFAULT_LIMIT = 500
/** A live session changes constantly; re-read it often enough to feel fresh. */
const LIVE_CACHE_MS = 1000
/** A stored session is immutable once its writer is gone. */
const STORED_CACHE_MS = 60000

/** @typedef {{seq: number, turn: number | undefined, time: number, kind: string, text: string}} Doc */

/**
 * Parse a timestamp that may be a number, an ISO string, or a Date.
 *
 * @param {unknown} value
 * @returns {number | undefined}
 */
function toMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

/**
 * Ids of sessions that are open in memory right now. They get the shorter cache
 * TTL because their log is still growing.
 *
 * @param {any} sessions
 * @returns {Set<string>}
 */
function liveSessionIds(sessions) {
  const ids = new Set()
  try {
    const list = typeof sessions?.list === 'function' ? sessions.list() : []
    for (const session of Array.isArray(list) ? list : []) {
      const id = session?.id
      if (typeof id === 'string' && id !== '') ids.add(id)
    }
  } catch {
    // A store without a working `list` is not an error: nothing is live.
  }
  return ids
}

/**
 * Every session the caller may scan, in the shape the filters expect.
 *
 * The durable store is the source of truth (it also carries sessions whose
 * writer is gone), and the in-memory store fills in anything created but not
 * yet persisted.
 *
 * @param {any} sessionPersistence
 * @param {any} sessions
 * @returns {Promise<Array<{header: any, live: boolean}>>}
 */
async function listSessions(sessionPersistence, sessions) {
  const live = liveSessionIds(sessions)
  const out = []
  const seen = new Set()

  if (typeof sessionPersistence?.list === 'function') {
    const snapshots = await sessionPersistence.list()
    for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
      const header = snapshot?.header
      const id = header?.id
      if (typeof id !== 'string' || id === '' || seen.has(id)) continue
      seen.add(id)
      out.push({ header, live: live.has(id) })
    }
  }

  try {
    const running = typeof sessions?.list === 'function' ? sessions.list() : []
    for (const session of Array.isArray(running) ? running : []) {
      const header = session?.header
      const id = header?.id
      if (typeof id !== 'string' || id === '' || seen.has(id)) continue
      seen.add(id)
      out.push({ header, live: true })
    }
  } catch {
    // See `liveSessionIds`.
  }

  return out
}

/**
 * Read one session's full event log through a short-lived read handle.
 *
 * `eventsSnapshot`/`eventAt` on a live `Session` are deprecated in favour of
 * this path, and the persistence handle works for cold sessions too — which is
 * what a cross-session scan needs.
 *
 * @param {any} sessionPersistence
 * @param {string} sessionId
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<{header: any, events: any[]}>}
 */
async function readSession(sessionPersistence, sessions, sessionId, signal) {
  if (typeof sessionPersistence?.open === 'function') {
    const handle = await sessionPersistence.open(sessionId, 'read', { signal })
    try {
      const result = await handle.read(0, undefined, { signal })
      const events = Array.isArray(result?.events) ? result.events : []
      return { header: handle.header, events }
    } finally {
      try {
        await handle.close()
      } catch {
        // Closing a read handle cannot fail in a way the caller can act on.
      }
    }
  }

  // No durable store in this profile: only sessions that are open right now can
  // be read, straight off the live snapshot.
  const session = typeof sessions?.get === 'function' ? sessions.get(sessionId) : undefined
  if (session === undefined || session === null) throw new Error(`session "${sessionId}" is not open`)
  const events = Array.isArray(session.eventsSnapshot) ? session.eventsSnapshot : []
  return { header: session.header, events }
}

/**
 * Flatten one session's extracted event documents, applying the content scope.
 *
 * @param {Array<{seq: number, turn?: number, time: number, chunks: Array<{kind: string, text: string}>}>} documents
 * @param {{body?: boolean, tools?: boolean, thinking?: boolean}} scope
 * @returns {Doc[]}
 */
function flattenDocuments(documents, scope) {
  const out = []
  for (const document of documents) {
    for (const chunk of document.chunks) {
      if (!chunkAllowed(chunk.kind, scope)) continue
      out.push({
        seq: document.seq,
        turn: document.turn,
        time: document.time,
        kind: chunk.kind,
        text: chunk.text,
      })
    }
  }
  return out
}

/**
 * Whether one chunk kind is inside the caller's content scope.
 *
 * `meta` rides along with the tool toggle: it is status text, not prose.
 *
 * @param {string} kind
 * @param {{body?: boolean, tools?: boolean, thinking?: boolean}} scope
 * @returns {boolean}
 */
function chunkAllowed(kind, scope) {
  if (kind === 'body') return scope.body !== false
  if (kind === 'tool' || kind === 'meta') return scope.tools === true
  if (kind === 'thinking') return scope.thinking === true
  return false
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function clampLimit(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(2000, Math.floor(number)))
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function clampOffset(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.floor(number)
}

/**
 * Session-level filters shared by the `search` and `sessions` endpoints.
 *
 * @param {any} header
 * @param {{cwds?: string[], from?: number, to?: number, presets?: string[], includeSubagents?: boolean}} filters
 * @returns {boolean}
 */
function sessionPasses(header, filters) {
  if (header === undefined || header === null) return false

  if (Array.isArray(filters.cwds) && filters.cwds.length > 0) {
    if (typeof header.cwd !== 'string' || !filters.cwds.includes(header.cwd)) return false
  }

  const from = toMillis(filters.from)
  const to = toMillis(filters.to)
  if (from !== undefined || to !== undefined) {
    const createdAt = toMillis(header.createdAt)
    if (createdAt === undefined) return false
    if (from !== undefined && createdAt < from) return false
    if (to !== undefined && createdAt > to) return false
  }

  if (Array.isArray(filters.presets) && filters.presets.length > 0) {
    if (typeof header.agentPreset !== 'string' || !filters.presets.includes(header.agentPreset)) return false
  }

  if (filters.includeSubagents === false) {
    const isSubagent = header.parentSession !== undefined || (header.delegationDepth ?? 0) > 0
    if (isSubagent) return false
  }

  return true
}

/**
 * Coerce an RPC payload into the shape the scanner expects.
 *
 * @param {any} payload
 * @returns {{query: string, mode: string, caseSensitive: boolean, target: 'session'|'global', sessionId: string|undefined, scope: {body: boolean, tools: boolean, thinking: boolean}, filters: {cwds: string[]|undefined, from: number|undefined, to: number|undefined, presets: string[]|undefined, includeSubagents: boolean}, limit: number, offset: number}}
 */
function normalizeRequest(payload) {
  const request = payload !== null && typeof payload === 'object' ? payload : {}
  const scope = request.scope !== null && typeof request.scope === 'object' ? request.scope : {}
  const filters = request.filters !== null && typeof request.filters === 'object' ? request.filters : {}
  return {
    query: typeof request.query === 'string' ? request.query : '',
    mode: typeof request.match === 'string' ? request.match : 'substring',
    caseSensitive: request.caseSensitive === true,
    target: request.target === 'global' ? 'global' : 'session',
    sessionId: typeof request.sessionId === 'string' ? request.sessionId : undefined,
    scope: { body: scope.body !== false, tools: scope.tools === true, thinking: scope.thinking === true },
    filters: {
      cwds: Array.isArray(filters.cwds) ? filters.cwds.filter((value) => typeof value === 'string') : undefined,
      from: toMillis(filters.from),
      to: toMillis(filters.to),
      presets: Array.isArray(filters.presets) ? filters.presets.filter((value) => typeof value === 'string') : undefined,
      includeSubagents: filters.includeSubagents !== false,
    },
    limit: clampLimit(request.limit),
    offset: clampOffset(request.offset),
  }
}

/**
 * @param {string} code
 * @param {string} message
 */
function failure(code, message) {
  return { ok: false, error: { code, message } }
}

/**
 * @param {Doc} doc
 */
function toContextRow(doc) {
  return {
    seq: doc.seq,
    turn: doc.turn,
    kind: doc.kind,
    time: doc.time,
    text: doc.text.length > 1200 ? `${doc.text.slice(0, 1200)}…` : doc.text,
  }
}

/**
 * Build the plugin.
 *
 * @param {any} ctx
 */
function apply(ctx) {
  /** @type {Map<string, {docs: Doc[], title: string | undefined, builtAt: number, live: boolean, events: number}>} */
  const cache = new Map()
  /** Sessions above this count are skipped by a global scan to protect UI latency. */
  const EVENT_SOFT_CAP = 40000

  /**
   * Cached documents for a session, rebuilt when the cache entry is stale.
   *
   * @param {{persistence: any, sessions: any}} store
   * @param {string} sessionId
   * @param {boolean} live whether this session is currently open
   */
  async function documentsFor(store, sessionId, live) {
    const hit = cache.get(sessionId)
    const maxAge = live ? LIVE_CACHE_MS : STORED_CACHE_MS
    if (hit !== undefined && Date.now() - hit.builtAt < maxAge) return hit

    const snapshot = await readSession(store.persistence, store.sessions, sessionId, undefined)
    const events = Array.isArray(snapshot?.events) ? snapshot.events : []
    const docs = flattenDocuments(buildDocuments(events), { body: true, tools: true, thinking: true })
    const entry = { docs, title: foldTitle(events), builtAt: Date.now(), live, events: events.length }
    cache.set(sessionId, entry)
    // Keep the cache bounded: global scans touch hundreds of sessions.
    if (cache.size > 400) {
      const oldest = [...cache.entries()].sort((left, right) => left[1].builtAt - right[1].builtAt).slice(0, 100)
      for (const [key] of oldest) cache.delete(key)
    }
    return entry
  }

  /**
   * Scan one session's documents and emit one result per match.
   *
   * @param {{docs: Doc[]}} entry
   * @param {ReturnType<typeof compileMatcher>} matcher
   * @param {{sessionId: string, title: string | undefined}} meta
   * @param {{body?: boolean, tools?: boolean, thinking?: boolean}} scope
   * @param {(item: any) => void} emit
   */
  function scanSession(entry, matcher, meta, scope, emit) {
    for (const doc of entry.docs) {
      if (!chunkAllowed(doc.kind, scope)) continue
      for (const [start, end] of matcher.find(doc.text)) {
        const snippet = snippetAround(doc.text, start, end)
        emit({
          sessionId: meta.sessionId,
          sessionTitle: meta.title,
          seq: doc.seq,
          turn: doc.turn,
          kind: doc.kind,
          time: doc.time,
          snippet: snippet.snippet,
          matchStart: snippet.matchStart,
          matchEnd: snippet.matchEnd,
          text: doc.text.length > 400 ? `${doc.text.slice(0, 400)}…` : doc.text,
        })
      }
    }
  }

  /**
   * @param {{persistence: any, sessions: any}} store
   * @param {ReturnType<typeof normalizeRequest>} request
   * @param {AbortSignal | undefined} signal
   */
  async function search(store, request, signal) {
    // An empty query is "nothing asked", not a mistake: answer an empty page so
    // a stale in-flight request cannot flash an error card.
    if (request.query.length === 0) {
      return { ok: true, value: { items: [], total: 0, hasMore: false, offset: 0 } }
    }
    const matcher = compileMatcher(request.query, { mode: request.mode, caseSensitive: request.caseSensitive })
    if (matcher.error !== undefined) {
      return failure(matcher.error, matcher.message ?? 'invalid query')
    }

    const records = await listSessions(store.persistence, store.sessions)
    const all = Array.isArray(records) ? records : []

    /** @type {any[]} */
    const collected = []
    let truncated = false

    if (request.target === 'session') {
      if (request.sessionId === undefined) {
        return failure('no-session', 'sessionId is required for an in-session search')
      }
      const record = all.find((entry) => entry?.header?.id === request.sessionId)
      let entry
      try {
        entry = await documentsFor(store, request.sessionId, true)
      } catch (error) {
        return failure('read-failed', error instanceof Error ? error.message : String(error))
      }
      scanSession(entry, matcher, { sessionId: request.sessionId, title: entry.title }, request.scope, (item) => {
        collected.push(item)
      })
      collected.sort((left, right) => left.seq - right.seq || left.matchStart - right.matchStart)
      void record
    } else {
      const liveIds = new Set(
        all.filter((record) => record?.live === true).map((record) => record?.header?.id).filter((id) => typeof id === 'string'),
      )
      const list = all.filter((record) => sessionPasses(record?.header, request.filters))
      let documents = 0
      let cursor = 0

      const worker = async () => {
        for (;;) {
          if (signal?.aborted === true) return
          const index = cursor
          cursor += 1
          if (index >= list.length) return
          if (documents >= GLOBAL_DOCUMENT_BUDGET) {
            truncated = true
            return
          }
          const sessionId = list[index]?.header?.id
          if (typeof sessionId !== 'string') continue
          let entry
          try {
            entry = await documentsFor(store, sessionId, liveIds.has(sessionId))
          } catch {
            continue
          }
          if (entry.events > EVENT_SOFT_CAP) continue
          documents += entry.docs.length
          scanSession(entry, matcher, { sessionId, title: entry.title }, request.scope, (item) => {
            collected.push(item)
          })
        }
      }

      const workers = []
      for (let index = 0; index < Math.min(GLOBAL_CONCURRENCY, list.length); index += 1) workers.push(worker())
      await Promise.all(workers)
      collected.sort((left, right) => right.time - left.time || left.sessionId.localeCompare(right.sessionId) || left.seq - right.seq)
    }

    const page = collected.slice(request.offset, request.offset + request.limit)
    const hasMore = truncated || request.offset + request.limit < collected.length
    return { ok: true, value: { items: page, total: collected.length, hasMore, offset: request.offset, truncated } }
  }

  /**
   * Neighbouring events around one hit, for the preview card.
   *
   * @param {{persistence: any, sessions: any}} store
   * @param {any} request
   */
  async function context(store, request) {
    const sessionId = typeof request?.sessionId === 'string' ? request.sessionId : ''
    if (sessionId.length === 0) return failure('no-session', 'sessionId is required')
    const before = Math.max(0, Math.min(20, Number(request.before ?? 2) || 0))
    const after = Math.max(0, Math.min(20, Number(request.after ?? 2) || 0))
    const scope = request.scope !== null && typeof request.scope === 'object' ? request.scope : { body: true }

    let entry
    try {
      entry = await documentsFor(store, sessionId, true)
    } catch (error) {
      return failure('read-failed', error instanceof Error ? error.message : String(error))
    }
    const filtered = entry.docs.filter((doc) => chunkAllowed(doc.kind, scope))
    if (filtered.length === 0) {
      return { ok: true, value: { before: [], target: null, after: [], anchored: false } }
    }

    const seq = Number(request.seq)
    let targetIndex = filtered.findIndex((doc) => doc.seq === seq)
    const anchored = targetIndex >= 0
    if (!anchored) {
      // Land on the closest document at or before the requested seq.
      targetIndex = 0
      for (let index = 0; index < filtered.length; index += 1) {
        if (filtered[index].seq <= seq) targetIndex = index
        else break
      }
    }

    const target = filtered[targetIndex]
    return {
      ok: true,
      value: {
        before: filtered.slice(Math.max(0, targetIndex - before), targetIndex).map(toContextRow),
        target: toContextRow(target),
        after: filtered.slice(targetIndex + 1, targetIndex + 1 + after).map(toContextRow),
        anchored,
      },
    }
  }

  /**
   * Session list plus the distinct filter values the dropdowns need.
   *
   * @param {{persistence: any, sessions: any}} store
   * @param {any} request
   * @param {AbortSignal | undefined} signal
   */
  async function sessions(store, request, signal) {
    const filters = request?.filters !== null && typeof request?.filters === 'object' ? request.filters : {}
    const records = await listSessions(store.persistence, store.sessions)
    const list = (Array.isArray(records) ? records : []).filter((record) =>
      sessionPasses(record?.header, {
        cwds: Array.isArray(filters.cwds) ? filters.cwds : undefined,
        from: toMillis(filters.from),
        to: toMillis(filters.to),
        presets: Array.isArray(filters.presets) ? filters.presets : undefined,
        includeSubagents: filters.includeSubagents !== false,
      }),
    )

    const items = list.map((record) => ({
      sessionId: record?.header?.id,
      cwd: record?.header?.cwd,
      createdAt: toMillis(record?.header?.createdAt),
      agentPreset: record?.header?.agentPreset,
      isSubagent: record?.header?.parentSession !== undefined || (record?.header?.delegationDepth ?? 0) > 0,
      live: record?.live === true,
    }))

    /** @type {string[]} */
    const cwds = []
    /** @type {string[]} */
    const presets = []
    for (const item of items) {
      if (typeof item.cwd === 'string' && !cwds.includes(item.cwd)) cwds.push(item.cwd)
      if (typeof item.agentPreset === 'string' && !presets.includes(item.agentPreset)) presets.push(item.agentPreset)
    }
    cwds.sort()
    presets.sort()

    return { ok: true, value: { items, cwds, presets, total: items.length } }
  }

/**
 * Append one browser-half diagnostics line to a temp file.
 *
 * The shortcut layer fails silently by design — a conflicting or unavailable
 * binding changes nothing the user can see — so "never registered" and
 * "registered but never dispatched" look identical from the outside. This
 * endpoint is the only read-only way to tell them apart.
 *
 * @param {any} payload whatever the client reported, stored verbatim.
 */
function writeDiagnostics(payload) {
  try {
    const file = join(tmpdir(), 'dsh-find-session-diag.log')
    appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...payload })}\n`)
    return { ok: true, value: { file } }
  } catch (error) {
    return { ok: true, value: { file: null, error: error instanceof Error ? error.message : String(error) } }
  }
}

  // Gate the route on `connection` alone, exactly like the shipped plugins do:
  // a deferred service that never mounts would otherwise silently disable the
  // whole feature. The data services are resolved per request instead, so a
  // late-mounted store still works and a missing one reports a clear error.
  ctx.inject(['connection'], (scope) => {
    try {
    // Mirror the shipped plugins: `scope.root.connection` is the proven accessor
    // in this profile, with `scope.get` as the fallback for other host shapes.
    const connection = scope.root?.connection ?? scope.get('connection')
    if (connection === undefined || connection === null) {
      ctx.logger?.warn?.('[dsh-find-session] connection service unavailable; routes not registered')
      return
    }
    if (typeof connection.rpc?.handle !== 'function') {
      ctx.logger?.warn?.('[dsh-find-session] connection.rpc.handle missing; routes not registered')
      return
    }
    const store = {
      get persistence() {
        return ctx.get('sessionPersistence')
      },
      get sessions() {
        return ctx.get('sessions')
      },
    }

    // The connection registry calls a channel handler as
    // `(endpoint, payload, signal, peer)`; the signal aborts with the request.
    const dispose = connection.rpc.handle(CHANNEL, async (endpoint, payload, signal) => {
      const request = payload ?? {}
      try {
        switch (endpoint) {
          case 'search':
            return await search(store, normalizeRequest(request), signal)
          case 'context':
            return await context(store, request)
          case 'sessions':
            return await sessions(store, request, signal)
          case 'ping':
            return { ok: true, value: { ready: true } }
          case 'diag':
            return writeDiagnostics(request)
          default:
            return failure('unknown-endpoint', `unknown endpoint: ${String(endpoint)}`)
        }
      } catch (error) {
        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
          return failure('aborted', 'search cancelled')
        }
        return failure('search-failed', error instanceof Error ? error.message : String(error))
      }
    })

    scope.effect(() => dispose, 'dsh-find-session RPC channel')
    } catch (error) {
      ctx.logger?.warn?.(`[dsh-find-session] RPC channel registration failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  ctx.effect(
    () => () => {
      cache.clear()
    },
    'dsh-find-session cache',
  )
}

export { name, inject, apply }
export default { name, inject, apply }
