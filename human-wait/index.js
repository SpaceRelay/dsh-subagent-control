/**
 * dsh-human-wait — let PTC runs wait for you.
 *
 * PTC mode hands the model a single tool, `run_code`, and every nested call
 * (`ask_user_question`, the plan review raised by `exit_plan_mode`, sandbox
 * approvals) executes inside that one program. `dsh-ptc-runtime-node` puts one
 * wall-clock deadline around the whole program — 120 s by default, and its own
 * description says it includes "nested tool and approval waits". So the moment
 * a question takes longer than the remaining budget, the run dies with
 * `Error: code run failed (timeout): execution deadline reached (120000ms)` and
 * the question card is reported as interrupted.
 *
 * This plugin keeps that deadline but pauses it while DSH is actually waiting
 * for a human: it wraps `ptcRuntime.run` and runs the same budget itself, and
 * wraps `userQuestions.ask` / `userQuestions.askTimed` / `approval.request` to
 * learn when a human-interaction wait is pending. Time spent waiting is not
 * charged to the run; time spent executing still is, so a runaway program is
 * still cut off exactly as before. Waiting itself is capped by
 * `humanWaitCapMs` (default 24 h, `-1` = no cap).
 *
 * Everything here is fail-open: if a service is missing, if the wrappers were
 * already installed by someone else, or if a future DSH release changes these
 * internals, the plugin logs once and leaves the shipped behaviour untouched.
 * Every wrapper is removed when the plugin unloads.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export const name = 'dsh-human-wait'

/** Marks a wrapper this plugin installed, so patching twice is a no-op. */
const PATCHED = Symbol.for('dsh-human-wait.patched')

const DEFAULT_HUMAN_WAIT_CAP_MS = 24 * 60 * 60 * 1000
const MAX_TIMER_MS = 2_147_483_647
const DEADLINE_MESSAGE = 'execution deadline reached'

/** Per-run wait accounting; a run has a slot only while it is on the stack. */
const runScope = new AsyncLocalStorage()

let Schema
try {
  const loaded = await import('@deepseek-ai/schemastery')
  Schema = loaded.default ?? loaded.Schema
} catch {
  // A link-installed bundle must not require the host's packages; the plugin
  // still works with its defaults when schemastery cannot be resolved.
  Schema = undefined
}

export const Config = Schema === undefined
  ? undefined
  : Schema.object({
    enabled: Schema.boolean().default(true)
      .description('Pause the PTC run deadline while a human-interaction wait is pending.'),
    humanWaitCapMs: Schema.number().default(DEFAULT_HUMAN_WAIT_CAP_MS)
      .description('Longest time a run may spend waiting for a human, in milliseconds. -1 removes the cap.'),
  })

/**
 * Resolve a possibly volatile config value (`Settings` may wrap it in a ref).
 * @param {object} source
 * @param {string} key
 */
function readScalar(source, key) {
  const value = source[key]
  if (value !== null && typeof value === 'object') {
    if (typeof value.get === 'function') return value.get()
    if (typeof value.value !== 'undefined') return value.value
  }
  return value
}

/**
 * Normalise the plugin config into the values the wrappers use.
 * @param {unknown} config
 * @returns {{ enabled: boolean, humanWaitCapMs: number }}
 */
export function normalizeConfig(config) {
  const source = config !== null && typeof config === 'object' ? config : {}

  const rawEnabled = readScalar(source, 'enabled')
  const enabled = typeof rawEnabled === 'boolean' ? rawEnabled : true

  const rawCap = readScalar(source, 'humanWaitCapMs')
  let humanWaitCapMs = DEFAULT_HUMAN_WAIT_CAP_MS
  if (rawCap === -1) humanWaitCapMs = -1
  else if (typeof rawCap === 'number' && Number.isFinite(rawCap) && rawCap > 0) {
    humanWaitCapMs = Math.min(Math.round(rawCap), MAX_TIMER_MS)
  }

  return { enabled, humanWaitCapMs }
}

/** @param {unknown} value */
function isThenable(value) {
  return value !== null && typeof value === 'object' && typeof value.then === 'function'
}

/** @param {unknown} error */
function messageOf(error) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return String(error)
  } catch {
    return 'unknown error'
  }
}

/**
 * @param {object} ctx
 * @returns {{ info: Function, warn: Function }}
 */
function createLogger(ctx) {
  const noop = () => {}
  try {
    const factory = ctx?.logger
    if (typeof factory === 'function') {
      const scoped = factory('dsh-human-wait')
      if (scoped !== null && typeof scoped === 'object') {
        return {
          info: typeof scoped.info === 'function' ? (...args) => scoped.info(...args) : noop,
          warn: typeof scoped.warn === 'function' ? (...args) => scoped.warn(...args) : noop,
        }
      }
    }
    if (factory !== null && typeof factory === 'object' && typeof factory.info === 'function') {
      return {
        info: (...args) => factory.info(...args),
        warn: typeof factory.warn === 'function' ? (...args) => factory.warn(...args) : noop,
      }
    }
  } catch {
    // fall through to the console fallback
  }
  return {
    info: (...args) => console.log('[dsh-human-wait]', ...args),
    warn: (...args) => console.warn('[dsh-human-wait]', ...args),
  }
}

/**
 * Where to install a method wrapper: the instance itself when the method is an
 * own property, otherwise the class prototype the traceable proxy reads from.
 * @param {object} host
 * @param {string} key
 */
function methodHolder(host, key) {
  if (host === null || typeof host !== 'object') return undefined
  if (typeof host[key] !== 'function') return undefined
  if (Object.hasOwn(host, key)) return host
  const prototype = Object.getPrototypeOf(host)
  if (prototype !== null && prototype !== undefined && typeof prototype[key] === 'function') return prototype
  return host
}

/** @param {unknown} candidate */
function isPatched(candidate) {
  return typeof candidate === 'function' && candidate[PATCHED] === true
}

/**
 * Mark a run's wait bookkeeping active for the duration of `callback`.
 * @template T
 * @param {{ waiters: number, schedule: () => void }} state
 * @param {() => T} callback
 * @returns {T}
 */
function withRunScope(state, callback) {
  return runScope.run(state, callback)
}

/**
 * Register one human-interaction wait in the active run scope. Returns the
 * function that closes it; undefined when the call is not inside a PTC run.
 */
function enterHumanWait() {
  const state = runScope.getStore()
  if (state === undefined) return undefined
  state.schedule() // settle executing time up to this instant
  state.waiters += 1
  state.schedule() // arm the wait cap
  let left = false
  return () => {
    if (left) return
    left = true
    state.schedule() // settle the wait (waiters is still > 0 here)
    state.waiters = Math.max(0, state.waiters - 1)
    state.schedule() // resume the execution budget
  }
}

/**
 * Wrap one asynchronous method so callers' time is not charged to the run.
 * @param {object} host
 * @param {string} key
 * @param {object} logger
 */
function patchWaitMethod(host, key, logger) {
  const holder = methodHolder(host, key)
  if (holder === undefined) return undefined

  const original = holder[key]
  if (isPatched(original)) return undefined

  const wrapped = function patchedHumanWait(...args) {
    const leave = enterHumanWait()
    let result
    try {
      result = Reflect.apply(original, this, args)
    } catch (error) {
      leave?.()
      throw error
    }
    if (isThenable(result)) {
      return result.then(
        (value) => {
          leave?.()
          return value
        },
        (error) => {
          leave?.()
          throw error
        },
      )
    }
    leave?.()
    return result
  }
  wrapped[PATCHED] = true

  try {
    holder[key] = wrapped
  } catch (error) {
    logger.warn(`could not wrap ${key}: ${messageOf(error)}`)
    return undefined
  }

  return () => {
    if (holder[key] === wrapped) holder[key] = original
  }
}

/**
 * Wrap the run method: the runtime keeps its compile/validation, the deadline
 * moves into this plugin so it can be paused.
 * @param {object} runtime
 * @param {{ humanWaitCapMs: number }} settings
 * @param {object} logger
 */
function patchRun(runtime, settings, logger) {
  const holder = methodHolder(runtime, 'run')
  if (holder === undefined) return undefined

  const original = holder.run
  if (isPatched(original)) return undefined
  if (typeof globalThis.AbortSignal?.any !== 'function') {
    logger.warn('AbortSignal.any is unavailable — leaving the shipped PTC deadline in place')
    return undefined
  }

  const wrapped = function patchedRun(spec) {
    const budget = spec !== null && typeof spec === 'object' ? spec.timeoutMs : undefined
    if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0) {
      return Reflect.apply(original, this, [spec])
    }
    try {
      return runWithPausedDeadline(original, this, spec, budget, settings, logger)
    } catch (error) {
      logger.warn(`could not wrap run: ${messageOf(error)} — using the shipped deadline`)
      return Reflect.apply(original, this, [spec])
    }
  }
  wrapped[PATCHED] = true

  try {
    holder.run = wrapped
  } catch (error) {
    logger.warn(`could not wrap run: ${messageOf(error)}`)
    return undefined
  }

  return () => {
    if (holder.run === wrapped) holder.run = original
  }
}

/**
 * Run one program with a deadline that only advances while no human wait is
 * pending. The timer is re-armed whenever a wait starts or ends, so the budget
 * expires at the exact instant the executing time runs out.
 * @param {Function} original
 * @param {unknown} self
 * @param {object} spec
 * @param {number} budget
 * @param {{ humanWaitCapMs: number }} settings
 * @param {object} logger
 */
function runWithPausedDeadline(original, self, spec, budget, settings, logger) {
  const controller = new AbortController()
  const outer = spec.signal
  const signal = outer === undefined ? controller.signal : AbortSignal.any([outer, controller.signal])
  const cap = settings.humanWaitCapMs === -1 ? Infinity : settings.humanWaitCapMs

  let remaining = budget
  let waited = 0
  let last = Date.now()
  let timer
  let aborted = false
  let finished = false

  const state = {
    waiters: 0,
    schedule: () => {},
  }

  const stop = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }
  const settle = () => {
    const now = Date.now()
    const elapsed = Math.max(0, now - last)
    last = now
    if (state.waiters > 0) waited += elapsed
    else remaining -= elapsed
  }
  const expire = (reason) => {
    if (aborted || finished) return
    aborted = true
    stop()
    controller.abort(reason)
  }
  const arm = (delay) => {
    stop()
    if (aborted || finished || !Number.isFinite(delay)) return
    timer = setTimeout(schedule, Math.max(1, Math.ceil(delay)))
    timer.unref?.()
  }
  const schedule = () => {
    if (aborted || finished) return
    settle()
    if (state.waiters > 0) {
      if (waited >= cap) {
        expire(`human interaction wait exceeded (${cap}ms)`)
        return
      }
      arm(cap - waited)
      return
    }
    if (remaining <= 0) {
      expire(`${DEADLINE_MESSAGE} (${budget}ms)`)
      return
    }
    arm(remaining)
  }
  state.schedule = schedule

  let result
  try {
    result = withRunScope(state, () => {
      schedule()
      return Reflect.apply(original, self, [{ ...spec, timeoutMs: null, signal }])
    })
  } catch (error) {
    finished = true
    stop()
    throw error
  }

  return Promise.resolve(result).finally(() => {
    finished = true
    stop()
  })
}

/**
 * @param {object} ctx
 * @param {object} config
 */
export function apply(ctx, config) {
  const settings = normalizeConfig(config)
  const logger = createLogger(ctx)

  if (!settings.enabled) {
    logger.info('disabled by config — leaving the shipped PTC deadline in place')
    return
  }

  ctx.inject(['ptcRuntime', 'userQuestions'], (child) => {
    child.effect(() => {
      const disposers = []
      try {
        for (const key of ['ask', 'askTimed']) {
          const dispose = patchWaitMethod(child.userQuestions, key, logger)
          if (dispose !== undefined) disposers.push(dispose)
        }
        const dispose = patchRun(child.ptcRuntime, settings, logger)
        if (dispose !== undefined) {
          disposers.push(dispose)
          const cap = settings.humanWaitCapMs === -1 ? 'unlimited' : `${settings.humanWaitCapMs} ms`
          logger.info(`PTC run deadlines now pause while a human is waiting (wait cap: ${cap})`)
        } else {
          logger.warn('ptcRuntime.run was not patched — human waits will still count against the run deadline')
        }
      } catch (error) {
        logger.warn(`setup failed: ${messageOf(error)} — leaving the shipped PTC deadline in place`)
        for (const dispose of disposers.reverse()) dispose()
        return () => {}
      }
      return () => {
        for (const dispose of disposers.reverse()) dispose()
      }
    })
  })

  ctx.inject(['approval'], (child) => {
    child.effect(() => patchWaitMethod(child.approval, 'request', logger) ?? (() => {}))
  })
}
