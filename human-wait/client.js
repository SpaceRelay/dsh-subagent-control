window.__ModuleLoader__.load({
  id: 'dsh-human-wait',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var React = require('react')
    var h = React.createElement

    var NS = 'human-wait'

    var DEFAULTS = {
      humanWaitCapMs: 86400000,
    }

    var HOUR = 3600000

    var QUICK_CAPS = [
      { value: HOUR, zh: '1 小时', en: '1 hour' },
      { value: 24 * HOUR, zh: '24 小时', en: '24 hours' },
      { value: -1, zh: '无限', en: 'Unlimited' },
    ]

    function isZh() {
      try {
        return (navigator.language || '').toLowerCase().indexOf('zh') === 0
      } catch (error) {
        return false
      }
    }

    var COPY = {
      capLabel: ['等待上限（毫秒）', 'Wait cap (ms)'],
      capHelp: [
        '一次运行最多在等待人上花多久。-1 表示不设上限。',
        'How long one run may spend waiting for a human. -1 means no cap.',
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
      '.dhw { display: flex; flex-direction: column; gap: 26px; max-width: 820px; padding: 4px 2px 8px; }',
      '.dhw-group { display: flex; flex-direction: column; gap: 14px; }',
      '.dhw-group-title { font-size: 14.5px; font-weight: 600; margin: 0; line-height: 1.4; }',
      '.dhw-cell { display: flex; flex-direction: column; gap: 8px; min-width: 0; }',
      '.dhw-labelrow { display: flex; align-items: center; gap: 8px; min-height: 20px; }',
      '.dhw-label { font-size: 13px; font-weight: 500; }',
      '.dhw-chip { font-size: 11.5px; line-height: 18px; padding: 0 8px; border-radius: 999px; background: rgba(128,128,128,.14); opacity: .8; }',
      '.dhw-spacer { flex: 1 1 auto; }',
      '.dhw-reset { font-size: 12.5px; color: inherit; opacity: .55; background: none; border: none; padding: 0; cursor: pointer; }',
      '.dhw-reset:hover:not(:disabled) { opacity: .85; text-decoration: underline; }',
      '.dhw-reset:disabled { opacity: .25; cursor: default; }',
      '.dhw-input { width: 100%; box-sizing: border-box; height: 38px; padding: 0 12px; font-size: 13.5px; font-variant-numeric: tabular-nums; border-radius: 9px; border: 1px solid rgba(128,128,128,.36); background: transparent; color: inherit; outline: none; }',
      '.dhw-input:focus { border-color: rgba(76,139,245,.85); }',
      '.dhw-input:disabled { opacity: .45; }',
      '.dhw-quick { display: flex; flex-wrap: wrap; gap: 8px; }',
      '.dhw-quickbtn { font-size: 12.5px; padding: 5px 11px; border-radius: 999px; border: 1px solid rgba(128,128,128,.36); background: transparent; color: inherit; cursor: pointer; }',
      '.dhw-quickbtn:hover:not(:disabled) { border-color: rgba(76,139,245,.7); }',
      '.dhw-quickbtn:disabled { opacity: .4; cursor: default; }',
      '.dhw-help { font-size: 12px; opacity: .5; line-height: 1.5; }',
      '.dhw-foot { font-size: 12px; opacity: .48; line-height: 1.6; margin: 0; max-width: 64ch; }',
      '.dhw-error { font-size: 12.5px; color: #d9534f; }',
      '.dhw-summary { font-size: 13px; opacity: .78; font-variant-numeric: tabular-nums; }',
    ].join('\n')

    /** Unwrap a volatile ref if the host handed one through. */
    function unwrap(value) {
      if (value !== null && typeof value === 'object') {
        if (typeof value.get === 'function') return value.get()
        if (typeof value.value !== 'undefined') return value.value
      }
      return value
    }

    function capOf(value, fallback) {
      var raw = unwrap(value)
      if (raw === -1) return -1
      var parsed = typeof raw === 'number' ? raw : Number(raw)
      return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback
    }

    function valuesOf(source) {
      var bag = source !== null && typeof source === 'object' ? source : {}
      return {
        humanWaitCapMs: capOf(bag.humanWaitCapMs, DEFAULTS.humanWaitCapMs),
      }
    }

    function formatCap(ms) {
      if (ms === -1) return isZh() ? '无限' : 'unlimited'
      if (ms % HOUR === 0) {
        var hours = ms / HOUR
        return isZh() ? hours + ' 小时' : hours + (hours === 1 ? ' hour' : ' hours')
      }
      return ms + ' ms'
    }

    function HumanWaitPage(props) {
      var form = props.configForm || props.form
      var summary = props.view === 'summary'

      if (!form) {
        return h('p', { className: 'dhw-foot' }, t('loading'))
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

      function onCapInput(raw) {
        if (raw === '' || raw === '-') {
          setDraft(function (previous) {
            var merged = {}
            for (var name in previous) merged[name] = previous[name]
            merged.humanWaitCapMs = raw === '-' ? -1 : DEFAULTS.humanWaitCapMs
            return merged
          })
          return
        }
        var parsed = Number(raw)
        if (!Number.isFinite(parsed)) return
        var safe = parsed === -1 ? -1 : Math.max(1, Math.floor(parsed))
        setDraft(function (previous) {
          var merged = {}
          for (var name in previous) merged[name] = previous[name]
          merged.humanWaitCapMs = safe
          return merged
        })
        write('humanWaitCapMs', safe)
      }

      function onQuick(value) {
        setDraft(function (previous) {
          var merged = {}
          for (var name in previous) merged[name] = previous[name]
          merged.humanWaitCapMs = value
          return merged
        })
        write('humanWaitCapMs', value)
      }

      function onReset(key) {
        setDraft(function (previous) {
          var merged = {}
          for (var name in previous) merged[name] = previous[name]
          merged[key] = DEFAULTS[key]
          return merged
        })
        write(key, DEFAULTS[key])
      }

      if (summary) {
        return h('span', { className: 'dhw-summary' }, formatCap(draft.humanWaitCapMs))
      }

      var capOverridden = draft.humanWaitCapMs !== DEFAULTS.humanWaitCapMs

      var capGroup = h(
        'section',
        { className: 'dhw-group', key: 'cap' },
        h('h3', { className: 'dhw-group-title' }, isZh() ? '等待上限' : 'Wait cap'),
        h(
          'div',
          { className: 'dhw-cell' },
          h(
            'div',
            { className: 'dhw-labelrow' },
            h('label', { className: 'dhw-label', htmlFor: 'dhw-cap' }, t('capLabel')),
            capOverridden ? h('span', { className: 'dhw-chip' }, t('overridden')) : null,
            h('span', { className: 'dhw-spacer' }),
            capOverridden
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dhw-reset',
                    disabled: disabled,
                    onClick: function () {
                      onReset('humanWaitCapMs')
                    },
                  },
                  t('reset'),
                )
              : null,
          ),
          h('input', {
            id: 'dhw-cap',
            className: 'dhw-input',
            type: 'number',
            min: -1,
            step: 1,
            inputMode: 'numeric',
            disabled: disabled,
            value: String(draft.humanWaitCapMs),
            onChange: function (event) {
              onCapInput(event.target.value)
            },
          }),
          h(
            'div',
            { className: 'dhw-quick' },
            QUICK_CAPS.map(function (item) {
              return h(
                'button',
                {
                  type: 'button',
                  className: 'dhw-quickbtn',
                  key: item.value,
                  disabled: disabled,
                  onClick: function () {
                    onQuick(item.value)
                  },
                },
                isZh() ? item.zh : item.en,
              )
            }),
          ),
          h('span', { className: 'dhw-help' }, t('capHelp')),
        ),
      )

      return h(
        'div',
        { className: 'dhw' },
        h('style', null, CSS),
        ready ? null : h('p', { className: 'dhw-foot' }, t(snapshot.status === 'unavailable' ? 'unavailable' : 'loading')),
        capGroup,
        error ? h('p', { className: 'dhw-error' }, error) : null,
        h('p', { className: 'dhw-foot' }, t('note')),
      )
    }

    function apply(ctx) {
      try {
        var forms = ctx.configForms
        var form = forms ? forms.get(NS) : null
        if (!form) {
          console.error('[human-wait] configForms service is unavailable; no settings page is registered')
          return
        }
        ctx.effect(
          function () {
            return forms.whileServed([NS], function () {
              return ctx.slots.inject('plugins.bundle.config', function () {
                return ctx.slots.register(
                  {
                    name: 'plugins.bundle.config',
                    key: 'dsh-human-wait',
                    inject: function () {
                      return { configForm: form }
                    },
                  },
                  HumanWaitPage,
                )
              })
            })
          },
          'human-wait: bundle config',
        )
      } catch (error) {
        console.error('[human-wait] client half failed to mount: ' + String((error && error.message) || error))
      }
    }

    exports.name = 'dsh-human-wait'
    exports.inject = ['slots', 'configForms']
    exports.apply = apply

    return module.exports
  },
})
