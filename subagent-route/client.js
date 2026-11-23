window.__ModuleLoader__.load({
  id: 'dsh-subagent-route',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var React = require('react')
    var h = React.createElement

    var NS = 'subagent-route'

    function isZh() {
      try {
        return (navigator.language || '').toLowerCase().indexOf('zh') === 0
      } catch (error) {
        return false
      }
    }

    var COPY = {
      title: ['允许的渠道', 'Allowed channels'],
      help: [
        '派子代理时，只能挑这里勾上的渠道和模型。',
        'A subagent may only be sent to the channels and models checked here.',
      ],
      hintAll: [
        '一条都不勾就是不限制：这个 DSH 里能用的渠道都能派出去。',
        'Nothing checked means no restriction: any channel this DSH can reach is allowed.',
      ],
      hintSome: [
        '只放行勾上的这几条，其余的会被拒绝。',
        'Only the checked routes are allowed; anything else is refused.',
      ],
      loadingList: ['正在读取模型列表…', 'Reading the model list…'],
      loadFailed: ['读不到模型列表：', 'Could not read the model list: '],
      listFailed: ['这个请求没有成功', 'the request did not succeed'],
      retry: ['重试', 'Retry'],
      partial: [
        '有渠道没交出模型列表，这份清单可能不全。',
        'Some channels did not return a model list, so this list may be incomplete.',
      ],
      emptyList: ['这个 DSH 现在没有可用的模型。', 'This DSH offers no models right now.'],
      goneGroup: ['这些已经不在清单里了', 'No longer offered'],
      goneTag: ['已经不在清单里', 'Not offered now'],
      conflict: [
        '设置刚在别处被改过。点「放弃更改」重新选一次再保存。',
        'The settings changed elsewhere. Discard your changes and choose again.',
      ],
      loadingForm: ['正在读取设置…', 'Reading settings…'],
      unavailableForm: [
        '当前连接不能改设置，这一页只能看。',
        'This connection cannot change settings, so this page is read-only.',
      ],
      saveFailed: ['保存失败：', 'Save failed: '],
      save: ['保存', 'Save'],
      saving: ['保存中…', 'Saving…'],
      discard: ['放弃更改', 'Discard'],
      saved: ['已保存', 'Saved'],
      summaryAll: ['不限制', 'No restriction'],
      summarySome: ['只放行 ', 'Only '],
      summaryUnit: [' 条', ' route(s)'],
      note: [
        '勾选会存进 DSH。卸载这个插件不会自动清掉它们。',
        'The choices are stored in DSH. Uninstalling the plugin does not clear them.',
      ],
    }

    function t(key) {
      var pair = COPY[key]
      if (pair === undefined) return key
      return isZh() ? pair[0] : pair[1]
    }

    var CSS = [
      '.dsr { display: flex; flex-direction: column; gap: 22px; max-width: 820px; padding: 4px 2px 8px; }',
      '.dsr-group { display: flex; flex-direction: column; gap: 12px; }',
      '.dsr-title { font-size: 14.5px; font-weight: 600; margin: 0; line-height: 1.4; }',
      '.dsr-help { font-size: 12px; opacity: .5; line-height: 1.5; }',
      '.dsr-hint { font-size: 12px; opacity: .72; line-height: 1.5; }',
      '.dsr-list { display: flex; flex-direction: column; gap: 10px; max-height: 340px; padding: 10px; overflow: auto; border: 1px solid rgba(128,128,128,.28); border-radius: 10px; }',
      '.dsr-pgroup { display: flex; flex-direction: column; gap: 2px; }',
      '.dsr-pgroup + .dsr-pgroup { margin-top: 8px; padding-top: 10px; border-top: 1px solid rgba(128,128,128,.18); }',
      '.dsr-pname { padding: 0 6px; font-size: 11.5px; font-weight: 500; opacity: .55; }',
      '.dsr-model { display: flex; align-items: center; gap: 9px; padding: 5px 6px; border-radius: 8px; cursor: pointer; }',
      '.dsr-model:hover { background: rgba(128,128,128,.1); }',
      '.dsr-modeltext { display: flex; flex-direction: column; gap: 1px; min-width: 0; }',
      '.dsr-modelname { font-size: 13px; line-height: 1.35; }',
      '.dsr-route { font-size: 11px; opacity: .45; }',
      '.dsr-gone { margin-left: auto; font-size: 11px; opacity: .5; }',
      '.dsr-empty { font-size: 13px; opacity: .6; }',
      '.dsr-errorrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }',
      '.dsr-error { font-size: 12.5px; color: #d9534f; }',
      '.dsr-notice { font-size: 12.5px; opacity: .7; }',
      '.dsr-summary { font-size: 13px; opacity: .78; }',
      '.dsr-foot { font-size: 12px; opacity: .48; line-height: 1.6; margin: 0; max-width: 64ch; }',
      '.dsr-actions { display: flex; align-items: center; gap: 10px; }',
      '.dsr-save { font-size: 12.5px; padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(76,139,245,.85); background: rgba(76,139,245,.16); color: inherit; cursor: pointer; }',
      '.dsr-save:hover:not(:disabled) { background: rgba(76,139,245,.26); }',
      '.dsr-save:disabled { opacity: .4; cursor: default; }',
      '.dsr-cancel { font-size: 12.5px; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(128,128,128,.36); background: transparent; color: inherit; cursor: pointer; }',
      '.dsr-cancel:disabled { opacity: .4; cursor: default; }',
      '.dsr-retry { font-size: 12px; padding: 3px 10px; border-radius: 7px; border: 1px solid rgba(128,128,128,.36); background: transparent; color: inherit; cursor: pointer; }',
      '.dsr-retry:disabled { opacity: .4; cursor: default; }',
    ].join('\n')

    /** Unwrap a volatile ref if the host handed one through. */
    function unwrap(value) {
      if (value !== null && typeof value === 'object') {
        if (typeof value.get === 'function') return value.get()
        if (typeof value.value !== 'undefined') return value.value
      }
      return value
    }

    function routeOf(entry) {
      if (entry === null || typeof entry !== 'object') return null
      var provider = typeof entry.provider === 'string' ? entry.provider.trim() : ''
      var model = typeof entry.model === 'string' ? entry.model.trim() : ''
      if (provider === '' || model === '') return null
      return { provider: provider, model: model }
    }

    function keyOf(route) {
      return route.provider + '\u0000' + route.model
    }

    /** The stored allow-list, with half-filled entries dropped. */
    function routesOf(value) {
      var bag = value !== null && typeof value === 'object' ? value : {}
      var raw = unwrap(bag.allowedModels)
      var out = []
      if (Array.isArray(raw)) {
        raw.forEach(function (entry) {
          var route = routeOf(entry)
          if (route !== null) out.push(route)
        })
      }
      return out
    }

    function sameRoutes(left, right) {
      if (left.length !== right.length) return false
      var keys = {}
      left.forEach(function (route) {
        keys[keyOf(route)] = true
      })
      return right.every(function (route) {
        return keys[keyOf(route)] === true
      })
    }

    function messageOf(error) {
      if (error instanceof Error) return error.message
      if (typeof error === 'string') return error
      try {
        return String(error)
      } catch (caught) {
        return t('listFailed')
      }
    }

    /** A failed remote answer, said the shortest way that still helps. */
    function failureText(response) {
      if (response !== null && typeof response === 'object') {
        var failure = response.error
        if (failure !== null && typeof failure === 'object') {
          if (typeof failure.message === 'string' && failure.message !== '') return failure.message
          if (typeof failure.code === 'string' && failure.code !== '') return failure.code
        }
      }
      return t('listFailed')
    }

    /**
     * Join the live model list with what is already checked: a route that is
     * stored but no longer offered still has to be visible, or it could never
     * be unchecked again.
     */
    function rowsOf(groups, draft, saved) {
      var picked = {}
      draft.forEach(function (route) {
        picked[keyOf(route)] = true
      })

      var offered = {}
      var byProvider = []

      ;(Array.isArray(groups) ? groups : []).forEach(function (group) {
        if (group === null || typeof group !== 'object') return
        var provider = typeof group.id === 'string' ? group.id : ''
        if (provider === '') return
        var row = {
          provider: provider,
          name: typeof group.name === 'string' && group.name !== '' ? group.name : provider,
          models: [],
        }
        ;(Array.isArray(group.models) ? group.models : []).forEach(function (model) {
          if (model === null || typeof model !== 'object') return
          var id = typeof model.id === 'string' ? model.id : ''
          if (id === '') return
          var key = keyOf({ provider: provider, model: id })
          offered[key] = true
          row.models.push({
            key: key,
            provider: provider,
            model: id,
            name: typeof model.name === 'string' && model.name !== '' ? model.name : id,
            available: true,
            selected: picked[key] === true,
          })
        })
        byProvider.push(row)
      })

      var gone = []
      var seen = {}
      saved.concat(draft).forEach(function (route) {
        var key = keyOf(route)
        if (offered[key] === true || seen[key] === true) return
        seen[key] = true
        gone.push({
          key: key,
          provider: route.provider,
          model: route.model,
          name: route.model,
          available: false,
          selected: picked[key] === true,
        })
      })

      return { groups: byProvider, gone: gone }
    }

    function SubagentRoutePage(props) {
      var form = props.configForm || props.form || null
      var remote = props.remote || null
      var summary = props.view === 'summary'

      var snapshotPair = React.useState(function () {
        return form === null
          ? { status: 'loading', value: undefined, revision: undefined, writable: false }
          : form.getSnapshot()
      })
      var snapshot = snapshotPair[0]
      var setSnapshot = snapshotPair[1]

      var draftPair = React.useState(function () {
        return routesOf(snapshot.value)
      })
      var draft = draftPair[0]
      var setDraft = draftPair[1]

      var catalogPair = React.useState(function () {
        return { status: 'idle', groups: [], partial: false, message: '' }
      })
      var catalog = catalogPair[0]
      var setCatalog = catalogPair[1]

      var errorPair = React.useState('')
      var error = errorPair[0]
      var setError = errorPair[1]

      var savingPair = React.useState(false)
      var saving = savingPair[0]
      var setSaving = savingPair[1]

      var noticePair = React.useState('')
      var notice = noticePair[0]
      var setNotice = noticePair[1]

      var refPair = React.useState(function () {
        return { asked: false }
      })
      var refs = refPair[0]

      var savedRoutes = routesOf(snapshot.value)
      var dirty = !sameRoutes(draft, savedRoutes)
      var dirtyRef = { current: dirty }

      function loadCatalog() {
        var api = remote !== null && remote.session ? remote.session.modelCatalog : undefined
        if (typeof api !== 'function') {
          setCatalog({ status: 'error', groups: [], partial: false, message: t('listFailed') })
          return
        }
        setCatalog({ status: 'loading', groups: [], partial: false, message: '' })
        var pending
        try {
          pending = api()
        } catch (caught) {
          setCatalog({ status: 'error', groups: [], partial: false, message: messageOf(caught) })
          return
        }
        Promise.resolve(pending).then(
          function (response) {
            if (response !== null && typeof response === 'object' && response.ok === true && response.value) {
              var groups = Array.isArray(response.value.groups) ? response.value.groups : []
              var failures = Array.isArray(response.value.failures) ? response.value.failures : []
              setCatalog({ status: 'ready', groups: groups, partial: failures.length > 0, message: '' })
            } else {
              setCatalog({ status: 'error', groups: [], partial: false, message: failureText(response) })
            }
          },
          function (caught) {
            setCatalog({ status: 'error', groups: [], partial: false, message: messageOf(caught) })
          },
        )
      }

      React.useEffect(function () {
        if (form === null) return undefined
        var off = form.subscribe(function () {
          setSnapshot(form.getSnapshot())
        })
        setSnapshot(form.getSnapshot())
        return off
      }, [form])

      React.useEffect(function () {
        // Adopt values written elsewhere only while nobody has an unsaved edit.
        if (form === null || dirtyRef.current) return
        setDraft(routesOf(snapshot.value))
      }, [snapshot.value])

      React.useEffect(function () {
        if (summary || refs.asked) return
        refs.asked = true
        loadCatalog()
      }, [remote])

      if (form === null) {
        return h('p', { className: 'dsr-foot' }, t('loadingForm'))
      }

      if (summary) {
        var word = savedRoutes.length === 0 ? t('summaryAll') : t('summarySome') + String(savedRoutes.length) + t('summaryUnit')
        return h('span', { className: 'dsr-summary' }, word)
      }

      var ready = snapshot.status === 'ready'
      var disabled = !ready || saving

      function onToggle(candidate) {
        setError('')
        setNotice('')
        if (candidate.selected) {
          setDraft(draft.filter(function (route) {
            return keyOf(route) !== candidate.key
          }))
        } else {
          setDraft(draft.concat([{ provider: candidate.provider, model: candidate.model }]))
        }
      }

      function onDiscard() {
        setError('')
        setNotice('')
        setDraft(routesOf(snapshot.value))
      }

      function onSave() {
        if (!dirty || saving) return
        setError('')
        setNotice('')
        setSaving(true)
        var next = draft.map(function (route) {
          return { provider: route.provider, model: route.model }
        })
        var write = typeof form.mutate === 'function'
          ? function () { return form.mutate([{ op: 'set', path: ['allowedModels'], value: next }], snapshot.revision) }
          : function () { return form.set('allowedModels', next) }
        Promise.resolve()
          .then(write)
          .then(
            function (applied) {
              setSaving(false)
              if (applied === false) {
                setError(t('conflict'))
                return
              }
              setNotice(t('saved'))
            },
            function (caught) {
              setSaving(false)
              setError(t('saveFailed') + messageOf(caught))
            },
          )
      }

      var rows = rowsOf(catalog.groups, draft, savedRoutes)
      var shown = rows.groups.filter(function (group) {
        return group.models.length > 0
      })

      function modelRow(candidate) {
        return h(
          'label',
          { className: 'dsr-model', key: candidate.key },
          h('input', {
            type: 'checkbox',
            checked: candidate.selected,
            disabled: disabled,
            onChange: function () {
              onToggle(candidate)
            },
          }),
          h(
            'span',
            { className: 'dsr-modeltext' },
            h('span', { className: 'dsr-modelname' }, candidate.name),
            h('span', { className: 'dsr-route' }, candidate.provider + ' / ' + candidate.model),
          ),
          candidate.available ? null : h('span', { className: 'dsr-gone' }, t('goneTag')),
        )
      }

      var listNode
      if (catalog.status === 'error') {
        listNode = h(
          'div',
          { className: 'dsr-errorrow' },
          h('span', { className: 'dsr-error' }, t('loadFailed') + catalog.message),
          h(
            'button',
            {
              type: 'button',
              className: 'dsr-retry',
              disabled: saving,
              onClick: function () {
                loadCatalog()
              },
            },
            t('retry'),
          ),
        )
      } else if (shown.length === 0 && rows.gone.length === 0) {
        listNode = h('span', { className: 'dsr-empty' }, catalog.status === 'ready' ? t('emptyList') : t('loadingList'))
      } else {
        var blocks = shown.map(function (group) {
          return h(
            'div',
            { className: 'dsr-pgroup', key: group.provider },
            h('span', { className: 'dsr-pname' }, group.name),
            group.models.map(modelRow),
          )
        })
        if (rows.gone.length > 0) {
          blocks.push(
            h(
              'div',
              { className: 'dsr-pgroup', key: '__gone__' },
              h('span', { className: 'dsr-pname' }, t('goneGroup')),
              rows.gone.map(modelRow),
            ),
          )
        }
        listNode = h('div', { className: 'dsr-list' }, blocks)
      }

      return h(
        'div',
        { className: 'dsr' },
        h('style', null, CSS),
        ready ? null : h('p', { className: 'dsr-foot' }, t(snapshot.status === 'unavailable' ? 'unavailableForm' : 'loadingForm')),
        h(
          'section',
          { className: 'dsr-group' },
          h('h3', { className: 'dsr-title' }, t('title')),
          h('span', { className: 'dsr-help' }, t('help')),
          listNode,
          catalog.partial ? h('span', { className: 'dsr-notice' }, t('partial')) : null,
          h('span', { className: 'dsr-hint' }, draft.length === 0 ? t('hintAll') : t('hintSome')),
        ),
        dirty || saving
          ? h(
              'div',
              { className: 'dsr-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsr-save',
                  disabled: disabled,
                  onClick: onSave,
                },
                saving ? t('saving') : t('save'),
              ),
              h(
                'button',
                { type: 'button', className: 'dsr-cancel', disabled: saving, onClick: onDiscard },
                t('discard'),
              ),
            )
          : null,
        notice ? h('span', { className: 'dsr-notice' }, notice) : null,
        error ? h('p', { className: 'dsr-error' }, error) : null,
        h('p', { className: 'dsr-foot' }, t('note')),
      )
    }

    function apply(ctx) {
      try {
        var forms = ctx.configForms
        var form = forms ? forms.get(NS) : null
        if (!form) {
          console.error('[subagent-route] configForms service is unavailable; no settings page is registered')
          return
        }
        var remote = ctx.remote
        ctx.effect(
          function () {
            return forms.whileServed([NS], function () {
              return ctx.slots.inject('plugins.bundle.config', function () {
                return ctx.slots.register(
                  {
                    name: 'plugins.bundle.config',
                    key: 'dsh-subagent-route',
                    inject: function () {
                      return { configForm: form, remote: remote }
                    },
                  },
                  SubagentRoutePage,
                )
              })
            })
          },
          'subagent-route: bundle config',
        )
      } catch (error) {
        console.error('[subagent-route] client half failed to mount: ' + messageOf(error))
      }
    }

    exports.name = 'dsh-subagent-route'
    exports.inject = ['slots', 'configForms', 'remote', 'remote.session']
    exports.apply = apply

    return module.exports
  },
})
