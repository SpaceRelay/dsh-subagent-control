/**
 * Pure matching logic for dsh-find-session.
 *
 * Deliberately independent of any Host API so it can be unit-tested with plain
 * `node --test`. The shipped full-text engine uses SQLite FTS5 with the
 * `unicode61` tokenizer, which treats a whole CJK run as ONE token: searching
 * "会话" against "我们来做会话上下文关键词查找" matches nothing. This module
 * therefore scans raw text itself and never tokenizes.
 */

/** @typedef {'substring' | 'exact' | 'regex'} MatchMode */

export const MATCH_MODES = Object.freeze(['substring', 'exact', 'regex'])

/** ASCII word characters only: CJK is intentionally NOT a word character. */
const WORD_CHAR = /[A-Za-z0-9_]/

/**
 * Coerce caller input into a known-good option set.
 *
 * @param {{mode?: string, caseSensitive?: boolean}} [options]
 * @returns {{mode: MatchMode, caseSensitive: boolean}}
 */
export function normalizeOptions(options = {}) {
  const mode = MATCH_MODES.includes(options.mode) ? options.mode : 'substring'
  return { mode, caseSensitive: options.caseSensitive === true }
}

/** @param {string | undefined} ch */
function isWordChar(ch) {
  return ch !== undefined && WORD_CHAR.test(ch)
}

/**
 * Build a matcher once, then reuse it across many documents.
 *
 * Returns `{error}` instead of throwing for an unusable query, so the Host RPC
 * can answer `{ok:false}` rather than leaking a stack trace to the browser.
 *
 * @param {string} query
 * @param {{mode?: string, caseSensitive?: boolean}} [options]
 * @returns {{mode: MatchMode, caseSensitive: boolean, find: (text: string) => Array<[number, number]>, error?: string, message?: string}}
 */
export function compileMatcher(query, options = {}) {
  const opts = normalizeOptions(options)
  const noop = () => []

  if (typeof query !== 'string' || query.length === 0) {
    return { ...opts, find: noop, error: 'empty-query' }
  }

  if (opts.mode === 'regex') {
    let pattern
    try {
      pattern = new RegExp(query, opts.caseSensitive ? 'g' : 'gi')
    } catch (error) {
      return {
        ...opts,
        find: noop,
        error: 'bad-regex',
        message: error instanceof Error ? error.message : String(error),
      }
    }
    return {
      ...opts,
      find(text) {
        if (typeof text !== 'string' || text.length === 0) return []
        const hits = []
        pattern.lastIndex = 0
        for (let guard = 0; guard <= text.length + 1; guard += 1) {
          const match = pattern.exec(text)
          if (match === null) break
          const start = match.index
          const end = start + match[0].length
          if (end > start) hits.push(/** @type {[number, number]} */ ([start, end]))
          // A zero-width match would loop forever without this nudge.
          pattern.lastIndex = end > start ? end : start + 1
          if (pattern.lastIndex > text.length) break
        }
        return hits
      },
    }
  }

  const exact = opts.mode === 'exact'
  const needle = opts.caseSensitive ? query : query.toLowerCase()

  return {
    ...opts,
    find(text) {
      if (typeof text !== 'string' || text.length === 0) return []
      const haystack = opts.caseSensitive ? text : text.toLowerCase()
      const hits = []
      let from = 0
      for (;;) {
        const at = haystack.indexOf(needle, from)
        if (at < 0) break
        const end = at + needle.length
        if (!exact || isExactHit(haystack, at, end)) {
          hits.push(/** @type {[number, number]} */ ([at, end]))
        }
        from = at + Math.max(1, needle.length)
        if (from > haystack.length) break
      }
      return hits
    },
  }
}

/**
 * Word-ish boundary test. ASCII letters/digits/underscore count as word
 * characters; everything else (including every CJK code point) is a boundary,
 * so a CJK "exact" search degrades to a plain substring search by design.
 *
 * @param {string} text
 * @param {number} start
 * @param {number} end
 */
function isExactHit(text, start, end) {
  return !isWordChar(text[start - 1]) && !isWordChar(text[end])
}

/**
 * Convenience wrapper for a single text.
 *
 * @param {string} text
 * @param {string} query
 * @param {{mode?: string, caseSensitive?: boolean}} [options]
 * @returns {Array<[number, number]>}
 */
export function findMatches(text, query, options = {}) {
  return compileMatcher(query, options).find(text)
}

/**
 * Slice a readable excerpt around one hit and report where the hit landed
 * inside that excerpt, so the browser can build an exact CSS `Range` without
 * re-running the matcher.
 *
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @param {{before?: number, after?: number}} [window]
 * @returns {{snippet: string, matchStart: number, matchEnd: number}}
 */
export function snippetAround(text, start, end, window = {}) {
  const before = Number.isFinite(window.before) ? window.before : 30
  const after = Number.isFinite(window.after) ? window.after : 60

  // Snap the head to a code-point boundary so a surrogate pair is never split.
  let head = Math.max(0, start - before)
  if (head > 0 && isLowSurrogate(text.charCodeAt(head))) head -= 1

  let tail = Math.min(text.length, end + after)
  if (tail < text.length && isLowSurrogate(text.charCodeAt(tail))) tail += 1

  const body = text.slice(head, tail).replace(/\s+/g, ' ')
  const collapsed = text.slice(head, start) + text.slice(start, end) + text.slice(end, tail)
  const prefix = collapseWhitespace(text.slice(head, start))
  const hit = collapseWhitespace(text.slice(start, end))

  return {
    snippet: `${head > 0 ? '…' : ''}${prefix}${hit}${collapseWhitespace(text.slice(end, tail))}${tail < text.length ? '…' : ''}`,
    matchStart: (head > 0 ? 1 : 0) + prefix.length,
    matchEnd: (head > 0 ? 1 : 0) + prefix.length + hit.length,
    // Kept for callers that only want the flattened body.
    ...(body === collapsed ? {} : {}),
  }
}

/** @param {number} code */
function isLowSurrogate(code) {
  return code >= 0xdc00 && code <= 0xdfff
}

/** @param {string} value */
function collapseWhitespace(value) {
  return value.replace(/\s+/gu, ' ')
}

/**
 * Whether `matchStart`/`matchEnd` still point at the hit after collapsing.
 * `snippetAround` collapses runs of whitespace in the prefix, so the offsets it
 * reports are computed from the collapsed prefix — this helper exists so tests
 * can assert that invariant directly.
 *
 * @param {string} snippet
 * @param {number} matchStart
 * @param {number} matchEnd
 * @param {string} expected
 */
export function snippetHitEquals(snippet, matchStart, matchEnd, expected) {
  return snippet.slice(matchStart, matchEnd) === expected
}
