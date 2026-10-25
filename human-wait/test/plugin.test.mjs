import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { apply, normalizeConfig } from '../index.js'

/** @param {number} ms */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * A questions service shaped like `dsh-user-questions`: the method lives on the
 * prototype, which is what the traceable service proxy reads from.
 */
class FakeQuestions {
  /**
   * @param {number} waitMs how long the "user" takes to answer
   */
  constructor(waitMs) {
    this.waitMs = waitMs
    this.awaited = 0
  }

  async ask(request) {
    this.awaited += 1
    await delay(this.waitMs)
    return { request, answers: [{ id: 'q', selected: ['ok'] }] }
  }

  async askTimed(request) {
    return this.ask(request)
  }
}

/** An approval service that also blocks on a human. */
class FakeApproval {
  constructor(waitMs) {
    this.waitMs = waitMs
  }

  async request(request) {
    await delay(this.waitMs)
    return { request, decision: 'allow' }
  }
}

/**
 * A runtime shaped like `dsh-ptc-runtime-node`: a numeric `timeoutMs` means it
 * owns a wall-clock timer, `null` means no timer and the caller's signal rules.
 */
class FakeRuntime {
  constructor(budgetMs) {
    this.config = { timeoutMs: budgetMs, maxTimeoutMs: 600000 }
    this.received = []
  }

  resolve(request) {
    return { ...request, timeoutMs: request.timeoutMs === undefined ? this.config.timeoutMs : request.timeoutMs }
  }

  run(spec) {
    this.received.push(spec)
    return new Promise((resolve, reject) => {
      let settled = false
      let timer
      const settle = (fn) => {
        if (settled) return
        settled = true
        if (timer !== undefined) clearTimeout(timer)
        fn()
      }
      if (spec.timeoutMs !== null) {
        timer = setTimeout(() => settle(() => reject(new Error(`execution deadline reached (${spec.timeoutMs}ms)`))), spec.timeoutMs)
      }
      spec.signal?.addEventListener('abort', () => {
        settle(() => reject(new Error(String(spec.signal.reason))))
      }, { once: true })
      Promise.resolve()
        .then(() => spec.program())
        .then(
          (value) => settle(() => resolve({ value })),
          (error) => settle(() => reject(error)),
        )
    })
  }
}

/**
 * Minimal stand-in for the Cordis context the plugin talks to.
 * @param {object} services
 */
function createContext(services) {
  const disposers = []
  const ctx = {
    ...services,
    logger: () => ({ info() {}, warn() {}, debug() {} }),
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
    inject(deps, callback) {
      for (const dep of deps) {
        if (ctx[dep] === undefined) return
      }
      callback(ctx)
    },
  }
  return {
    ctx,
    dispose() {
      for (const dispose of disposers.reverse()) dispose()
    },
  }
}

/** Installed harnesses, disposed after every test so prototype wrappers unwind. */
const live = []

/**
 * @param {{ askMs?: number, approvalMs?: number, budgetMs?: number, config?: object }} options
 */
function createHarness(options = {}) {
  const askMs = options.askMs ?? 300
  const budgetMs = options.budgetMs ?? 120
  const questions = new FakeQuestions(askMs)
  const runtime = new FakeRuntime(budgetMs)
  const approval = new FakeApproval(options.approvalMs ?? askMs)
  const context = createContext({ ptcRuntime: runtime, userQuestions: questions, approval })
  apply(context.ctx, options.config ?? {})
  live.push(context)
  return { runtime, questions, approval, dispose: () => context.dispose() }
}

/** Run a program through the runtime exactly like `dsh-tools` does. */
function runProgram(runtime, program) {
  return runtime.run(runtime.resolve({ program, cwd: '/tmp', signal: new AbortController().signal }))
}

afterEach(() => {
  while (live.length > 0) live.pop().dispose()
})

describe('normalizeConfig', () => {
  it('uses the documented defaults', () => {
    assert.deepEqual(normalizeConfig(undefined), {
      enabled: true,
      humanWaitCapMs: 24 * 60 * 60 * 1000,
    })
  })

  it('keeps -1 as an uncapped wait and clamps oversized values', () => {
    assert.equal(normalizeConfig({ humanWaitCapMs: -1 }).humanWaitCapMs, -1)
    assert.equal(normalizeConfig({ humanWaitCapMs: 1e12 }).humanWaitCapMs, 2_147_483_647)
    assert.equal(normalizeConfig({ humanWaitCapMs: -5 }).humanWaitCapMs, 24 * 60 * 60 * 1000)
  })

  it('reads volatile refs (settings-backed values)', () => {
    const settings = normalizeConfig({
      enabled: { get: () => false },
      humanWaitCapMs: { get: () => 900_000 },
    })
    assert.deepEqual(settings, { enabled: false, humanWaitCapMs: 900_000 })
  })
})

describe('patchRun', () => {
  let originalRun
  let originalAsk

  beforeEach(() => {
    originalRun = FakeRuntime.prototype.run
    originalAsk = FakeQuestions.prototype.ask
  })

  it('leaves the shipped deadline alone when the plugin is disabled', async () => {
    const harness = createHarness({ config: { enabled: false }, askMs: 400 })
    const program = async () => {
      await harness.questions.ask({ questions: [] })
      return 'done'
    }
    await assert.rejects(runProgram(harness.runtime, program), /execution deadline reached \(120ms\)/)
    assert.equal(harness.runtime.received[0].timeoutMs, 120)
    assert.equal(FakeRuntime.prototype.run, originalRun)
  })

  it('pauses the deadline while a question is being answered', async () => {
    const harness = createHarness({ askMs: 400, budgetMs: 120 })
    const program = async () => {
      const answer = await harness.questions.ask({ questions: [] })
      return answer.answers.length
    }
    const result = await runProgram(harness.runtime, program)
    assert.equal(result.value, 1)
    // The runtime no longer owns a numeric timer; the plugin does.
    assert.equal(harness.runtime.received[0].timeoutMs, null)
    assert.notEqual(FakeRuntime.prototype.run, originalRun)
  })

  it('still cuts off a program that does not wait for a human', async () => {
    const harness = createHarness({ budgetMs: 120 })
    const started = Date.now()
    await assert.rejects(
      runProgram(harness.runtime, async () => {
        await delay(600)
        return 'late'
      }),
      /execution deadline reached \(120ms\)/,
    )
    assert.ok(Date.now() - started < 600, 'the shipped budget still applies to real execution')
  })

  it('charges only executing time, not the wait, after the answer arrives', async () => {
    const harness = createHarness({ askMs: 300, budgetMs: 120 })
    const started = Date.now()
    await assert.rejects(
      runProgram(harness.runtime, async () => {
        await harness.questions.ask({ questions: [] })
        await delay(400)
        return 'late'
      }),
      /execution deadline reached \(120ms\)/,
    )
    const elapsed = Date.now() - started
    assert.ok(elapsed >= 380, `expected the wait to be excluded, got ${elapsed}ms`)
  })

  it('applies humanWaitCapMs to the wait itself', async () => {
    const harness = createHarness({ askMs: 500, budgetMs: 120, config: { humanWaitCapMs: 100 } })
    await assert.rejects(
      runProgram(harness.runtime, async () => {
        await harness.questions.ask({ questions: [] })
        return 'done'
      }),
      /human interaction wait exceeded \(100ms\)/,
    )
  })

  it('counts an approval wait as a human wait', async () => {
    const harness = createHarness({ askMs: 400, budgetMs: 120 })
    const result = await runProgram(harness.runtime, async () => {
      await harness.approval.request({ tool: 'bash' })
      return 'done'
    })
    assert.equal(result.value, 'done')
  })

  it('fails open when the runtime cannot be wrapped', async () => {
    const runtime = new FakeRuntime(120)
    runtime.run = 42
    const questions = new FakeQuestions(400)
    const context = createContext({ ptcRuntime: runtime, userQuestions: questions })
    apply(context.ctx, {})
    context.dispose()
    await assert.rejects(
      async () => runProgram(runtime, async () => 'never'),
      /runtime\.run is not a function/,
    )
    assert.equal(FakeQuestions.prototype.ask, originalAsk)
  })

  it('restores the original methods on dispose', async () => {
    const harness = createHarness({})
    assert.notEqual(FakeRuntime.prototype.run, originalRun)
    assert.notEqual(FakeQuestions.prototype.ask, originalAsk)
    harness.dispose()
    assert.equal(FakeRuntime.prototype.run, originalRun)
    assert.equal(FakeQuestions.prototype.ask, originalAsk)
  })
})
