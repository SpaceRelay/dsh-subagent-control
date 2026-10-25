window.__ModuleLoader__.load({
  id: 'dsh-team-limits',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var React = require('react')
    var h = React.createElement

    var NS = 'team-limits'

    var DEFAULTS = {
      maxMembers: 32,
      maxTasks: 512,
      maxMessageBytes: 131072,
      disposalTimeoutMs: 5000,
    }

    var SECTIONS = [
      {
        id: 'runtime',
        zh: '运行限制',
        en: 'Runtime limits',
        zhNote: '一个团队同时能容纳的成员数与任务板容量。',
        enNote: 'How many members a team holds and how many tasks its board keeps.',
        fields: [
          {
            key: 'maxMembers',
            zh: '团队人数上限',
            en: 'Maximum team members',
            zhHelp: '含你（Lead）在内的成员总数上限。',
            enHelp: 'Members per team, the Lead included.',
          },
          {
            key: 'maxTasks',
            zh: '任务数上限',
            en: 'Maximum tasks',
            zhHelp: '共享任务板上同时保留的任务数。',
            enHelp: 'Tasks the shared board keeps at once.',
          },
        ],
      },
      {
        id: 'messaging',
        zh: '消息与清理',
        en: 'Messages and teardown',
        zhNote: '单条消息的体积上限，以及成员停止时的等待时间。',
        enNote: 'Upper bound for one message, and how long teardown waits.',
        fields: [
          {
            key: 'maxMessageBytes',
            zh: '单条消息上限（字节）',
            en: 'Maximum message size (bytes)',
            zhHelp: '131072 字节 = 128 KB。',
            enHelp: '131072 bytes = 128 KB.',
          },
          {
            key: 'disposalTimeoutMs',
            zh: '清理超时（毫秒）',
            en: 'Disposal timeout (ms)',
            zhHelp: '成员停止时最多等待多久再强制结束。',
            enHelp: 'How long teardown waits before forcing the stop.',
          },
        ],
      },
    ]

    function isZh() {
      try {
        return (navigator.language || '').toLowerCase().indexOf('zh') === 0
      } catch (error) {
        return false
      }
    }

    var COPY = {
      title: ['团队限额', 'Team limits'],
      intro: [
        '设置 Agent Team 的成员数、任务数、消息大小与清理超时。改动会写入 agent-team 行，按正常加载流程生效。',
        'Team size, task count, message size and teardown timeout for Agent Team. Changes are written onto the agent-team row and applied on the normal load path.',
      ],
      overridden: ['已覆盖', 'Overridden'],
      reset: ['恢复默认', 'Restore default'],
      loading: ['正在读取配置…', 'Loading configuration…'],
      unavailable: [
        '当前连接不支持写入设置，这一页只能查看。',
        'This connection cannot write settings, so this page is read-only.',
      ],
      saveFailed: ['保存失败：', 'Save failed: '],
      note: [
        '数值保存在当前 profile 的补丁层；卸载本插件不会自动撤回。',
        'Values persist in this profile patch layer; uninstalling the plugin does not roll them back.',
      ],
    }

    function t(key) {
      var pair = COPY[key]
      if (pair === undefined) return key
      return isZh() ? pair[0] : pair[1]
    }

    var CSS = [
      '.dtl { display: flex; flex-direction: column; gap: 26px; max-width: 820px; padding: 4px 2px 8px; }',
      '.dtl-head { display: flex; flex-direction: column; gap: 6px; }',
      '.dtl-title { font-size: 22px; font-weight: 650; letter-spacing: .01em; margin: 0; line-height: 1.3; }',
      '.dtl-sub { font-size: 13px; opacity: .62; line-height: 1.6; margin: 0; max-width: 64ch; }',
      '.dtl-group { display: flex; flex-direction: column; gap: 14px; }',
      '.dtl-group-title { font-size: 14.5px; font-weight: 600; margin: 0; line-height: 1.4; }',
      '.dtl-group-note { font-size: 12px; opacity: .55; margin: -8px 0 0; line-height: 1.6; }',
      '.dtl-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 24px; }',
      '@media (max-width: 720px) { .dtl-grid { grid-template-columns: minmax(0, 1fr); } }',
      '.dtl-cell { display: flex; flex-direction: column; gap: 8px; min-width: 0; }',
      '.dtl-labelrow { display: flex; align-items: center; gap: 8px; min-height: 20px; }',
      '.dtl-label { font-size: 13px; font-weight: 500; }',
      '.dtl-chip { font-size: 11.5px; line-height: 18px; padding: 0 8px; border-radius: 999px; background: rgba(128,128,128,.14); opacity: .8; }',
      '.dtl-spacer { flex: 1 1 auto; }',
      '.dtl-reset { font-size: 12.5px; color: inherit; opacity: .55; background: none; border: none; padding: 0; cursor: pointer; }',
      '.dtl-reset:hover:not(:disabled) { opacity: .85; text-decoration: underline; }',
      '.dtl-reset:disabled { opacity: .25; cursor: default; }',
      '.dtl-input { width: 100%; box-sizing: border-box; height: 38px; padding: 0 12px; font-size: 13.5px; font-variant-numeric: tabular-nums; border-radius: 9px; border: 1px solid rgba(128,128,128,.36); background: transparent; color: inherit; outline: none; }',
      '.dtl-input:focus { border-color: rgba(76,139,245,.85); }',
      '.dtl-input:disabled { opacity: .45; }',
      '.dtl-help { font-size: 12px; opacity: .5; line-height: 1.5; }',
      '.dtl-foot { font-size: 12px; opacity: .48; line-height: 1.6; margin: 0; max-width: 64ch; }',
      '.dtl-error { font-size: 12.5px; color: #d9534f; }',
      '.dtl-summary { font-size: 13px; opacity: .78; font-variant-numeric: tabular-nums; }',
    ].join('\n')

    function numberOr(value, fallback) {
      var parsed = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback
    }

    function valuesOf(source) {
      var result = {}
      for (var index = 0; index < SECTIONS.length; index += 1) {
        var fields = SECTIONS[index].fields
        for (var inner = 0; inner < fields.length; inner += 1) {
          var key = fields[inner].key
          result[key] = numberOr(source === null || source === undefined ? undefined : source[key], DEFAULTS[key])
        }
      }
      return result
    }

    function Field(props) {
      var field = props.field
      var overridden = props.value !== DEFAULTS[field.key]
      return h(
        'div',
        { className: 'dtl-cell' },
        h(
          'div',
          { className: 'dtl-labelrow' },
          h('label', { className: 'dtl-label', htmlFor: 'dtl-' + field.key }, isZh() ? field.zh : field.en),
          overridden ? h('span', { className: 'dtl-chip' }, t('overridden')) : null,
          h('span', { className: 'dtl-spacer' }),
          overridden
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dtl-reset',
                  disabled: props.disabled,
                  onClick: function () {
                    props.onReset(field.key)
                  },
                },
                t('reset'),
              )
            : null,
        ),
        h('input', {
          id: 'dtl-' + field.key,
          className: 'dtl-input',
          type: 'number',
          min: 1,
          step: 1,
          inputMode: 'numeric',
          disabled: props.disabled,
          value: String(props.value),
          onChange: function (event) {
            props.onInput(field.key, event.target.value)
          },
        }),
        h('span', { className: 'dtl-help' }, isZh() ? field.zhHelp : field.enHelp),
      )
    }

    function TeamLimitsPage(props) {
      var form = props.configForm || props.form
      var summary = props.view === 'summary'

      if (!form) {
        return h('p', { className: 'dtl-foot' }, t('loading'))
      }

      var snapshotPair = React.useState(function () {
        return form.getSnapshot()
      })
      var snapshot = snapshotPair[0]
      var setSnapshot = snapshotPair[1]

      var draftPair = React.useState(function () {
        return valuesOf(snapshot.value)
      })
      var draft = draftPair[0]
      var setDraft = draftPair[1]

      var errorPair = React.useState('')
      var error = errorPair[0]
      var setError = errorPair[1]

      var pendingPair = React.useState({})
      var pending = pendingPair[0]
      var setPending = pendingPair[1]

      React.useEffect(function () {
        var off = form.subscribe(function () {
          setSnapshot(form.getSnapshot())
        })
        setSnapshot(form.getSnapshot())
        return off
      }, [form])

      React.useEffect(function () {
        var next = valuesOf(snapshot.value)
        var keys = Object.keys(pending)
        setDraft(function (previous) {
          var merged = {}
          for (var name in previous) merged[name] = previous[name]
          for (var name in next) {
            if (keys.indexOf(name) < 0) merged[name] = next[name]
          }
          return merged
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [snapshot.value])

      React.useEffect(function () {
        var keys = Object.keys(pending)
        if (keys.length === 0) return undefined
        var timer = setTimeout(function () {
          var chain = Promise.resolve()
          keys.forEach(function (key) {
            chain = chain.then(function () {
              return form.set(key, pending[key])
            })
          })
          chain
            .then(function () {
              setPending({})
            })
            .catch(function (caught) {
              setPending({})
              setError(t('saveFailed') + String((caught && caught.message) || caught))
            })
        }, 700)
        return function () {
          clearTimeout(timer)
        }
      }, [pending, form])

      var ready = snapshot.status === 'ready'
      var disabled = !ready

      function write(key, value) {
        setError('')
        setPending(function (previous) {
          var next = {}
          for (var name in previous) next[name] = previous[name]
          next[key] = value
          return next
        })
      }

      function onInput(key, raw) {
        var parsed = Number(raw)
        var safe = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : DEFAULTS[key]
        setDraft(function (previous) {
          var next = {}
          for (var name in previous) next[name] = previous[name]
          next[key] = safe
          return next
        })
        if (raw === '') return
        write(key, safe)
      }

      function onReset(key) {
        setDraft(function (previous) {
          var next = {}
          for (var name in previous) next[name] = previous[name]
          next[key] = DEFAULTS[key]
          return next
        })
        write(key, DEFAULTS[key])
      }

      if (summary) {
        return h(
          'span',
          { className: 'dtl-summary' },
          [
            draft.maxMembers + (isZh() ? ' 成员' : ' members'),
            draft.maxTasks + (isZh() ? ' 任务' : ' tasks'),
            draft.maxMessageBytes + (isZh() ? ' 字节/条' : ' bytes/msg'),
            draft.disposalTimeoutMs + ' ms',
          ].join(' · '),
        )
      }

      var groups = SECTIONS.map(function (section) {
        return h(
          'section',
          { className: 'dtl-group', key: section.id },
          h('h3', { className: 'dtl-group-title' }, isZh() ? section.zh : section.en),
          h('p', { className: 'dtl-group-note' }, isZh() ? section.zhNote : section.enNote),
          h(
            'div',
            { className: 'dtl-grid' },
            section.fields.map(function (field) {
              return h(Field, {
                key: field.key,
                field: field,
                value: draft[field.key],
                disabled: disabled,
                onInput: onInput,
                onReset: onReset,
              })
            }),
          ),
        )
      })

      return h(
        'div',
        { className: 'dtl' },
        h('style', null, CSS),
        ready ? null : h('p', { className: 'dtl-foot' }, t(snapshot.status === 'unavailable' ? 'unavailable' : 'loading')),
        groups,
        error ? h('p', { className: 'dtl-error' }, error) : null,
        h('p', { className: 'dtl-foot' }, t('note')),
      )
    }

    function apply(ctx) {
      try {
        var forms = ctx.configForms
        var form = forms ? forms.get(NS) : null
        if (!form) {
          console.error('[team-limits] configForms service is unavailable; no settings page is registered')
          return
        }
        ctx.effect(
          function () {
            return forms.whileServed([NS], function () {
              return ctx.slots.inject('plugins.bundle.config', function () {
                return ctx.slots.register(
                  {
                    name: 'plugins.bundle.config',
                    key: 'dsh-team-limits',
                    inject: function () {
                      return { configForm: form }
                    },
                  },
                  TeamLimitsPage,
                )
              })
            })
          },
          'team-limits: bundle config',
        )
      } catch (error) {
        console.error('[team-limits] client half failed to mount: ' + String((error && error.message) || error))
      }
    }

    exports.name = 'dsh-team-limits'
    exports.inject = ['slots', 'configForms']
    exports.apply = apply

    return module.exports
  },
})
