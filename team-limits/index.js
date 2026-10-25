/**
 * dsh-team-limits — Host half.
 *
 * The four Agent Team limits are this plugin's Config, so the browser half can
 * render them as a real settings page. `apply` pushes the chosen values onto
 * the shipped `agent-team` row through the config editor, which persists them
 * in the profile patch layer and applies them on the normal Loader path.
 *
 * The editor refuses to run inside an existing HMR transaction ("HMR
 * transactions cannot be nested"). Our apply() runs inside the transaction
 * that mounted this plugin, and every timer created there inherits that
 * context through AsyncLocalStorage, so a plain setTimeout would still be
 * nested. `escapeTransaction` runs the push through the HMR service's own
 * AsyncLocalStorage.exit, which is exactly the escape hatch the service
 * itself uses for its watchers.
 */

export const name = 'dsh-team-limits'

export const inject = ['configEditor']

const DEFAULTS = {
  maxMembers: 32,
  maxTasks: 512,
  maxMessageBytes: 131072,
  disposalTimeoutMs: 5000,
}

const RETRY_DELAYS = [1300, 4000, 8000]

const DEBUG = 'C:/Users/Administrator/.dsh/team-limits-debug.log'

async function trace(message) {
  try {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(DEBUG, new Date().toISOString() + ' ' + message + '\n')
  } catch {
    /* diagnostics must never break the plugin */
  }
}

let Schema
try {
  const loaded = await import('@deepseek-ai/schemastery')
  Schema = loaded.default ?? loaded.Schema
} catch {
  Schema = undefined
}

export const Config =
  Schema === undefined
    ? undefined
    : Schema.object({
        maxMembers: Schema.natural()
          .min(1)
          .volatile()
          .default(DEFAULTS.maxMembers)
          .description('Maximum number of teammates in one team.'),
        maxTasks: Schema.natural()
          .min(1)
          .volatile()
          .default(DEFAULTS.maxTasks)
          .description('Maximum number of tasks the shared task board keeps.'),
        maxMessageBytes: Schema.natural()
          .min(1)
          .volatile()
          .default(DEFAULTS.maxMessageBytes)
          .description('Maximum size of a single team message, in bytes (131072 = 128 KB).'),
        disposalTimeoutMs: Schema.natural()
          .min(1)
          .volatile()
          .default(DEFAULTS.disposalTimeoutMs)
          .description('How long teardown waits for a member before giving up, in milliseconds.'),
      }).description('Limits applied to the shipped Agent Team row.')

function normalize(config) {
  const source = config ?? {}
  const result = {}
  for (const key of Object.keys(DEFAULTS)) {
    const value = source[key]
    result[key] =
      typeof value === 'number' && Number.isFinite(value) && value >= 1
        ? Math.floor(value)
        : DEFAULTS[key]
  }
  return result
}

function entryId(entry) {
  if (entry === null || entry === undefined) return ''
  if (typeof entry === 'string') return entry
  const candidates = [entry.options?.id, entry.id, entry.patch?.id, entry.entry?.id]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return ''
}

function alreadyApplied(override, desired) {
  if (override === null || override === undefined) return false
  return Object.keys(desired).every((key) => override[key] === desired[key])
}

/**
 * Run `work` outside any HMR transaction. The service keeps its flag in an
 * AsyncLocalStorage; ours was inherited from the transaction that mounted this
 * plugin, so only its own `exit` can clear it for a later asynchronous task.
 */
function escapeTransaction(ctx, work) {
  let executing
  try {
    const hmr = ctx.get('hmr')
    executing = hmr === undefined ? undefined : hmr.executing
  } catch {
    executing = undefined
  }
  if (executing !== undefined && typeof executing.exit === 'function') {
    return executing.exit(work)
  }
  return work()
}

/** @returns {Promise<boolean>} true when another attempt is worth making. */
async function push(ctx, desired, attempt) {
  return escapeTransaction(ctx, async () => {
    try {
      const rows = ctx.configEditor.configuration()
      const row = rows.find((item) => entryId(item?.entry) === 'agent-team')
      if (row === undefined) {
        await trace('attempt ' + attempt + ': agent-team row not found')
        return true
      }
      if (alreadyApplied(row.override, desired)) {
        await trace('attempt ' + attempt + ': already applied')
        return false
      }
      await ctx.configEditor.edit(row.entry, () => ({ ...desired }))
      await trace('attempt ' + attempt + ': applied ' + JSON.stringify(desired))
      return false
    } catch (error) {
      const message = String((error && error.message) || error)
      await trace('attempt ' + attempt + ': error=' + message)
      return true
    }
  })
}

function schedule(ctx, desired, attempt) {
  const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]
  setTimeout(() => {
    void push(ctx, desired, attempt).then((retry) => {
      if (retry && attempt + 1 < RETRY_DELAYS.length) schedule(ctx, desired, attempt + 1)
    })
  }, delay)
}

/** Volatile fields arrive as read-only references; ordinary ones as numbers. */
function readValue(value, fallback) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    const current = value.get()
    return typeof current === 'number' ? current : fallback
  }
  return typeof value === 'number' ? value : fallback
}

/** The limits the page has saved, read from the live Config references. */
function currentValues(config) {
  const raw = {}
  for (const key of Object.keys(DEFAULTS)) raw[key] = readValue(config === null || config === undefined ? undefined : config[key], DEFAULTS[key])
  return normalize(raw)
}

export function apply(ctx, config) {
  /* This package ships its own page, so the harness must not auto-generate one. */
  ctx.inject(['settings'], (child) => {
    child.settings.configure({ auto: false }, ctx.fiber)
  })
  setTimeout(() => {
    try {
      const settings = ctx.get('settings')
      const rows = settings === undefined ? [] : settings.describe()
      void trace('namespaces=' + rows.map((row) => row.ns).join(','))
    } catch (error) {
      void trace('describe error=' + String((error && error.message) || error))
    }
  }, 3000)
  schedule(ctx, currentValues(config), 0)
  /*
   * Volatile fields are edited in place without remounting this plugin, so the
   * only way to learn about a saved form is to look at the references again.
   * One timer, one comparison per tick, nothing while the values are unchanged.
   */
  ctx.effect(() => {
    let last = JSON.stringify(currentValues(config))
    const timer = setInterval(() => {
      const next = currentValues(config)
      const serialized = JSON.stringify(next)
      if (serialized === last) return
      last = serialized
      void push(ctx, next, 1)
    }, 1500)
    return () => clearInterval(timer)
  })
}
