import assert from 'node:assert/strict'
import test from 'node:test'

import { compileMatcher, findMatches, normalizeOptions, snippetAround, snippetHitEquals } from '../lib/match.js'

test('normalizeOptions falls back to substring + case-insensitive', () => {
  assert.deepEqual(normalizeOptions(), { mode: 'substring', caseSensitive: false })
  assert.deepEqual(normalizeOptions({ mode: 'nonsense' }), { mode: 'substring', caseSensitive: false })
  assert.deepEqual(normalizeOptions({ mode: 'regex', caseSensitive: true }), {
    mode: 'regex',
    caseSensitive: true,
  })
})

test('substring finds every occurrence, case-insensitively', () => {
  assert.deepEqual(findMatches('DSH DSH dsh', 'dsh'), [
    [0, 3],
    [4, 7],
    [8, 11],
  ])
})

test('substring respects caseSensitive', () => {
  assert.deepEqual(findMatches('DSH dsh', 'dsh', { caseSensitive: true }), [[4, 7]])
})

test('CJK substring works on a run that FTS5 unicode61 would tokenize whole', () => {
  const text = '我们来做会话上下文关键词查找'
  assert.deepEqual(findMatches(text, '会话'), [[4, 6]])
  assert.deepEqual(findMatches(text, '上下文'), [[6, 9]])
})

test('exact mode requires non-word boundaries', () => {
  const text = 'find session-find finder'
  assert.deepEqual(findMatches(text, 'find', { mode: 'exact' }), [
    [0, 4],
    [13, 17],
  ])
})

test('exact mode treats CJK neighbours as boundaries', () => {
  assert.deepEqual(findMatches('来做会话上下文', '会话', { mode: 'exact' }), [[2, 4]])
})

test('regex mode scans globally', () => {
  assert.deepEqual(findMatches('a1 b2 c3', '[a-z]\\d', { mode: 'regex' }), [
    [0, 2],
    [3, 5],
    [6, 8],
  ])
})

test('regex mode reports a compile error instead of throwing', () => {
  const matcher = compileMatcher('([', { mode: 'regex' })
  assert.equal(matcher.error, 'bad-regex')
  assert.deepEqual(matcher.find('anything'), [])
})

test('empty query is rejected, not silently matched', () => {
  const matcher = compileMatcher('')
  assert.equal(matcher.error, 'empty-query')
  assert.deepEqual(matcher.find('anything'), [])
})

test('zero-width regex cannot loop forever', () => {
  assert.deepEqual(findMatches('abc', '/?', { mode: 'regex' }), [])
})

test('snippetAround reports offsets that point at the hit', () => {
  const text = 'x'.repeat(80) + '会话上下文' + 'y'.repeat(80)
  const [start, end] = findMatches(text, '上下文')[0]
  const { snippet, matchStart, matchEnd } = snippetAround(text, start, end)
  assert.ok(snippetHitEquals(snippet, matchStart, matchEnd, '上下文'), snippet)
  assert.ok(snippet.startsWith('…'))
  assert.ok(snippet.endsWith('…'))
})

test('snippetAround does not split surrogate pairs', () => {
  const text = '😀'.repeat(40) + 'hit' + '😀'.repeat(40)
  const [start, end] = findMatches(text, 'hit')[0]
  const { snippet, matchStart, matchEnd } = snippetAround(text, start, end, { before: 2, after: 2 })
  assert.ok(snippetHitEquals(snippet, matchStart, matchEnd, 'hit'), snippet)
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u.test(snippet))
})

test('snippetAround collapses whitespace without losing the hit', () => {
  const text = 'a\n\n\tb   hit   c\n\nd'
  const [start, end] = findMatches(text, 'hit')[0]
  const { snippet, matchStart, matchEnd } = snippetAround(text, start, end)
  assert.ok(snippetHitEquals(snippet, matchStart, matchEnd, 'hit'), snippet)
  assert.ok(!snippet.includes('\n'))
})
