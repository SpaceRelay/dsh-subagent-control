/**
 * dsh-subagent-route — one obvious thing the official subagent tool cannot do:
 * send a subagent to another provider/model from a conversation that already
 * exists.
 *
 * Why the official tool cannot: it only exposes provider/model arguments when
 * the conversation recorded a "subagent/model-selection-policy" event, and that
 * event is written once, at creation time, from the settings page. Older
 * conversations have no such event, so their subagents inherit the parent route
 * and nothing else.
 *
 * This plugin sidesteps that by registering its own tool and calling
 * ctx.subagents.startActivation() directly. The service itself does not consult
 * the policy — only the official tool wrapper does — so no history has to be
 * rewritten and no official package has to be patched.
 *
 * The route is checked with the provider before a child session is created, so
 * a provider name this machine has no adapter for, or a reasoning level the
 * model does not offer, fails here with a readable message instead of leaving
 * behind a subagent that cannot answer. A model id the catalog does not list is
 * not refused on that basis alone: catalogs are advisory, and some adapters
 * accept ids they never advertise.
 */

let Schema
try {
  const loaded = await import('@deepseek-ai/schemastery')
  Schema = loaded.default ?? loaded.Schema
} catch {
  // A link-installed bundle must not require the host's packages; the plugin
  // still works with its defaults when schemastery cannot be resolved.
  Schema = undefined
}

export const name = 'dsh-subagent-route'

/**
 * `llm` checks a route before it is handed to the subagent service;
 * `subagents` starts the child; `tools` publishes the two tools below.
 */
export const inject = ['tools', 'subagents', 'llm']

/** The in-process provider the official `subagent` tool uses. */
const SUBAGENT_PROVIDER = 'spawn'

export const Config = Schema === undefined
  ? undefined
  : Schema.object({
    allowedModels: Schema.array(Schema.object({
      provider: Schema.string().description('LLM provider id, as list_routes reports it.'),
      model: Schema.string().description('Model id within that provider.'),
    })).default([]).volatile()
      .description('Routes subagent_route may use. Empty means every registered route is allowed.'),
  })

/**
 * Resolve a possibly volatile config value (the settings layer may wrap it).
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

/** @param {unknown} entry */
function routeOf(entry) {
  if (entry === null || typeof entry !== 'object') return undefined
  const provider = typeof entry.provider === 'string' ? entry.provider.trim() : ''
  const model = typeof entry.model === 'string' ? entry.model.trim() : ''
  if (provider === '' || model === '') return undefined
  return { provider, model }
}

/**
 * Normalise the plugin config into the values the tools use.
 * @param {unknown} config
 * @returns {{ allowedModels: { provider: string, model: string }[] }}
 */
export function normalizeConfig(config) {
  const source = config !== null && typeof config === 'object' ? config : {}

  const rawAllowed = readScalar(source, 'allowedModels')
  const list = Array.isArray(rawAllowed) ? rawAllowed : []
  const allowedModels = []
  for (const entry of list) {
    const route = routeOf(entry)
    if (route !== undefined) allowedModels.push(route)
  }

  return { allowedModels }
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
 * Copy the reasoning levels out of a resolved model description. Only plain
 * fields are taken, so the result stays serialisable and detached from the
 * objects the LLM service owns.
 * @param {object} row
 * @param {object} info
 */
function attachReasoning(row, info) {
  if (info === undefined || info === null) return
  if (info.reasoning === undefined || info.reasoning === null) return
  row.reasoning = { efforts: [] }
  if (info.reasoning.defaultEffort !== undefined) {
    row.reasoning.default_effort = String(info.reasoning.defaultEffort)
  }
  for (const effort of info.reasoning.efforts ?? []) {
    row.reasoning.efforts.push({
      id: String(effort.id),
      name: typeof effort.name === 'string' ? effort.name : String(effort.id),
      ...(effort.description === undefined ? {} : { description: effort.description }),
    })
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
      const scoped = factory('dsh-subagent-route')
      if (scoped !== null && typeof scoped === 'object') {
        return {
          info: typeof scoped.info === 'function' ? (...args) => scoped.info(...args) : noop,
          warn: typeof scoped.warn === 'function' ? (...args) => scoped.warn(...args) : noop,
        }
      }
    }
  } catch {
    // fall through to the silent fallback
  }
  return { info: noop, warn: noop }
}

/**
 * The route a conversation is actually using right now. A request header wins
 * over the options the agent was created with, because the header is what the
 * current turn really sends.
 * @param {object} parent
 * @returns {{ provider?: string, model?: string, reasoningEffort?: string }}
 */
function parentAgentOptions(parent) {
  const options = parent?.options !== null && typeof parent?.options === 'object' ? parent.options : {}
  let requestConfig
  try {
    requestConfig = parent?.session?.requestHeader?.()?.config
  } catch {
    requestConfig = undefined
  }
  if (requestConfig === undefined || requestConfig === null) return { ...options }

  const { provider: _provider, model: _model, reasoningEffort: _reasoningEffort, ...rest } = options
  return {
    ...rest,
    provider: requestConfig.provider,
    model: requestConfig.model,
    ...(requestConfig.reasoningEffort === undefined ? {} : { reasoningEffort: requestConfig.reasoningEffort }),
  }
}

/**
 * Ask the LLM service whether this route can be called. One call covers the
 * two mistakes every adapter agrees on: a provider nothing is registered for,
 * and a reasoning effort the model does not offer. A model id outside the
 * catalog is deliberately not one of them — catalog membership is advisory, and
 * an adapter such as the DeepSeek one accepts any id and degrades instead of
 * refusing.
 * @param {object} llm
 * @param {{ provider?: string, model?: string, reasoningEffort?: string }} parentOptions
 * @param {{ provider?: string, model?: string, reasoningEffort?: string }} requested
 * @param {AbortSignal} signal
 */
async function preflightRoute(llm, parentOptions, requested, signal) {
  const provider = requested.provider ?? parentOptions.provider
  const model = requested.model ?? parentOptions.model
  if (provider === undefined || model === undefined) {
    throw new Error('cannot pick a child route: neither the request nor the calling conversation names a provider and model')
  }
  const routeChanged = provider !== parentOptions.provider || model !== parentOptions.model
  // A different model usually has a different set of efforts, so the parent's
  // effort is only carried over when the route stays the same.
  const reasoningEffort = requested.reasoningEffort ?? (routeChanged ? undefined : parentOptions.reasoningEffort)
  await llm.resolveCallConfig({
    provider,
    model,
    ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
  }, signal)
}

/**
 * Ask the provider whether it will answer for a model it did not list. A model
 * list is only a catalogue; the adapter behind the provider decides what it can
 * actually call. Returns either the resolved description or the reason the
 * provider refused.
 * @param {object} llm
 * @param {string} provider
 * @param {string} model
 * @param {AbortSignal} signal
 * @returns {Promise<{ info?: object, rejection?: string }>}
 */
async function probeUnlistedModel(llm, provider, model, signal) {
  try {
    return { info: await llm.resolveModelInfo(provider, model, signal) }
  } catch (error) {
    return { rejection: messageOf(error) }
  }
}

const ACTIVATION_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'name'],
  properties: {
    kind: { type: 'string', enum: ['activation'] },
    name: { type: 'string' },
  },
}

const EFFORT_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
  },
}

const MODEL_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    reasoning: {
      type: 'object',
      additionalProperties: false,
      required: ['efforts'],
      properties: {
        default_effort: { type: 'string' },
        efforts: { type: 'array', items: EFFORT_ITEM },
      },
    },
  },
}

const PROVIDER_GROUP = {
  type: 'object',
  additionalProperties: false,
  required: ['provider', 'name', 'models'],
  properties: {
    provider: { type: 'string' },
    name: { type: 'string' },
    models: { type: 'array', items: MODEL_ITEM },
    note: { type: 'string' },
  },
}

/**
 * @param {object} ctx
 * @param {object} config
 */
export function apply(ctx, config) {
  const logger = createLogger(ctx)

  // Own the settings page: the browser half renders the form, so the host must
  // not auto-generate a second one from the Config schema.
  ctx.inject(['settings'], (child) => {
    try {
      child.settings.configure({ auto: false }, ctx.fiber)
    } catch (error) {
      logger.warn(`could not take over the settings page: ${messageOf(error)}`)
    }
  })

  ctx.tools.register({
    name: 'subagent_route',
    description:
      'Start a subagent on a provider and model you name, in any conversation, including one that was already running before this plugin existed. ' +
      'Use it when the work should run on a different channel or a cheaper or stronger model than the current one. ' +
      'The route is checked with the provider first, so a misspelled provider or a reasoning level the model does not offer fails immediately instead of leaving a child that cannot answer. ' +
      'The subagent gets no copy of this conversation; write the whole task into prompt. ' +
      'Use list_routes to see what provider and model ids exist.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['description', 'prompt', 'provider', 'model'],
      properties: {
        description: {
          type: 'string',
          description: 'A short (3-5 word) description of the delegated task, for display. Use the language of the current request.',
        },
        prompt: {
          type: 'string',
          description: 'The complete, self-contained task for the subagent. It does not share this conversation, so include everything it needs.',
        },
        provider: {
          type: 'string',
          description: 'LLM provider id, exactly as list_routes reports it.',
        },
        model: {
          type: 'string',
          description: 'Model id within that provider, exactly as list_routes reports it.',
        },
        reasoning_effort: {
          type: 'string',
          description: 'Reasoning effort id for the chosen model. Omit to use that model\'s default effort.',
        },
        name: {
          type: 'string',
          description: 'Optional short name for the subagent, unique among the subagents you start: lower-case letters, digits, and hyphens, starting with a letter, at most 32 characters.',
        },
        cwd: {
          type: 'string',
          description: 'Optional working directory for the subagent. Defaults to this conversation\'s directory.',
        },
      },
    },
    output: {
      schema: ACTIVATION_OUTPUT,
      render: (args, value) => [{
        type: 'text',
        text: `started subagent ${value.name} on ${args.provider}/${args.model}`,
      }],
      presentationMeta: (_args, value) => ({ kind: value.kind, name: value.name }),
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const live = normalizeConfig(config)

      const parent = exec.agent
      if (parent === undefined) {
        throw new Error('subagent_route requires a calling agent (exec.agent was undefined)')
      }

      const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : ''
      if (prompt === '') throw new Error('subagent_route needs a non-empty prompt')
      const provider = typeof args.provider === 'string' ? args.provider.trim() : ''
      if (provider === '') throw new Error('subagent_route needs a non-empty provider')
      const model = typeof args.model === 'string' ? args.model.trim() : ''
      if (model === '') throw new Error('subagent_route needs a non-empty model')

      const rawEffort = args.reasoning_effort
      const reasoningEffort = typeof rawEffort === 'string' && rawEffort.trim() !== '' ? rawEffort.trim() : undefined

      if (live.allowedModels.length > 0) {
        const allowed = live.allowedModels.some((route) => route.provider === provider && route.model === model)
        if (!allowed) {
          const list = live.allowedModels.map((route) => `${route.provider}/${route.model}`).join(', ')
          throw new Error(`route "${provider}/${model}" is not in this plugin's allow-list (allowed: ${list})`)
        }
      }

      if (ctx.subagents.getProvider(SUBAGENT_PROVIDER) === undefined) {
        throw new Error(`no subagent provider is registered under "${SUBAGENT_PROVIDER}"; cannot start a subagent`)
      }

      await preflightRoute(ctx.llm, parentAgentOptions(parent), { provider, model, reasoningEffort }, exec.signal)
      exec.signal.throwIfAborted()

      const maxDepth = ctx.subagents.resolveMaxDepth()
      const label = typeof args.description === 'string' && args.description.trim() !== ''
        ? args.description.trim()
        : `subagent on ${provider}/${model}`

      const started = await ctx.subagents.startActivation({
        provider: SUBAGENT_PROVIDER,
        label,
        ...(args.name === undefined ? {} : { name: args.name }),
        prompt: [{ type: 'text', text: prompt }],
        parent,
        ...(args.cwd === undefined ? {} : { cwd: args.cwd }),
        agentOptions: {
          provider,
          model,
          ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
        },
        ...(maxDepth === undefined ? {} : { maxDepth }),
        signal: exec.signal,
        delivery: 'parent',
      })

      logger.info(`started ${started.name} on ${provider}/${model}`)
      return { kind: 'activation', name: started.name }
    },
  })

  ctx.tools.register({
    name: 'list_routes',
    description:
      'List the provider and model ids that subagent_route accepts. ' +
      'Pass provider to narrow the list, or provider and model together to see that model\'s reasoning efforts. ' +
      'Without arguments it lists every registered provider, which can be long.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        provider: {
          type: 'string',
          description: 'Only list this provider. Omit to list every registered provider.',
        },
        model: {
          type: 'string',
          description: 'Only this model, including its reasoning efforts. Requires provider.',
        },
      },
    },
    output: {
      schema: { type: 'array', items: PROVIDER_GROUP },
      render: (_args, groups) => {
        if (groups.length === 0) return [{ type: 'text', text: '(no providers)' }]
        const lines = []
        for (const group of groups) {
          const count = group.models.length
          lines.push(`${group.provider}  (${group.name})  ${count} ${count === 1 ? 'model' : 'models'}`)
          if (group.note !== undefined) lines.push(`  ! ${group.note}`)
          for (const model of group.models) {
            const efforts = model.reasoning === undefined
              ? ''
              : `  efforts: ${model.reasoning.efforts.map((effort) => effort.id).join(', ')}`
            lines.push(`  ${model.id}${model.name === model.id ? '' : `  (${model.name})`}${efforts}`)
          }
        }
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const llm = ctx.llm
      const onlyProvider = typeof args.provider === 'string' && args.provider.trim() !== '' ? args.provider.trim() : undefined
      const onlyModel = typeof args.model === 'string' && args.model.trim() !== '' ? args.model.trim() : undefined

      if (onlyModel !== undefined && onlyProvider === undefined) {
        throw new Error('list_routes needs provider when model is given')
      }

      const providers = llm.listProviders()
      const wanted = onlyProvider === undefined ? providers : providers.filter((entry) => entry.id === onlyProvider)
      if (onlyProvider !== undefined && wanted.length === 0) {
        const known = providers.map((entry) => entry.id).join(', ')
        throw new Error(`no LLM provider is registered under "${onlyProvider}" (known: ${known})`)
      }

      const groups = []
      for (const provider of wanted) {
        exec.signal.throwIfAborted()
        const group = { provider: provider.id, name: provider.name, models: [] }
        let models = []
        try {
          models = await llm.listModels(provider.id)
        } catch (error) {
          group.note = `this provider did not return a model list: ${messageOf(error)}`
        }

        for (const model of models) {
          if (onlyModel !== undefined && model.id !== onlyModel) continue
          const row = { id: model.id, name: model.name }
          if (model.description !== undefined) row.description = model.description
          if (onlyModel !== undefined) {
            try {
              attachReasoning(row, await llm.resolveModelInfo(provider.id, model.id, exec.signal))
            } catch (error) {
              group.note = `could not read the details of ${model.id}: ${messageOf(error)}`
            }
          }
          group.models.push(row)
        }

        // A model missing from the catalogue is not proof that the route is
        // dead: the provider itself is the authority, and some adapters accept
        // any id. Ask it directly before saying the model does not exist.
        if (onlyModel !== undefined && group.models.length === 0) {
          const notes = group.note === undefined ? [] : [group.note]
          const probe = await probeUnlistedModel(llm, provider.id, onlyModel, exec.signal)
          if (probe.rejection === undefined) {
            const row = { id: onlyModel, name: onlyModel }
            attachReasoning(row, probe.info)
            group.models.push(row)
            notes.push(`"${onlyModel}" is not in this provider's model list, but the provider accepts it`)
          } else {
            notes.push(`"${onlyModel}" is not listed by this provider: ${probe.rejection}`)
          }
          group.note = notes.join('; ')
        }
        groups.push(group)
      }

      return groups
    },
  })

  logger.info('subagent_route and list_routes are available')
}