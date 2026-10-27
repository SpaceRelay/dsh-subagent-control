/**
 * Semantic text extraction for session log events.
 *
 * The shipped `extractSessionEventText` (inside `@deepseek-ai/dsh-session-query`)
 * deliberately drops `reasoning` blocks and ignores structural events, so it
 * cannot express the plugin's "正文 / 工具 / 思考" scope toggle. This module
 * keeps the same event coverage but tags every chunk with a kind, letting the
 * caller decide what is searchable:
 *
 *   body     — user and assistant visible text
 *   tool     — tool call names + arguments, tool results, todo writes
 *   thinking — assistant reasoning blocks
 *   meta     — turn errors and similar status text
 *
 * Pure functions only: no Host API, unit-testable with `node --test`.
 */

/** @typedef {'body' | 'tool' | 'thinking' | 'meta'} ChunkKind */
export const CHUNK_KINDS = Object.freeze(['body', 'tool', 'thinking', 'meta'])

/** @typedef {{kind: ChunkKind, text: string}} TextChunk */
/** @typedef {{seq: number, turn: number | undefined, step: number | undefined, time: number, type: string, chunks: TextChunk[]}} EventText */

/**
 * Extract the searchable chunks of one event.
 *
 * @param {{seq?: number, type?: string, data?: any}} event
 * @returns {EventText | undefined} undefined when the event has no text at all
 */
export function extractEventChunks(event) {
  if (event === null || typeof event !== 'object') return undefined
  const type = typeof event.type === 'string' ? event.type : ''
  const data = event.data ?? {}
  const chunks = chunksFor(type, data)
  if (chunks.length === 0) return undefined
  return {
    seq: typeof event.seq === 'number' ? event.seq : -1,
    turn: typeof data.turn === 'number' ? data.turn : undefined,
    step: typeof data.step === 'number' ? data.step : undefined,
    time: typeof event.time === 'number' ? event.time : 0,
    type,
    chunks,
  }
}

/**
 * @param {string} type
 * @param {any} data
 * @returns {TextChunk[]}
 */
function chunksFor(type, data) {
  switch (type) {
    case 'user/message':
      return bodyChunks(data.content)

    case 'assistant/message':
      // `tool-call` blocks are skipped here on purpose: the very same call is
      // emitted as its own `tool/call` event, and indexing both would double
      // every tool hit in the result list.
      return assistantChunks(data.message?.content)

    case 'tool/call':
      return toolCallChunks(data)

    case 'tool/result':
      return toolResultChunks(data)

    case 'todo/write':
      return todoChunks(data)

    case 'turn/end':
      return turnEndChunks(data.reason)

    case 'system/message':
    case 'developer/message':
      // Prompt plumbing. Excluded: it is huge, repeated every step, and users
      // never search for it.
      return []

    default:
      return []
  }
}

/**
 * @param {any} content
 * @returns {TextChunk[]}
 */
function bodyChunks(content) {
  return collapse([{ kind: 'body', text: messageText(content) }])
}

/**
 * @param {any} content
 * @returns {TextChunk[]}
 */
function assistantChunks(content) {
  if (!Array.isArray(content)) return []
  const text = []
  const thinking = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string') text.push(block.text)
    else if (block.type === 'reasoning' && typeof block.text === 'string') thinking.push(block.text)
  }
  return collapse([
    { kind: 'body', text: text.join('\n') },
    { kind: 'thinking', text: thinking.join('\n') },
  ])
}

/**
 * @param {any} data
 * @returns {TextChunk[]}
 */
function toolCallChunks(data) {
  const name = typeof data.name === 'string' ? data.name : ''
  const args = typeof data.arguments === 'string' ? data.arguments : ''
  return collapse([{ kind: 'tool', text: `${name}\n${args}`.trim() }])
}

/**
 * @param {any} data
 * @returns {TextChunk[]}
 */
function toolResultChunks(data) {
  const body = messageText(data.message?.content)
  const error = data.error
  const parts = [body]
  if (error !== undefined && error !== null) {
    if (typeof error.name === 'string') parts.push(error.name)
    if (typeof error.code === 'string') parts.push(error.code)
    if (typeof error.message === 'string') parts.push(error.message)
  }
  return collapse([{ kind: 'tool', text: parts.filter(Boolean).join('\n') }])
}

/**
 * @param {any} data
 * @returns {TextChunk[]}
 */
function todoChunks(data) {
  const todos = Array.isArray(data.todos) ? data.todos : []
  const lines = []
  for (const todo of todos) {
    if (todo === null || typeof todo !== 'object') continue
    if (typeof todo.status === 'string' && typeof todo.content === 'string') {
      lines.push(`${todo.status} ${todo.content}`)
    } else if (typeof todo.content === 'string') {
      lines.push(todo.content)
    }
  }
  return collapse([{ kind: 'tool', text: lines.join('\n') }])
}

/**
 * @param {any} reason
 * @returns {TextChunk[]}
 */
function turnEndChunks(reason) {
  if (reason === null || typeof reason !== 'object') return []
  if (reason.kind === 'error') {
    const message = typeof reason.error?.message === 'string' ? reason.error.message : ''
    return collapse([{ kind: 'meta', text: `error ${message}`.trim() }])
  }
  return []
}

/**
 * Text of a message's content blocks (text only; images/files/calls ignored).
 *
 * @param {any} content
 * @returns {string}
 */
export function messageText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n')
}

/**
 * Drop empty chunks and trim.
 *
 * @param {TextChunk[]} chunks
 * @returns {TextChunk[]}
 */
function collapse(chunks) {
  const out = []
  for (const chunk of chunks) {
    const text = chunk.text.trim()
    if (text.length > 0) out.push({ kind: chunk.kind, text })
  }
  return out
}

/**
 * Turn the raw event array of one session into searchable documents.
 *
 * @param {Array<{seq?: number, type?: string, data?: any}>} events
 * @returns {EventText[]}
 */
export function buildDocuments(events) {
  const documents = []
  if (!Array.isArray(events)) return documents
  // Only `assistant/message` events carry `turn` in their payload; `user/message`
  // and `tool/*` do not. Track the running turn from `turn/start` so every
  // document is anchored to a turn and can be jumped to in the transcript.
  let currentTurn
  for (const event of events) {
    if (event !== null && typeof event === 'object' && event.type === 'turn/start') {
      const turn = event.data?.turn
      if (typeof turn === 'number') currentTurn = turn
      continue
    }
    const extracted = extractEventChunks(event)
    if (extracted === undefined) continue
    if (extracted.turn === undefined && currentTurn !== undefined) extracted.turn = currentTurn
    documents.push(extracted)
  }
  return documents
}

/**
 * Latest log-backed title of a session, for the cross-session result rows.
 *
 * Mirrors `foldSessionTitle` from `@deepseek-ai/dsh-session-title`: the last
 * `session/title` event wins. Titles are never indexable text themselves, so
 * they are folded out of the same event array the documents are built from.
 *
 * @param {Array<{type?: string, data?: any}>} events
 * @returns {string | undefined}
 */
export function foldTitle(events) {
  if (!Array.isArray(events)) return undefined
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event === null || typeof event !== 'object' || event.type !== 'session/title') continue
    const title = event.data?.title
    if (typeof title === 'string' && title.trim() !== '') return title.trim()
  }
  return undefined
}

/**
 * Human-readable label for a chunk kind, used by the results panel.
 *
 * @param {ChunkKind} kind
 * @returns {'body' | 'tool' | 'thinking' | 'meta'}
 */
export function chunkLabel(kind) {
  return CHUNK_KINDS.includes(kind) ? kind : 'body'
}
