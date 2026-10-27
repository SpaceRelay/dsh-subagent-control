import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDocuments, chunkLabel, extractEventChunks, foldTitle, messageText } from '../lib/extract.js'

const userMessage = {
  seq: 9,
  type: 'user/message',
  data: { content: [{ type: 'text', text: '搓个会话上下文关键词查找' }] },
}

const assistantMessage = {
  seq: 18,
  type: 'assistant/message',
  data: {
    turn: 1,
    step: 1,
    message: {
      role: 'assistant',
      content: [
        { type: 'reasoning', text: '先想想匹配算法' },
        { type: 'text', text: '好的，我来做' },
        { type: 'tool-call', id: 'c1', name: 'ops_bash', arguments: '{"command":"ls"}' },
      ],
    },
  },
}

test('messageText joins text blocks and ignores the rest', () => {
  assert.equal(messageText([{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }]), 'a\nb')
  assert.equal(messageText('plain'), 'plain')
  assert.equal(messageText(undefined), '')
})

test('user/message yields one body chunk', () => {
  const doc = extractEventChunks(userMessage)
  assert.deepEqual(doc.chunks, [{ kind: 'body', text: '搓个会话上下文关键词查找' }])
  assert.equal(doc.seq, 9)
})

test('assistant/message splits body and thinking, and skips tool-call blocks', () => {
  const doc = extractEventChunks(assistantMessage)
  assert.deepEqual(doc.chunks, [
    { kind: 'body', text: '好的，我来做' },
    { kind: 'thinking', text: '先想想匹配算法' },
  ])
  assert.equal(doc.turn, 1)
  // The duplicate-free guarantee: ops_bash appears only via the tool/call event.
  const joined = doc.chunks.map((chunk) => chunk.text).join(' ')
  assert.ok(!joined.includes('ops_bash'))
})

test('tool/call indexes name and arguments', () => {
  const doc = extractEventChunks({
    seq: 19,
    type: 'tool/call',
    data: { turn: 1, step: 1, callId: 'c1', name: 'ops_bash', arguments: '{"command":"sleep 240"}' },
  })
  assert.equal(doc.chunks.length, 1)
  assert.equal(doc.chunks[0].kind, 'tool')
  assert.ok(doc.chunks[0].text.includes('ops_bash'))
  assert.ok(doc.chunks[0].text.includes('sleep 240'))
})

test('tool/result indexes output and error metadata', () => {
  const doc = extractEventChunks({
    seq: 22,
    type: 'tool/result',
    data: { message: { content: [{ type: 'text', text: '(no output)' }] }, error: { name: 'EACCES', code: 'EACCES' } },
  })
  assert.equal(doc.chunks[0].kind, 'tool')
  assert.ok(doc.chunks[0].text.includes('(no output)'))
  assert.ok(doc.chunks[0].text.includes('EACCES'))
})

test('todo/write and turn/end errors are kept, annotated by kind', () => {
  const todo = extractEventChunks({
    seq: 30,
    type: 'todo/write',
    data: { todos: [{ status: 'completed', content: '写 match.js' }] },
  })
  assert.deepEqual(todo.chunks, [{ kind: 'tool', text: 'completed 写 match.js' }])

  const failed = extractEventChunks({
    seq: 34,
    type: 'turn/end',
    data: { turn: 1, reason: { kind: 'error', error: { message: 'boom' } } },
  })
  assert.deepEqual(failed.chunks, [{ kind: 'meta', text: 'error boom' }])
})

test('structural and prompt events contribute nothing', () => {
  for (const type of [
    'turn/start',
    'step/start',
    'step/end',
    'assistant/attempt',
    'request/header',
    'request/context',
    'system/message',
    'developer/message',
    'session/title',
    'approval/policy',
  ]) {
    assert.equal(extractEventChunks({ seq: 1, type, data: {} }), undefined, type)
  }
})

test('assistant/message with only reasoning still yields a thinking chunk', () => {
  const doc = extractEventChunks({
    seq: 2,
    type: 'assistant/message',
    data: { message: { content: [{ type: 'reasoning', text: 'only thinking' }] } },
  })
  assert.deepEqual(doc.chunks, [{ kind: 'thinking', text: 'only thinking' }])
})

test('buildDocuments skips textless events and keeps order', () => {
  const docs = buildDocuments([
    { seq: 1, type: 'turn/start', data: { turn: 1 } },
    userMessage,
    { seq: 10, type: 'step/start', data: { turn: 1, step: 1 } },
    assistantMessage,
  ])
  assert.deepEqual(
    docs.map((doc) => doc.seq),
    [9, 18],
  )
})

test('buildDocuments tolerates a non-array', () => {
  assert.deepEqual(buildDocuments(undefined), [])
})

test('buildDocuments anchors turn-less events to the running turn', () => {
  // Real logs only carry `turn` on assistant/message, tool/call and tool/result.
  // `user/message` has none, so without tracking `turn/start` the very first hit
  // of a search would have no turn anchor and could not be jumped to.
  const docs = buildDocuments([
    { seq: 1, type: 'turn/start', data: { turn: 1 } },
    { seq: 2, type: 'user/message', data: { content: [{ type: 'text', text: 'first' }] } },
    {
      seq: 3,
      type: 'assistant/message',
      data: { turn: 1, message: { content: [{ type: 'text', text: 'answer one' }] } },
    },
    { seq: 4, type: 'turn/start', data: { turn: 2 } },
    { seq: 5, type: 'user/message', data: { content: [{ type: 'text', text: 'second' }] } },
  ])
  assert.deepEqual(
    docs.map((doc) => [doc.seq, doc.turn]),
    [
      [2, 1],
      [3, 1],
      [5, 2],
    ],
  )
})

test('buildDocuments leaves the turn undefined before any turn/start', () => {
  const docs = buildDocuments([{ seq: 2, type: 'user/message', data: { content: [{ type: 'text', text: 'seed' }] } }])
  assert.equal(docs[0].turn, undefined)
})

test('chunkLabel normalizes unknown kinds', () => {
  assert.equal(chunkLabel('thinking'), 'thinking')
  assert.equal(chunkLabel('nonsense'), 'body')
})

test('foldTitle takes the last session/title event', () => {
  const events = [
    { seq: 1, type: 'user/message', data: { content: [{ type: 'text', text: 'hi' }] } },
    { seq: 2, type: 'session/title', data: { title: 'first' } },
    { seq: 3, type: 'session/title', data: { title: '  second  ' } },
  ]
  assert.equal(foldTitle(events), 'second')
})

test('foldTitle returns undefined without a usable title', () => {
  assert.equal(foldTitle(undefined), undefined)
  assert.equal(foldTitle([]), undefined)
  assert.equal(foldTitle([{ type: 'session/title', data: { title: '   ' } }]), undefined)
  assert.equal(foldTitle([{ type: 'session/title', data: {} }]), undefined)
})
