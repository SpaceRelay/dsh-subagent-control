/**
 * dsh-team-limits — Host half.
 *
 * DSH 0.2.2 turned Team into a per-session switch and cut the shipped
 * `agent-team` row down to two settings: the task-board capacity and whether a
 * new session starts with teams on. This plugin is the page for those two, so
 * they reach users without a hand-edited patch.
 *
 * `apply` pushes the chosen values onto the shipped `agent-team` row through
 * the config editor, which persists them in the profile patch layer and
 * applies them on the normal Loader path.
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
  maxTasks: 256,
  defaultEnabled: false,
}

/**
 * Settings the shipped row no longer accepts. Since 0.2.2 teammates are plain
 * subagents, so these keys exist nowhere; writing one back makes the row throw
 * `TEAM_INVALID_CONFIG` at load. The push therefore deletes them.
 */
const REMOVED = ['maxMembers', 'maxMessageBytes', 'disposalTimeoutMs']

const RETRY_DELAYS = [1300, 4000, 8000]

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
        maxTasks: Schema.natural()
          .min(1)
          .volatile()
          .default(DEFAULTS.maxTasks)
          .description('Maximum number of tasks the shared team board keeps.'),
        defaultEnabled: Schema.boolean()
          .volatile()
          .default(DEFAULTS.defaultEnabled)
          .description('Whether a new session starts with Team collaboration on.'),
      }).description('Team settings applied to the shipped agent-team row.')

function normalize(config) {
  const source = config ?? {}
  const tasks =
    typeof source.maxTasks === 'number' && Number.isFinite(source.maxTasks) && source.maxTasks >= 1
      ? Math.floor(source.maxTasks)
      : DEFAULTS.maxTasks
  const enabled =
    typeof source.defaultEnabled === 'boolean' ? source.defaultEnabled : DEFAULTS.defaultEnabled
  return { maxTasks: tasks, defaultEnabled: enabled }
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

/** True when the row already holds exactly what we would write. */
function alreadyApplied(override, desired) {
  if (override === null || override === undefined) return false
  if (REMOVED.some((key) => Object.hasOwn(override, key))) return false
  return override.maxTasks === desired.maxTasks && override.defaultEnabled === desired.defaultEnabled
}

/** The override we want on the row: our two values, and none of the removed keys. */
function nextOverride(override, desired) {
  const next = {}
  for (const [key, value] of Object.entries(override ?? {})) {
    if (REMOVED.includes(key)) continue
    if (key === 'maxTasks' || key === 'defaultEnabled') continue
    next[key] = value
  }
  next.maxTasks = desired.maxTasks
  next.defaultEnabled = desired.defaultEnabled
  return next
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
async function push(ctx, desired) {
  return escapeTransaction(ctx, async () => {
    try {
      const rows = ctx.configEditor.configuration()
      const row = rows.find((item) => entryId(item?.entry) === 'agent-team')
      if (row === undefined) {
        return true
      }
      if (alreadyApplied(row.override, desired)) {
        return false
      }
      await ctx.configEditor.edit(row.entry, (current) => nextOverride(current, desired))
      return false
    } catch {
      return true
    }
  })
}

function schedule(ctx, desired, attempt) {
  const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]
  setTimeout(() => {
    void push(ctx, desired).then((retry) => {
      if (retry && attempt + 1 < RETRY_DELAYS.length) schedule(ctx, desired, attempt + 1)
    })
  }, delay)
}

/** Volatile fields arrive as read-only references; ordinary ones as values. */
function readValue(value, fallback) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    const current = value.get()
    return current === undefined ? fallback : current
  }
  return value === undefined ? fallback : value
}

/** The settings the page has saved, read from the live Config references. */
function currentValues(config) {
  const source = config === null || config === undefined ? {} : config
  return normalize({
    maxTasks: readValue(source.maxTasks, DEFAULTS.maxTasks),
    defaultEnabled: readValue(source.defaultEnabled, DEFAULTS.defaultEnabled),
  })
}

/**
 * True for a root session that has not started a turn yet and never had the
 * team switch written. DSH 0.2.2 itself only honours `defaultEnabled` when the
 * agent is announced with `source: "startup"`; a conversation opened from its
 * first message is resumed instead, so its session starts with teams off.
 * A session that already ran a turn, or that carries a `team/mode` event, is
 * left alone — that covers a reopened old conversation and a switch the user
 * turned off on purpose.
 */
function isFreshRootSession(session) {
  const header = session === null || session === undefined ? undefined : session.header
  if (header?.origin === 'subagent') return false
  if (typeof header?.delegationDepth === 'number' && header.delegationDepth > 0) return false
  const log = session?.log
  if (!Array.isArray(log)) return false
  for (const event of log) {
    if (event?.type === 'team/mode' || event?.type === 'turn/start') return false
  }
  return true
}

/**
 * Turn teams on for a fresh conversation when the saved default says so.
 * The shipped handler only sees `source: "startup"`, so this covers the other
 * creation path; it is idempotent with that handler, and it never touches a
 * session that already made a choice.
 */
function enableFreshSession(ctx, agent, config) {
  try {
    if (!currentValues(config).defaultEnabled) return
    const teams = ctx.get('agentTeams')
    if (teams === undefined || typeof teams.setEnabled !== 'function') return
    const session = agent === null || agent === undefined ? undefined : agent.session
    if (!isFreshRootSession(session)) return
    void Promise.resolve(teams.setEnabled(agent, true)).catch(() => {})
  } catch {
    /* the switch is a convenience; never break an agent that just started */
  }
}

export function apply(ctx, config) {
  /* This package ships its own page, so the harness must not auto-generate one. */
  ctx.inject(['settings'], (child) => {
    child.settings.configure({ auto: false }, ctx.fiber)
  })
  if (typeof ctx.on === 'function') {
    ctx.on('agent/created', ({ agent }) => enableFreshSession(ctx, agent, config))
  }
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
