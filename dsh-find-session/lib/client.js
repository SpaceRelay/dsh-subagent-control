/* dsh-find-session — browser half.
 *
 * Hand-written, no build step. The whole client lives in this one file inside
 * the Harness module-loader envelope; React comes from the loader and the rest
 * is plain DOM, CSS and the Client services reached through `ctx`.
 *
 * State model: one module-level runtime object created in `apply`, because the
 * slot bodies are plain components that need the same store, translator and
 * actions. A plugin bundle is a page singleton, so a module-level handle is the
 * simplest correct home for it.
 */
window.__ModuleLoader__.load({
  id: "dsh-find-session",
  factory: (require) => {
    var module = { exports: {} };

    var React = require("react");
    var h = React.createElement;
    var useSyncExternalStore = React.useSyncExternalStore;

    var name = "dsh-find-session";
    var inject = ["slots", "locale", "sessions", "connection"];

    var NS = "sessionFind";
    var PANEL_ID = "dsh-find-session";
    var TAB_ID = "dsh-find-session";
    var TAB_KIND = "dsh-find-session";
    var CHANNEL = "/dsh-find-session";
    var STORAGE_KEY = "dsh.session-find.prefs.v1";
    var HIGHLIGHT_ALL = "dsf-match";
    var HIGHLIGHT_CURRENT = "dsf-current";
    var FLASH_CLASS = "dsf-flash";
    var DEBOUNCE_MS = 200;

    var messages = {
      zh: {
        "panel": "查找",
        "tab.title": "查找结果",
        "placeholder": "查找关键词…",
        "global.placeholder": "在所有会话里查找…",
        "scope.session": "本会话",
        "scope.global": "全局",
        "action.prev": "上一条",
        "action.next": "下一条",
        "action.close": "关闭",
        "action.options": "选项",
        "action.open": "打开",
        "action.preview": "预览",
        "action.retry": "重试",
        "action.dock": "停靠到右侧栏",
        "action.toggle": "查找",
        "count.empty": "无结果",
        "count.position": "{i}/{n}",
        "match.substring": "包含",
        "match.exact": "整词",
        "match.regex": "正则",
        "case.sensitive": "区分大小写",
        "scope.body": "正文",
        "scope.tools": "工具调用",
        "scope.thinking": "思考过程",
        "filter.range": "范围",
        "filter.range.current": "当前工作区",
        "filter.range.all": "所有工作区",
        "filter.time": "时间",
        "filter.time.any": "不限",
        "filter.time.today": "今天",
        "filter.time.7": "近 7 天",
        "filter.time.30": "近 30 天",
        "filter.archived": "含已归档",
        "filter.subagents": "含子会话",
        "state.searching": "正在搜索…",
        "state.idle": "输入关键词开始查找",
        "state.failed": "搜索失败",
        "state.more": "还有更多，请收窄条件",
        "badge.unloaded": "需展开",
        "badge.tool": "工具",
        "badge.thinking": "思考",
        "preview.context": "上下文",
        "empty.session": "这个会话里没有命中",
        "empty.global": "没有命中",
        "settings.title": "查找",
        "settings.description": "会话内查找与全局查找的默认行为。",
        "settings.match": "默认匹配方式",
        "settings.scope": "默认搜索内容",
        "settings.limit": "单次结果上限",
        "settings.hint": "快捷键在 设置 → 快捷键 里改。",
        "shortcut.open": "会话内查找",
        "shortcut.global": "全局查找",
        "shortcut.next": "下一个匹配",
        "shortcut.prev": "上一个匹配",
        "error.bad-regex": "正则表达式不合法",
        "error.empty-query": "请输入关键词",
        "error.aborted": "已取消",
        "error.no-session": "没有选中会话",
        "error.search-failed": "搜索出错",
        "error.read-failed": "读取会话失败",
        "error.rpc-failed": "和主进程通信失败",
        "error.no-connection": "连接还没就绪",
        "error.bad-result": "主进程没有返回结果",
        "error.unknown-endpoint": "未知的接口"
      },
      en: {
        "panel": "Find",
        "tab.title": "Find results",
        "placeholder": "Find in conversation…",
        "global.placeholder": "Find across every session…",
        "scope.session": "This session",
        "scope.global": "All sessions",
        "action.prev": "Previous",
        "action.next": "Next",
        "action.close": "Close",
        "action.options": "Options",
        "action.open": "Open",
        "action.preview": "Preview",
        "action.retry": "Retry",
        "action.dock": "Dock to sidebar",
        "action.toggle": "Find",
        "count.empty": "No results",
        "count.position": "{i}/{n}",
        "match.substring": "Contains",
        "match.exact": "Whole word",
        "match.regex": "Regex",
        "case.sensitive": "Match case",
        "scope.body": "Body",
        "scope.tools": "Tool calls",
        "scope.thinking": "Reasoning",
        "filter.range": "Scope",
        "filter.range.current": "This workspace",
        "filter.range.all": "All workspaces",
        "filter.time": "Time",
        "filter.time.any": "Any",
        "filter.time.today": "Today",
        "filter.time.7": "Last 7 days",
        "filter.time.30": "Last 30 days",
        "filter.archived": "Archived",
        "filter.subagents": "Subagents",
        "state.searching": "Searching…",
        "state.idle": "Type a keyword to start",
        "state.failed": "Search failed",
        "state.more": "More results — narrow the query",
        "badge.unloaded": "Needs expand",
        "badge.tool": "Tool",
        "badge.thinking": "Thinking",
        "preview.context": "Context",
        "empty.session": "Nothing matched in this session",
        "empty.global": "Nothing matched",
        "settings.title": "Find",
        "settings.description": "Defaults for in-session and global find.",
        "settings.match": "Default match mode",
        "settings.scope": "Default content scope",
        "settings.limit": "Result limit",
        "settings.hint": "Change the shortcuts in Settings → Shortcuts.",
        "shortcut.open": "Find in conversation",
        "shortcut.global": "Find everywhere",
        "shortcut.next": "Next match",
        "shortcut.prev": "Previous match",
        "error.bad-regex": "Invalid regular expression",
        "error.empty-query": "Type something first",
        "error.aborted": "Cancelled",
        "error.no-session": "No session selected",
        "error.search-failed": "The search failed",
        "error.read-failed": "Could not read the session",
        "error.rpc-failed": "Lost the connection to the Host",
        "error.no-connection": "The connection is not ready yet",
        "error.bad-result": "The Host returned nothing",
        "error.unknown-endpoint": "Unknown endpoint"
      }
    };

    var DEFAULT_PREFS = {
      match: "substring",
      caseSensitive: false,
      scope: { body: true, tools: false, thinking: false },
      limit: 500
    };

    // ---------------------------------------------------------------- utils --

    function clampLimit(value) {
      var number = Number(value);
      if (!Number.isFinite(number)) return DEFAULT_PREFS.limit;
      return Math.max(50, Math.min(2000, Math.floor(number)));
    }

    function readPrefs() {
      var prefs = {
        match: DEFAULT_PREFS.match,
        caseSensitive: DEFAULT_PREFS.caseSensitive,
        scope: { body: true, tools: false, thinking: false },
        limit: DEFAULT_PREFS.limit
      };
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (typeof raw === "string" && raw.length > 0) {
          var parsed = JSON.parse(raw);
          if (parsed !== null && typeof parsed === "object") {
            if (parsed.match === "substring" || parsed.match === "exact" || parsed.match === "regex") prefs.match = parsed.match;
            if (typeof parsed.caseSensitive === "boolean") prefs.caseSensitive = parsed.caseSensitive;
            if (parsed.scope !== null && typeof parsed.scope === "object") {
              prefs.scope = {
                body: parsed.scope.body !== false,
                tools: parsed.scope.tools === true,
                thinking: parsed.scope.thinking === true
              };
            }
            prefs.limit = clampLimit(parsed.limit);
          }
        }
      } catch (error) {
        /* a corrupt entry must never break the plugin */
      }
      return prefs;
    }

    function writePrefs(prefs) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      } catch (error) {
        /* private mode or quota — the in-memory value still applies */
      }
    }

    function sleep(ms) {
      return new Promise(function (resolve) {
        setTimeout(resolve, ms);
      });
    }

    /**
     * Same matching semantics as the Host matcher. Only the DOM path uses it —
     * the authoritative hit list always comes from the Host.
     */
    function compileTextMatcher(query, options) {
      var mode = options && options.match === "regex" ? "regex" : options && options.match === "exact" ? "exact" : "substring";
      var caseSensitive = options !== undefined && options !== null && options.caseSensitive === true;
      var noop = { find: function () { return [] } };
      if (typeof query !== "string" || query.length === 0) {
        noop.error = "empty-query";
        return noop;
      }
      if (mode === "regex") {
        var pattern;
        try {
          pattern = new RegExp(query, caseSensitive ? "g" : "gi");
        } catch (error) {
          noop.error = "bad-regex";
          return noop;
        }
        return {
          find: function (text) {
            if (typeof text !== "string" || text.length === 0) return [];
            var hits = [];
            pattern.lastIndex = 0;
            for (var guard = 0; guard <= text.length + 1; guard += 1) {
              var found = pattern.exec(text);
              if (found === null) break;
              var start = found.index;
              var end = start + found[0].length;
              if (end > start) hits.push([start, end]);
              pattern.lastIndex = end > start ? end : start + 1;
              if (pattern.lastIndex > text.length) break;
            }
            return hits;
          }
        };
      }
      var word = /[A-Za-z0-9_]/;
      var needle = caseSensitive ? query : query.toLowerCase();
      return {
        find: function (text) {
          if (typeof text !== "string" || text.length === 0) return [];
          var haystack = caseSensitive ? text : text.toLowerCase();
          var hits = [];
          var from = 0;
          for (;;) {
            var at = haystack.indexOf(needle, from);
            if (at < 0) break;
            var end = at + needle.length;
            var boundary = !word.test(haystack.charAt(at - 1)) && !word.test(haystack.charAt(end));
            if (mode !== "exact" || boundary) hits.push([at, end]);
            from = at + Math.max(1, needle.length);
            if (from > haystack.length) break;
          }
          return hits;
        }
      };
    }

    function createStore(initial) {
      var listeners = new Set();
      var state = initial;
      return {
        get: function () {
          return state;
        },
        set: function (patch) {
          var next = typeof patch === "function" ? patch(state) : patch;
          state = Object.assign({}, state, next);
          listeners.forEach(function (listener) {
            try {
              listener();
            } catch (error) {
              /* one bad subscriber must not stop the rest */
            }
          });
        },
        subscribe: function (listener) {
          listeners.add(listener);
          return function () {
            listeners.delete(listener);
          };
        }
      };
    }

    // ------------------------------------------------------------ highlight --

    function supportsHighlight() {
      return typeof CSS !== "undefined" && CSS !== null && CSS.highlights !== undefined && typeof Highlight === "function";
    }

    function clearHighlights() {
      if (!supportsHighlight()) return;
      try {
        CSS.highlights.delete(HIGHLIGHT_ALL);
        CSS.highlights.delete(HIGHLIGHT_CURRENT);
      } catch (error) {
        /* ignore */
      }
    }

    function textNodesUnder(root) {
      var out = [];
      if (root === null || root === undefined) return out;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          if (node.parentElement === null) return NodeFilter.FILTER_REJECT;
          var tag = node.parentElement.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") return NodeFilter.FILTER_REJECT;
          return node.nodeValue && node.nodeValue.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      var current = walker.nextNode();
      while (current !== null) {
        out.push(current);
        current = walker.nextNode();
      }
      return out;
    }

    function rangesIn(root, matcher) {
      var ranges = [];
      if (root === null || root === undefined || root.nodeType !== 1) return ranges;
      var nodes = textNodesUnder(root);
      for (var index = 0; index < nodes.length; index += 1) {
        var node = nodes[index];
        var hits = matcher.find(node.nodeValue || "");
        for (var hit = 0; hit < hits.length; hit += 1) {
          try {
            var range = document.createRange();
            range.setStart(node, hits[hit][0]);
            range.setEnd(node, hits[hit][1]);
            ranges.push(range);
          } catch (error) {
            /* the node detached between the walk and setStart */
          }
        }
      }
      return ranges;
    }

    /** The scrollable transcript element, if the Chat view is on screen. */
    function transcriptRoot() {
      var anchor = document.querySelector("[data-chat-paging-anchor]");
      if (anchor !== null) {
        var scroller = anchor.closest("[data-chat-flow-key]");
        if (scroller !== null) return scroller.parentElement || scroller;
      }
      var flow = document.querySelector("[data-chat-flow-key]");
      if (flow !== null) return flow.parentElement || flow;
      return null;
    }

    function paintAll(matcher) {
      if (!supportsHighlight()) return;
      var root = transcriptRoot();
      if (root === null) return;
      try {
        CSS.highlights.delete(HIGHLIGHT_ALL);
      } catch (error) {
        /* ignore */
      }
      var ranges = rangesIn(root, matcher);
      if (ranges.length === 0) return;
      try {
        CSS.highlights.set(HIGHLIGHT_ALL, new Highlight(...ranges));
      } catch (error) {
        /* too many ranges for one Highlight — the row flash still lands */
      }
    }

    function flashRow(row) {
      row.classList.remove(FLASH_CLASS);
      // Force a reflow so re-adding the class restarts the animation.
      void row.offsetWidth;
      row.classList.add(FLASH_CLASS);
      setTimeout(function () {
        row.classList.remove(FLASH_CLASS);
      }, 1500);
    }

    function paintCurrent(row, matcher) {
      if (row === null || row === undefined) return;
      try {
        row.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch (error) {
        row.scrollIntoView();
      }
      flashRow(row);
      if (!supportsHighlight()) return;
      var ranges = rangesIn(row, matcher);
      if (ranges.length === 0) return;
      try {
        CSS.highlights.set(HIGHLIGHT_CURRENT, new Highlight(ranges[0]));
      } catch (error) {
        /* ignore */
      }
    }

    // ---------------------------------------------------------------- style --

    var STYLE_TEXT = [
      // The bar lives in `shell.overlay`, whose layer is `pointer-events:none`
      // with `> *` opting back in. This seat therefore re-disables pointer
      // events for itself so the empty area around the bar stays click-through,
      // and re-enables them on the bar only. It is positioned just below the
      // conversation header (min-height 76px) so it never covers the Session
      // title or its actions.
      ".dsf-bar-seat{position:absolute;top:84px;left:50%;transform:translateX(-50%);display:flex;justify-content:center;width:min(720px,calc(100% - 32px));pointer-events:none;z-index:1}",
      // Higher specificity than the layer's own `> *{pointer-events:auto}`.
      "div.dsf-bar-seat{pointer-events:none}",
      ".dsf-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 10px;margin:0;width:100%;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:12px;color:var(--dsw-alias-label-primary);box-sizing:border-box;pointer-events:auto}",
      ".dsf-input{flex:1 1 160px;min-width:100px;padding:5px 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:inherit;font-size:12px;outline:none;font-family:inherit}",
      ".dsf-input:focus{border-color:var(--dsw-alias-brand-primary)}",
      ".dsf-input[data-invalid=true]{border-color:var(--dsw-alias-state-error-primary)}",
      ".dsf-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:24px;min-width:24px;padding:0 7px;border-radius:6px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;line-height:1;font-family:inherit}",
      ".dsf-btn:hover:not([disabled]){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}",
      ".dsf-btn[disabled]{opacity:.45;cursor:default}",
      ".dsf-btn[data-active=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}",
      ".dsf-count{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);white-space:nowrap}",
      ".dsf-sep{width:1px;height:16px;background:var(--dsw-alias-border-l1)}",
      ".dsf-select{height:24px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:inherit;font-size:12px;padding:0 4px;font-family:inherit}",
      ".dsf-options{display:flex;flex-wrap:wrap;gap:10px;width:100%;padding-top:6px;border-top:1px dashed var(--dsw-alias-border-l1);margin-top:2px}",
      ".dsf-check{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;font-size:12px}",
      ".dsf-panel{display:flex;flex-direction:column;height:100%;min-height:0;font-size:12px;color:var(--dsw-alias-label-primary)}",
      ".dsf-panel-head{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
      ".dsf-filters{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}",
      ".dsf-list{flex:1 1 auto;overflow:auto;min-height:0}",
      ".dsf-row{display:flex;flex-direction:column;gap:3px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);cursor:pointer}",
      ".dsf-row:hover{background:var(--dsw-alias-bg-layer-2)}",
      ".dsf-row[data-active=true]{background:var(--dsw-alias-bg-layer-2);box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}",
      ".dsf-row-top{display:flex;gap:6px;align-items:center;color:var(--dsw-alias-label-secondary);font-size:11px}",
      ".dsf-where{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:62%}",
      ".dsf-when{margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums}",
      ".dsf-snippet{line-height:1.5;word-break:break-word;color:var(--dsw-alias-label-primary);font-size:12px}",
      ".dsf-snippet em{font-style:normal;background:rgba(255,196,0,.35);border-radius:3px;padding:0 1px}",
      ".dsf-badge{font-size:10px;padding:0 5px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap;line-height:16px}",
      ".dsf-badge[data-tone=warn]{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}",
      ".dsf-preview{margin:4px 0 2px;padding:6px 8px;border-left:2px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:6px;display:flex;flex-direction:column;gap:4px}",
      ".dsf-preview-line{color:var(--dsw-alias-label-secondary);line-height:1.45;max-height:4.5em;overflow:hidden;white-space:pre-wrap}",
      ".dsf-preview-line[data-target=true]{color:var(--dsw-alias-label-primary)}",
      ".dsf-preview-actions{display:flex;gap:6px;align-items:center}",
      ".dsf-message{padding:14px;color:var(--dsw-alias-label-secondary);text-align:center}",
      ".dsf-error{margin:8px 10px;padding:6px 8px;border-radius:6px;background:rgba(255,77,79,.12);color:var(--dsw-alias-state-error-primary);display:flex;gap:8px;align-items:center}",
      ".dsf-page{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base)}",
      ".dsf-page-head{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
      ".dsf-page-title{font-size:13px;font-weight:600}",
      ".dsf-page-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}",
      ".dsf-page-search{padding:10px 12px 0;display:flex;gap:6px;align-items:center}",
      ".dsf-settings{padding:4px 0;display:flex;flex-direction:column;gap:12px;max-width:640px}",
      ".dsf-settings-row{display:flex;align-items:center;gap:12px;justify-content:space-between}",
      ".dsf-settings-label{color:var(--dsw-alias-label-primary);font-size:13px}",
      ".dsf-settings-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}",
      ".dsf-flash{animation:dsf-flash 1.4s ease-out}",
      "@keyframes dsf-flash{0%{background-color:rgba(255,196,0,.34)}70%{background-color:rgba(255,196,0,.18)}100%{background-color:transparent}}",
      "::highlight(dsf-match){background-color:rgba(255,196,0,.34);color:inherit}",
      "::highlight(dsf-current){background-color:rgba(255,163,0,.7);color:inherit}"
    ].join("\n");

    // -------------------------------------------------------------- runtime --

    /** @type {any} */
    var rt = null;

    function useStore() {
      return useSyncExternalStore(rt.store.subscribe, rt.store.get, rt.store.get);
    }

    function tr(key) {
      var text = rt.t(key);
      return typeof text === "string" ? text : key;
    }

    function createRuntime(ctx) {
      var prefs = readPrefs();
      var t = ctx.locale.bind(NS);

      var store = createStore({
        open: false,
        target: "session",
        query: "",
        items: [],
        total: 0,
        hasMore: false,
        loading: false,
        error: null,
        activeIndex: -1,
        match: prefs.match,
        caseSensitive: prefs.caseSensitive,
        scope: { body: prefs.scope.body !== false, tools: prefs.scope.tools === true, thinking: prefs.scope.thinking === true },
        filters: { range: "current", time: "any", includeArchived: false, includeSubagents: true },
        previewIndex: -1,
        preview: null,
        previewLoading: false,
        unloadedKey: null,
        lastSessionId: undefined,
        searching: false
      });

      var connection = ctx.get("connection");
      var sessions = ctx.get("sessions");
      var shortcuts = ctx.get("shortcuts");
      var sidebarRight = ctx.get("sidebarRight");
      var sidebarRightTabs = ctx.get("sidebarRightTabs");
      var layout = ctx.get("layout");
      var uiWorkspace = ctx.get("uiWorkspace");
      var workspaces = ctx.get("workspaces");

      var searchToken = 0;
      var controller = null;
      var debounceTimer = null;
      var tabRegistered = false;
      var tabDisposers = [];

      function rememberSession(sessionId) {
        if (typeof sessionId !== "string" || sessionId.length === 0) return;
        if (store.get().lastSessionId !== sessionId) store.set({ lastSessionId: sessionId });
      }

      /**
       * Resolve the Session the in-session search should scan.
       *
       * The find bar is mounted in `shell.overlay`, a root-scoped slot that
       * hands out no `sessionId`, so the bar normally rides on the value the
       * always-mounted header toggle remembered. That leaves one hole: on a
       * cold start (or after a reload with the bar reopened from the rail)
       * nothing has remembered a Session yet and the bar would answer
       * "no-session". The conversation root publishes its Session id as
       * `[data-conversation-session]`, so read it as the fallback.
       */
      function currentSessionId() {
        var remembered = store.get().lastSessionId;
        if (typeof remembered === "string" && remembered.length > 0) return remembered;
        try {
          var host = document.querySelector("[data-conversation-session]");
          if (host !== null && host !== undefined) {
            var value = host.getAttribute("data-conversation-session");
            if (typeof value === "string" && value.length > 0) return value;
          }
        } catch (error) {
          /* the DOM probe is best-effort */
        }
        return undefined;
      }

      function archivedSet() {
        try {
          if (workspaces === undefined || workspaces === null || workspaces.list === undefined) return undefined;
          var snapshot = workspaces.list.getSnapshot();
          if (snapshot !== null && snapshot !== undefined && Array.isArray(snapshot.archivedSessionIds)) {
            return new Set(snapshot.archivedSessionIds);
          }
        } catch (error) {
          /* no workspace face: the Host keeps archived sessions */
        }
        return undefined;
      }

      function workspaceCwds() {
        try {
          if (workspaces === undefined || workspaces === null || workspaces.list === undefined) return undefined;
          var snapshot = workspaces.list.getSnapshot();
          if (snapshot !== null && snapshot !== undefined && Array.isArray(snapshot.items)) {
            var paths = snapshot.items
              .map(function (item) {
                return item !== null && item !== undefined && typeof item.path === "string" ? item.path : undefined;
              })
              .filter(function (path) {
                return typeof path === "string";
              });
            if (paths.length > 0) return paths;
          }
        } catch (error) {
          /* fall through */
        }
        return undefined;
      }

      async function rpc(endpoint, payload, signal) {
        if (connection === undefined || connection === null || connection.rpc === undefined) {
          return { ok: false, error: { code: "no-connection", message: "the harness connection is not ready" } };
        }
        var timeout = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(30000) : undefined;
        var composed = signal !== undefined && signal !== null && timeout !== undefined && typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : signal !== undefined && signal !== null ? signal : timeout;
        var call;
        try {
          call = connection.rpc.call(CHANNEL, endpoint, payload, composed);
        } catch (error) {
          return { ok: false, error: { code: "rpc-failed", message: error instanceof Error ? error.message : String(error) } };
        }
        try {
          var result = await call;
          if (result === null || typeof result !== "object") return { ok: false, error: { code: "bad-result", message: "the host returned no result" } };
          return result;
        } catch (error) {
          if (error !== null && error !== undefined && (error.name === "AbortError" || error.name === "TimeoutError")) {
            return { ok: false, error: { code: "aborted", message: "cancelled" } };
          }
          return { ok: false, error: { code: "rpc-failed", message: error instanceof Error ? error.message : String(error) } };
        }
      }

      function timeWindow(kind) {
        var now = new Date();
        var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        if (kind === "today") return { from: startOfToday };
        if (kind === "7") return { from: startOfToday - 6 * 86400000 };
        if (kind === "30") return { from: startOfToday - 29 * 86400000 };
        return {};
      }

      function buildPayload(state) {
        var window = timeWindow(state.filters.time);
        return {
          query: state.query,
          match: state.match,
          caseSensitive: state.caseSensitive,
          target: state.target,
          sessionId: state.target === "session" ? state.lastSessionId : undefined,
          scope: state.scope,
          filters: {
            cwds: state.filters.range === "current" ? workspaceCwds() : undefined,
            from: window.from,
            to: window.to,
            includeSubagents: state.filters.includeSubagents !== false
          },
          limit: prefs.limit,
          offset: 0
        };
      }

      function applyArcivedFilter(items) {
        if (store.get().filters.includeArchived === true) return items;
        var archived = archivedSet();
        if (archived === undefined) return items;
        return items.filter(function (item) {
          return !archived.has(item.sessionId);
        });
      }

      function runSearch() {
        var state = store.get();
        if (typeof state.query !== "string" || state.query.length === 0) {
          store.set({ items: [], total: 0, hasMore: false, loading: false, error: null, activeIndex: -1, previewIndex: -1, preview: null });
          clearHighlights();
          return;
        }
        var compiled = compileTextMatcher(state.query, { match: state.match, caseSensitive: state.caseSensitive });
        if (compiled.error !== undefined) {
          store.set({ loading: false, error: compiled.error, items: [], total: 0, activeIndex: -1 });
          return;
        }
        if (state.target === "session" && (typeof state.lastSessionId !== "string" || state.lastSessionId.length === 0)) {
          // `shell.overlay` cannot hand a Session down, so fall back to the
          // conversation root's published id before declaring "no-session".
          var recovered = currentSessionId();
          if (typeof recovered === "string" && recovered.length > 0) {
            rememberSession(recovered);
            state = store.get();
          } else {
            store.set({ loading: false, error: "no-session", items: [], total: 0, activeIndex: -1 });
            return;
          }
        }

        searchToken += 1;
        var token = searchToken;
        if (controller !== null) {
          try {
            controller.abort();
          } catch (error) {
            /* ignore */
          }
        }
        controller = typeof AbortController === "function" ? new AbortController() : null;
        store.set({ loading: true, error: null });
        if (state.target === "session") paintAll(compiled);

        rpc("search", buildPayload(state), controller === null ? undefined : controller.signal).then(function (result) {
          if (token !== searchToken) return;
          if (result.ok !== true) {
            if (result.error !== undefined && result.error !== null && result.error.code === "aborted") {
              store.set({ loading: false });
              return;
            }
            store.set({
              loading: false,
              error: result.error !== undefined && result.error !== null ? result.error.code || result.error.message || "search-failed" : "search-failed",
              items: [],
              total: 0,
              activeIndex: -1
            });
            return;
          }
          var value = result.value !== null && result.value !== undefined ? result.value : {};
          var items = applyArcivedFilter(Array.isArray(value.items) ? value.items : []);
          store.set({
            items: items,
            total: typeof value.total === "number" ? value.total : items.length,
            hasMore: value.hasMore === true,
            loading: false,
            error: null,
            activeIndex: items.length > 0 ? 0 : -1,
            previewIndex: -1,
            preview: null,
            unloadedKey: null
          });
          if (store.get().target === "session" && items.length > 0) {
            var row = locateRow(items[0]);
            if (row !== null) paintCurrent(row, compiled);
          }
        });
      }

      function scheduleSearch() {
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          debounceTimer = null;
          runSearch();
        }, DEBOUNCE_MS);
      }

      // --------------------------------------------------------- jumping --

      // The transcript folds long stretches of rows behind `hidden="until-found"`
      // (the host's `useSearchableHidden`). Scrolling one of those into view only
      // fires `beforematch` when the browser does the scrolling, so a hidden row
      // is a fallback, never a first choice: prefer a row the user can already see.
      function locateRow(item) {
        if (item === null || item === undefined) return null;
        var state = store.get();
        var compiled = compileTextMatcher(state.query, { match: state.match, caseSensitive: state.caseSensitive });
        var scoped = [];
        if (typeof item.turn === "number") {
          scoped = Array.prototype.slice.call(document.querySelectorAll('[data-chat-turn="' + item.turn + '"]'));
        }
        if (scoped.length === 0) {
          scoped = Array.prototype.slice.call(document.querySelectorAll("[data-chat-turn]"));
        }
        if (scoped.length === 0) return null;
        var visible = [];
        for (var index = 0; index < scoped.length; index += 1) {
          if (scoped[index].getClientRects().length > 0) visible.push(scoped[index]);
        }
        var pool = visible.length > 0 ? visible : scoped;
        if (compiled.error !== undefined) return pool[0];
        for (var hit = 0; hit < pool.length; hit += 1) {
          if (compiled.find(pool[hit].textContent || "").length > 0) return pool[hit];
        }
        return pool[0];
      }

      function clickLoadEarlier() {
        var anchor = document.querySelector("[data-chat-paging-anchor]");
        var scope = anchor !== null ? anchor.parentElement || document : document;
        var buttons = Array.prototype.slice.call(scope.querySelectorAll("button"));
        for (var index = 0; index < buttons.length; index += 1) {
          var label = (buttons[index].textContent || "").trim();
          var lower = label.toLowerCase();
          if (label.indexOf("加载更早") >= 0 || label.indexOf("更早") >= 0 || lower.indexOf("earlier") >= 0 || lower.indexOf("older") >= 0) {
            buttons[index].click();
            return true;
          }
        }
        return false;
      }

      async function loadThrough(sessionId, seq) {
        try {
          var binding = sessions !== undefined && sessions !== null && typeof sessions.binding === "function" ? sessions.binding(sessionId) : undefined;
          if (binding !== undefined && binding !== null) {
            var holder = binding.session !== undefined ? binding.session : binding;
            if (holder !== undefined && holder !== null && typeof holder.loadThrough === "function") {
              await holder.loadThrough(seq);
              return true;
            }
          }
        } catch (error) {
          /* fall through to the rendered load-earlier control */
        }
        return clickLoadEarlier();
      }

      async function jumpTo(item) {
        if (item === null || item === undefined) return "unloaded";
        if (typeof item.sessionId === "string" && store.get().lastSessionId !== item.sessionId) return "wrong-session";
        if (layout !== undefined && layout !== null && typeof layout.selectPanel === "function") {
          try {
            layout.selectPanel(null);
          } catch (error) {
            /* the conversation is already the active panel */
          }
        }
        var compiled = compileTextMatcher(store.get().query, { match: store.get().match, caseSensitive: store.get().caseSensitive });
        for (var attempt = 0; attempt < 3; attempt += 1) {
          var row = locateRow(item);
          if (row !== null) {
            paintCurrent(row, compiled);
            return "jumped";
          }
          var loaded = await loadThrough(item.sessionId, item.seq);
          if (!loaded) break;
          await sleep(300);
        }
        return "unloaded";
      }

      async function openSessionResult(item) {
        store.set({ pendingJump: { sessionId: item.sessionId, seq: item.seq } });
        try {
          if (uiWorkspace !== undefined && uiWorkspace !== null && typeof uiWorkspace.openSession === "function") {
            uiWorkspace.openSession(item.sessionId);
          }
        } catch (error) {
          /* the session may have been removed */
        }
        for (var attempt = 0; attempt < 20; attempt += 1) {
          await sleep(250);
          if (store.get().lastSessionId === item.sessionId) {
            var outcome = await jumpTo(item);
            if (outcome === "jumped") {
              store.set({ pendingJump: null });
              return;
            }
          }
        }
        store.set({ pendingJump: null });
      }

      // --------------------------------------------------------- actions --

      function setActive(index) {
        var state = store.get();
        if (state.items.length === 0) return;
        var next = ((index % state.items.length) + state.items.length) % state.items.length;
        store.set({ activeIndex: next });
        if (state.target === "session") {
          var row = locateRow(state.items[next]);
          if (row !== null) {
            paintCurrent(row, compileTextMatcher(state.query, { match: state.match, caseSensitive: state.caseSensitive }));
          }
        }
      }

      function step(delta) {
        var state = store.get();
        if (state.items.length === 0) return;
        setActive((state.activeIndex < 0 ? 0 : state.activeIndex + delta));
      }

      function stepAndJump(delta) {
        step(delta);
        var item = store.get().items[store.get().activeIndex];
        if (item !== undefined) void jumpTo(item);
      }

      function openFind(target, sessionId) {
        rememberSession(sessionId);
        if (store.get().lastSessionId === undefined) {
          // Cold start: the header toggle has not seen a Session yet, so seed
          // it from the conversation root before the first search runs.
          rememberSession(currentSessionId());
        }
        store.set({ open: true, target: target });
        scheduleSearch();
      }

      function closeFind() {
        store.set({ open: false, activeIndex: -1, previewIndex: -1, preview: null });
        clearHighlights();
      }

      function toggleFind(sessionId) {
        rememberSession(sessionId);
        if (store.get().open) {
          closeFind();
          return;
        }
        openFind("session", sessionId);
      }

      function setTarget(target) {
        if (store.get().target === target) return;
        store.set({ target: target, items: [], total: 0, activeIndex: -1, previewIndex: -1, preview: null });
        if (target === "global" && store.get().open === false) store.set({ open: true });
        scheduleSearch();
      }

      function updateQuery(query, sessionId) {
        rememberSession(sessionId);
        store.set({ query: query });
        scheduleSearch();
      }

      function patchFilters(patch) {
        store.set({ filters: Object.assign({}, store.get().filters, patch) });
        scheduleSearch();
      }

      function setMatch(match) {
        prefs.match = match;
        writePrefs(prefs);
        store.set({ match: match });
        scheduleSearch();
      }

      function setCaseSensitive(next) {
        prefs.caseSensitive = next;
        writePrefs(prefs);
        store.set({ caseSensitive: next });
        scheduleSearch();
      }

      function setScope(next) {
        prefs.scope = next;
        writePrefs(prefs);
        store.set({ scope: next });
        scheduleSearch();
      }

      function ensureTabRegistered() {
        if (tabRegistered) return true;
        if (sidebarRightTabs === undefined || sidebarRightTabs === null || typeof sidebarRightTabs.register !== "function") return false;
        try {
          var already = typeof sidebarRightTabs.get === "function" ? sidebarRightTabs.get(TAB_ID) : null;
          if (already === null || already === undefined) {
            tabDisposers.push(
              sidebarRightTabs.register({
                id: TAB_ID,
                kind: TAB_KIND,
                title: function () {
                  return tr("tab.title");
                },
                canOpen: function () {
                  return true;
                }
              })
            );
          }
          tabRegistered = true;
          return true;
        } catch (error) {
          tabRegistered = false;
          return false;
        }
      }

      function openResultsTab() {
        if (!ensureTabRegistered()) return false;
        if (sidebarRight === undefined || sidebarRight === null || typeof sidebarRight.openTab !== "function") return false;
        try {
          sidebarRight.openTab(TAB_KIND);
          return true;
        } catch (error) {
          /* openTab throws while a global page owns the screen */
          return false;
        }
      }

      async function loadPreview(item) {
        store.set({ previewLoading: true, preview: null });
        var result = await rpc("context", { sessionId: item.sessionId, seq: item.seq, before: 2, after: 2, scope: store.get().scope });
        if (result.ok !== true) {
          store.set({ previewLoading: false, preview: null });
          return;
        }
        store.set({ previewLoading: false, preview: result.value });
      }

      function dispose() {
        clearHighlights();
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        if (controller !== null) {
          try {
            controller.abort();
          } catch (error) {
            /* ignore */
          }
        }
        for (var index = 0; index < tabDisposers.length; index += 1) {
          try {
            tabDisposers[index]();
          } catch (error) {
            /* already disposed */
          }
        }
        tabDisposers = [];
        tabRegistered = false;
      }

      return {
        store: store,
        t: t,
        prefs: prefs,
        rememberSession: rememberSession,
        runSearch: runSearch,
        scheduleSearch: scheduleSearch,
        step: step,
        stepAndJump: stepAndJump,
        setActive: setActive,
        jumpTo: jumpTo,
        openSessionResult: openSessionResult,
        openFind: openFind,
        closeFind: closeFind,
        toggleFind: toggleFind,
        setTarget: setTarget,
        updateQuery: updateQuery,
        patchFilters: patchFilters,
        setMatch: setMatch,
        setCaseSensitive: setCaseSensitive,
        setScope: setScope,
        loadPreview: loadPreview,
        openResultsTab: openResultsTab,
        ensureTabRegistered: ensureTabRegistered,
        dispose: dispose
      };
    }

    // ----------------------------------------------------------- components --

    function Icon(props) {
      var size = props && props.size ? props.size : 16;
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true" },
        h("path", { d: "M8.75 15A6.25 6.25 0 1 0 8.75 2.5a6.25 6.25 0 0 0 0 12.5Z", stroke: "currentColor", strokeWidth: "1.5" }),
        h("path", { d: "m13.3 13.3 3.95 3.95", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })
      );
    }

    /**
     * The search box.
     *
     * Deliberately UNCONTROLLED: no `value` prop is ever handed to React. Three
     * failure modes are avoided this way.
     *
     * 1. A controlled input whose `value` round-trips through an external store
     *    loses keystrokes whenever that store lags (debounced search, async
     *    result batches): React rewrites the DOM value to the stale store value
     *    between keystrokes, so the box appears to accept exactly one character.
     *    With no `value` prop, no re-render can touch what the user typed.
     * 2. An IME guard held in a ref can latch. If `compositionstart` fires and
     *    `compositionend` never arrives (focus stolen mid-composition, node
     *    re-parented), the ref stays true and every later `change` is swallowed.
     *    `isComposing` on the native event is the stateless equivalent.
     * 3. `autoFocus` is applied by React only at mount and races the host's own
     *    focus restoration, so focus is claimed explicitly in an effect instead.
     */
    function SearchInput(props) {
      var inputRef = React.useRef(null);
      // The last value this box pushed out; used to tell an echo of our own
      // change apart from a genuinely external one (preset query, reset).
      var pushed = React.useRef(typeof props.value === "string" ? props.value : "");

      // Mirror an external change into the DOM, but only when it did NOT come
      // from this box. The value is written straight to the node, never through
      // a `value` prop, so a re-render cannot clobber in-progress typing.
      React.useEffect(function () {
        var next = typeof props.value === "string" ? props.value : "";
        if (next === pushed.current) return;
        pushed.current = next;
        var node = inputRef.current;
        if (node === null || node === undefined) return;
        if (node.value === next) return;
        node.value = next;
      }, [props.value]);

      // Focus after mount explicitly instead of via the `autoFocus` attribute:
      // React applies that only at mount time and it races the host's own focus
      // restoration, which lands focus back in the composer.
      React.useEffect(function () {
        if (props.autoFocus !== true) return;
        var node = inputRef.current;
        if (node === null || node === undefined) return;
        try {
          node.focus({ preventScroll: true });
        } catch (error) {
          /* focus is best-effort */
        }
        try {
          node.select();
        } catch (error) {
          /* select is best-effort */
        }
      }, [props.autoFocus]);

      // Reclaim focus that the surrounding UI dropped to nowhere.
      //
      // This only runs as a side effect of the user's own keystroke reaching the
      // box: `emit` is what calls it, and `emit` cannot run unless the box had
      // focus. So it never steals a character typed somewhere else — it only
      // undoes a blur that happened *during* our own change (a host re-render
      // moving focus to `body`), which would otherwise make the box look like it
      // accepted one character and then stopped.
      //
      // A focus that moved to another real control means the user clicked
      // somewhere, and is left alone.
      function restoreFocus() {
        var node = inputRef.current;
        if (node === null || node === undefined) return;
        var active = document.activeElement;
        if (active === node) return;
        if (active !== null && active !== undefined && active !== document.body) return;
        try {
          node.focus({ preventScroll: true });
          var end = node.value.length;
          node.setSelectionRange(end, end);
        } catch (error) {
          /* focus is best-effort */
        }
      }

      function emit(value) {
        pushed.current = value;
        props.onChange(value);
        restoreFocus();
      }

      return h("input", {
        ref: inputRef,
        className: "dsf-input",
        type: "text",
        // No `value` prop on purpose — see the doc comment above. The initial
        // text is seeded through `defaultValue`, which React only applies at
        // mount; later external changes are written by the effect.
        defaultValue: typeof props.value === "string" ? props.value : "",
        placeholder: props.placeholder,
        "data-invalid": props.invalid === true ? "true" : "false",
        "data-dsf-input": "true",
        spellCheck: false,
        autoComplete: "off",
        onChange: function (event) {
          var native = event.nativeEvent;
          if (native !== null && native !== undefined && native.isComposing === true) return;
          emit(event.target.value);
        },
        onCompositionEnd: function (event) {
          emit(event.target.value);
        },
        onKeyDown: function (event) {
          if (event.key === "Enter") {
            event.preventDefault();
            props.onEnter(event.shiftKey ? -1 : 1);
          } else if (event.key === "Escape") {
            event.preventDefault();
            props.onEscape();
          }
        }
      });
    }

    function MatchSelect() {
      var state = useStore();
      return h(
        "select",
        {
          className: "dsf-select",
          value: state.match,
          title: tr("match." + state.match),
          onChange: function (event) {
            rt.setMatch(event.target.value);
          }
        },
        h("option", { value: "substring" }, tr("match.substring")),
        h("option", { value: "exact" }, tr("match.exact")),
        h("option", { value: "regex" }, tr("match.regex"))
      );
    }

    function ScopeToggles() {
      var state = useStore();
      function toggle(key) {
        var next = { body: state.scope.body !== false, tools: state.scope.tools === true, thinking: state.scope.thinking === true };
        next[key] = !next[key];
        if (next.body !== true && next.tools !== true && next.thinking !== true) next.body = true;
        rt.setScope(next);
      }
      return h(
        "div",
        { className: "dsf-options" },
        h(
          "label",
          { className: "dsf-check" },
          h("input", { type: "checkbox", checked: state.scope.body !== false, onChange: function () { toggle("body") } }),
          tr("scope.body")
        ),
        h(
          "label",
          { className: "dsf-check" },
          h("input", { type: "checkbox", checked: state.scope.tools === true, onChange: function () { toggle("tools") } }),
          tr("scope.tools")
        ),
        h(
          "label",
          { className: "dsf-check" },
          h("input", { type: "checkbox", checked: state.scope.thinking === true, onChange: function () { toggle("thinking") } }),
          tr("scope.thinking")
        ),
        h(
          "label",
          { className: "dsf-check" },
          h("input", {
            type: "checkbox",
            checked: state.caseSensitive,
            onChange: function () {
              rt.setCaseSensitive(!state.caseSensitive);
            }
          }),
          tr("case.sensitive")
        )
      );
    }

    function Count(props) {
      var state = props.state;
      if (state.loading) return h("span", { className: "dsf-count" }, tr("state.searching"));
      if (state.error !== null && state.error !== undefined) {
        return h("span", { className: "dsf-count", style: { color: "var(--dsw-alias-state-error-primary)" } }, tr("error." + state.error));
      }
      if (state.items.length === 0) return h("span", { className: "dsf-count" }, state.query ? tr("count.empty") : "");
      var position = state.activeIndex >= 0 ? state.activeIndex + 1 : 0;
      return h("span", { className: "dsf-count" }, tr("count.position").replace("{i}", String(position)).replace("{n}", String(state.items.length)));
    }

    function Snippet(props) {
      var item = props.item;
      var text = typeof item.snippet === "string" ? item.snippet : "";
      var start = typeof item.matchStart === "number" ? item.matchStart : -1;
      var end = typeof item.matchEnd === "number" ? item.matchEnd : -1;
      if (start < 0 || end <= start || end > text.length) return h("span", { className: "dsf-snippet" }, text);
      return h(
        "span",
        { className: "dsf-snippet" },
        text.slice(0, start),
        h("em", null, text.slice(start, end)),
        text.slice(end)
      );
    }

    function Badges(props) {
      var item = props.item;
      var out = [];
      if (item.kind === "tool" || item.kind === "meta") out.push(h("span", { key: "tool", className: "dsf-badge" }, tr("badge.tool")));
      if (item.kind === "thinking") out.push(h("span", { key: "thinking", className: "dsf-badge" }, tr("badge.thinking")));
      if (props.unloaded === true) out.push(h("span", { key: "unloaded", className: "dsf-badge", "data-tone": "warn" }, tr("badge.unloaded")));
      if (out.length === 0) return null;
      return h("span", { style: { display: "inline-flex", gap: "4px" } }, out);
    }

    function formatTime(value) {
      if (typeof value !== "number" || value <= 0) return "";
      var date = new Date(value);
      var now = new Date();
      var hh = String(date.getHours()).padStart(2, "0");
      var mm = String(date.getMinutes()).padStart(2, "0");
      if (date.toDateString() === now.toDateString()) return hh + ":" + mm;
      return date.getMonth() + 1 + "/" + date.getDate() + " " + hh + ":" + mm;
    }

    function PreviewCard() {
      var state = useStore();
      if (state.previewLoading) return h("div", { className: "dsf-preview" }, tr("state.searching"));
      var preview = state.preview;
      if (preview === null || preview === undefined) return null;
      var rows = [];
      var before = Array.isArray(preview.before) ? preview.before : [];
      var after = Array.isArray(preview.after) ? preview.after : [];
      var all = before.concat(preview.target ? [preview.target] : [], after);
      for (var index = 0; index < all.length; index += 1) {
        rows.push(
          h(
            "div",
            {
              key: "line-" + index,
              className: "dsf-preview-line",
              "data-target": preview.target !== null && preview.target !== undefined && all[index] === preview.target ? "true" : "false"
            },
            typeof all[index].text === "string" ? all[index].text : ""
          )
        );
      }
      var item = state.items[state.activeIndex];
      return h(
        "div",
        {
          className: "dsf-preview",
          onClick: function (event) {
            event.stopPropagation();
          }
        },
        h(
          "div",
          { className: "dsf-row-top" },
          h("span", null, tr("preview.context")),
          preview.anchored === false ? h("span", { className: "dsf-badge", "data-tone": "warn" }, tr("badge.unloaded")) : null
        ),
        rows,
        h(
          "div",
          { className: "dsf-preview-actions" },
          h(
            "button",
            {
              className: "dsf-btn",
              onClick: function () {
                if (item !== undefined) void rt.openSessionResult(item);
              }
            },
            tr("action.open")
          )
        )
      );
    }

    function ResultsList(props) {
      var state = useStore();
      var listRef = React.useRef(null);

      React.useEffect(function () {
        if (state.activeIndex < 0 || listRef.current === null) return;
        var row = listRef.current.querySelector('[data-index="' + state.activeIndex + '"]');
        if (row !== null) row.scrollIntoView({ block: "nearest" });
      }, [state.activeIndex]);

      if (state.error !== null && state.error !== undefined && state.items.length === 0) {
        return h(
          "div",
          { className: "dsf-error" },
          h("span", null, tr("state.failed") + "：" + tr("error." + state.error)),
          h(
            "button",
            {
              className: "dsf-btn",
              onClick: function () {
                rt.runSearch();
              }
            },
            tr("action.retry")
          )
        );
      }
      if (state.loading && state.items.length === 0) return h("div", { className: "dsf-message" }, tr("state.searching"));
      if (!state.query) return h("div", { className: "dsf-message" }, tr("state.idle"));
      if (state.items.length === 0) return h("div", { className: "dsf-message" }, state.target === "session" ? tr("empty.session") : tr("empty.global"));

      var nodes = [];
      for (var index = 0; index < state.items.length; index += 1) {
        nodes.push(h(ResultRow, { key: state.items[index].sessionId + ":" + state.items[index].seq + ":" + index, item: state.items[index], index: index, showSession: props.showSession !== false }));
      }
      if (state.hasMore) nodes.push(h("div", { key: "more", className: "dsf-message" }, tr("state.more")));
      return h("div", { className: "dsf-list", ref: listRef }, nodes);
    }

    function ResultRow(props) {
      var state = useStore();
      var item = props.item;
      var expanded = state.previewIndex === props.index;
      var unloaded = state.unloadedKey === item.sessionId + ":" + item.seq;

      function activate() {
        var current = rt.store.get();
        rt.store.set({ activeIndex: props.index, previewIndex: current.previewIndex === props.index ? -1 : props.index, preview: null });
        if (current.target === "session") {
          void rt.jumpTo(item).then(function (outcome) {
            if (outcome === "unloaded") rt.store.set({ unloadedKey: item.sessionId + ":" + item.seq });
          });
        } else {
          void rt.loadPreview(item);
        }
      }

      return h(
        "div",
        {
          className: "dsf-row",
          "data-index": props.index,
          "data-active": state.activeIndex === props.index ? "true" : "false",
          onClick: activate
        },
        h(
          "div",
          { className: "dsf-row-top" },
          props.showSession ? h("span", { className: "dsf-where" }, item.sessionTitle || String(item.sessionId).slice(0, 8)) : null,
          h("span", { className: "dsf-when" }, formatTime(item.time)),
          h(Badges, { item: item, unloaded: unloaded })
        ),
        h(Snippet, { item: item }),
        expanded ? h(PreviewCard, null) : null
      );
    }

    function FilterRow() {
      var state = useStore();
      return h(
        "div",
        { className: "dsf-filters" },
        h(
          "select",
          {
            className: "dsf-select",
            title: tr("filter.range"),
            value: state.filters.range,
            onChange: function (event) {
              rt.patchFilters({ range: event.target.value });
            }
          },
          h("option", { value: "current" }, tr("filter.range.current")),
          h("option", { value: "all" }, tr("filter.range.all"))
        ),
        h(
          "select",
          {
            className: "dsf-select",
            title: tr("filter.time"),
            value: state.filters.time,
            onChange: function (event) {
              rt.patchFilters({ time: event.target.value });
            }
          },
          h("option", { value: "any" }, tr("filter.time.any")),
          h("option", { value: "today" }, tr("filter.time.today")),
          h("option", { value: "7" }, tr("filter.time.7")),
          h("option", { value: "30" }, tr("filter.time.30"))
        ),
        h(
          "label",
          { className: "dsf-check" },
          h("input", {
            type: "checkbox",
            checked: state.filters.includeArchived,
            onChange: function (event) {
              rt.patchFilters({ includeArchived: event.target.checked });
            }
          }),
          tr("filter.archived")
        ),
        h(
          "label",
          { className: "dsf-check" },
          h("input", {
            type: "checkbox",
            checked: state.filters.includeSubagents,
            onChange: function (event) {
              rt.patchFilters({ includeSubagents: event.target.checked });
            }
          }),
          tr("filter.subagents")
        )
      );
    }

    function TargetSwitch() {
      var state = useStore();
      return h(
        "span",
        { style: { display: "inline-flex", gap: "4px" } },
        h(
          "button",
          {
            className: "dsf-btn",
            "data-active": state.target === "session" ? "true" : "false",
            onClick: function () {
              rt.setTarget("session");
            }
          },
          tr("scope.session")
        ),
        h(
          "button",
          {
            className: "dsf-btn",
            "data-active": state.target === "global" ? "true" : "false",
            onClick: function () {
              rt.setTarget("global");
            }
          },
          tr("scope.global")
        )
      );
    }

    /**
     * The floating find bar.
     *
     * It is registered into `shell.overlay` — the frame-wide floating layer —
     * and NOT into `conversation.input.dock`. The dock sits inside
     * `[data-composer-seat]`, and skins are free to hide that whole seat while
     * the transcript scrolls (the maid skin writes `data-maid-composer-hidden`
     * → `opacity:0;pointer-events:none` and blurs whatever inside it has
     * focus). Because a search necessarily scrolls the transcript, a bar in
     * the dock loses focus and stops receiving keys after the first search —
     * the reported "can only type once" symptom. The overlay layer is outside
     * every scroll container, so nothing scroll-driven can touch it.
     *
     * `shell.overlay` is root-scoped and hands out no `sessionId`, so the
     * current Session comes from the store, which the always-mounted header
     * toggle keeps up to date; `currentSessionId()` covers the cold-start case
     * by reading the id the conversation root publishes in the DOM.
     */
    function FindBar() {
      var state = useStore();
      var sessionId = state.lastSessionId;
      var optionsOpen = React.useState(false);
      var showOptions = optionsOpen[0];
      var setShowOptions = optionsOpen[1];

      // Keep the bar over the conversation column rather than the whole frame:
      // `shell.overlay` spans every column, so a plain 50% would park the bar
      // on top of the sidebar (or the right panel) instead of the transcript.
      // The conversation root publishes its own box, and a ResizeObserver keeps
      // this in step with sidebar drags and window resizes.
      var seatState = React.useState(null);
      var seatStyle = seatState[0];
      var setSeatStyle = seatState[1];

      React.useEffect(function () {
        function measure() {
          var host = null;
          try {
            host = document.querySelector("[data-conversation-content]");
          } catch (error) {
            host = null;
          }
          if (host === null || host === undefined) {
            setSeatStyle(null);
            return;
          }
          var box = host.getBoundingClientRect();
          if (box.width <= 0) {
            setSeatStyle(null);
            return;
          }
          // `left`/`top` below are applied to an absolutely positioned seat, so
          // they must be relative to the overlay layer's own box, not the
          // viewport. Measuring the layer keeps this right even when the frame
          // is offset (native titlebar, devtools, a transformed ancestor).
          var originLeft = 0;
          var originTop = 0;
          try {
            var layer = document.querySelector("[data-shell-overlay]");
            if (layer !== null && layer !== undefined) {
              var origin = layer.getBoundingClientRect();
              originLeft = origin.left;
              originTop = origin.top;
            }
          } catch (error) {
            /* fall back to viewport coordinates */
          }
          setSeatStyle({
            left: Math.round(box.left + box.width / 2 - originLeft) + "px",
            top: Math.max(8, Math.round(box.top - originTop + 8)) + "px",
            width: Math.min(720, Math.max(320, Math.round(box.width - 32))) + "px"
          });
        }
        measure();
        window.addEventListener("resize", measure);
        var observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
        if (observer !== null) {
          try {
            observer.observe(document.documentElement);
          } catch (error) {
            /* geometry tracking is best-effort */
          }
        }
        return function () {
          window.removeEventListener("resize", measure);
          if (observer !== null) {
            try {
              observer.disconnect();
            } catch (error) {
              /* ignore */
            }
          }
        };
      }, []);

      if (!state.open) return null;

      var seat = { className: "dsf-bar-seat" };
      if (seatStyle !== null) {
        seat.style = { left: seatStyle.left, top: seatStyle.top, width: seatStyle.width };
      }

      return h(
        "div",
        seat,
        h(
          "div",
          { className: "dsf-bar" },
          h(SearchInput, {
            value: state.query,
            placeholder: state.target === "session" ? tr("placeholder") : tr("global.placeholder"),
            invalid: state.error === "bad-regex",
            autoFocus: true,
            onChange: function (value) {
              rt.updateQuery(value, sessionId);
            },
            onEnter: function (delta) {
              rt.stepAndJump(delta);
            },
            onEscape: function () {
              rt.closeFind();
            }
          }),
          h(Count, { state: state }),
          h("button", { className: "dsf-btn", title: tr("action.prev"), disabled: state.items.length === 0, onClick: function () { rt.stepAndJump(-1) } }, "↑"),
          h("button", { className: "dsf-btn", title: tr("action.next"), disabled: state.items.length === 0, onClick: function () { rt.stepAndJump(1) } }, "↓"),
          h("span", { className: "dsf-sep" }),
          h(TargetSwitch, null),
          h(MatchSelect, null),
          h(
            "button",
            {
              className: "dsf-btn",
              title: tr("action.options"),
              "data-active": showOptions ? "true" : "false",
              onClick: function () {
                setShowOptions(!showOptions);
              }
            },
            "⋯"
          ),
          h("button", { className: "dsf-btn", title: tr("action.close"), onClick: function () { rt.closeFind() } }, "✕"),
          showOptions ? h(ScopeToggles, null) : null
        )
      );
    }

    /** The right-sidebar results tab. */
    function ResultsPanel(props) {
      var state = useStore();

      React.useEffect(function () {
        rt.rememberSession(props.sessionId);
        rt.ensureTabRegistered();
      }, [props.sessionId]);

      return h(
        "div",
        { className: "dsf-panel" },
        h(
          "div",
          { className: "dsf-panel-head" },
          h(SearchInput, {
            value: state.query,
            placeholder: state.target === "session" ? tr("placeholder") : tr("global.placeholder"),
            invalid: state.error === "bad-regex",
            autoFocus: true,
            onChange: function (value) {
              rt.updateQuery(value, props.sessionId);
            },
            onEnter: function (delta) {
              rt.stepAndJump(delta);
            },
            onEscape: function () {
              rt.closeFind();
            }
          }),
          h(Count, { state: state }),
          h("button", { className: "dsf-btn", disabled: state.items.length === 0, onClick: function () { rt.stepAndJump(-1) } }, "↑"),
          h("button", { className: "dsf-btn", disabled: state.items.length === 0, onClick: function () { rt.stepAndJump(1) } }, "↓")
        ),
        h("div", { className: "dsf-panel-head", style: { paddingTop: "4px", paddingBottom: "4px" } }, h(TargetSwitch, null), h(MatchSelect, null)),
        h(FilterRow, null),
        h(ResultsList, { showSession: state.target === "global" })
      );
    }

    /** The standalone 「查找」 page opened from the left rail. */
    function FindPage() {
      var state = useStore();
      return h(
        "div",
        { className: "dsf-page" },
        h(
          "div",
          { className: "dsf-page-head" },
          h(Icon, { size: 18 }),
          h("span", { className: "dsf-page-title" }, tr("panel")),
          h(TargetSwitch, null),
          h("span", { style: { flex: "1 1 auto" } }),
          h(
            "button",
            {
              className: "dsf-btn",
              disabled: typeof state.lastSessionId !== "string" || state.lastSessionId.length === 0,
              onClick: function () {
                rt.openResultsTab();
              }
            },
            tr("action.dock")
          )
        ),
        h(FilterRow, null),
        h(
          "div",
          { className: "dsf-page-search" },
          h(SearchInput, {
            value: state.query,
            placeholder: state.target === "session" ? tr("placeholder") : tr("global.placeholder"),
            invalid: state.error === "bad-regex",
            onChange: function (value) {
              rt.updateQuery(value);
            },
            onEnter: function (delta) {
              rt.stepAndJump(delta);
            },
            onEscape: function () {
              rt.store.set({ query: "" });
            }
          }),
          h(Count, { state: state }),
          h(MatchSelect, null)
        ),
        h(ResultsList, { showSession: state.target === "global" })
      );
    }

    /** Settings → 查找. */
    function SettingsCard() {
      var state = useStore();
      return h(
        "div",
        { className: "dsf-settings" },
        h("div", { className: "dsf-settings-hint" }, tr("settings.description")),
        h("div", { className: "dsf-settings-row" }, h("span", { className: "dsf-settings-label" }, tr("settings.match")), h(MatchSelect, null)),
        h("div", { className: "dsf-settings-row", style: { alignItems: "flex-start" } }, h("span", { className: "dsf-settings-label" }, tr("settings.scope")), h(ScopeToggles, null)),
        h(
          "div",
          { className: "dsf-settings-row" },
          h("span", { className: "dsf-settings-label" }, tr("settings.limit")),
          h("input", {
            className: "dsf-input",
            type: "number",
            min: 50,
            max: 2000,
            step: 50,
            style: { flex: "0 0 96px" },
            value: rt.prefs.limit,
            onChange: function (event) {
              rt.prefs.limit = clampLimit(event.target.value);
              writePrefs(rt.prefs);
            }
          })
        ),
        h("div", { className: "dsf-settings-hint" }, tr("settings.hint"))
      );
    }

    function HeaderToggle(props) {
      var state = useStore();
      React.useEffect(function () {
        rt.rememberSession(props.sessionId);
      }, [props.sessionId]);
      return h(
        "button",
        {
          className: "dsf-btn",
          title: tr("action.toggle"),
          "data-active": state.open ? "true" : "false",
          onClick: function () {
            rt.toggleFind(props.sessionId);
          }
        },
        h(Icon, { size: 16 })
      );
    }

    // ---------------------------------------------------------------- apply --

    function apply(ctx) {
      ctx.effect(function* () {
        yield ctx.locale.register(NS, messages);

        var style = document.createElement("style");
        style.setAttribute("data-plugin", "dsh-find-session");
        style.textContent = STYLE_TEXT;
        document.head.appendChild(style);

        rt = createRuntime(ctx);
        // Expose the live handle for debugging without adding a public service.
        try {
          globalThis.__DSH_SESSION_FIND__ = rt;
        } catch (error) {
          /* ignore */
        }

        yield function () {
          try {
            rt.dispose();
          } catch (error) {
            /* ignore */
          }
          style.remove();
          rt = null;
          try {
            delete globalThis.__DSH_SESSION_FIND__;
          } catch (error) {
            /* ignore */
          }
        };

        var slots = ctx.slots;

        // (a) Left-rail icon → the root-scoped `main` page of the same id.
        yield slots.inject("sidebar.panellist", function () {
          return slots.register(
            {
              name: "sidebar.panellist",
              id: PANEL_ID,
              order: 30,
              label: function () {
                return tr("panel");
              },
              locale: NS
            },
            function () {
              return h("span", { style: { display: "inline-flex" } }, h(Icon, { size: 18 }));
            }
          );
        });

        yield slots.inject("main", function* () {
          yield slots.register({ name: "main", key: PANEL_ID, locale: NS }, FindPage);
        });

        // (b) Right-sidebar results tab. The TYPE registration is idempotent and
        // survives a remount, while the pane BODY is plugin-scoped and must be
        // re-registered every mount — so they live in separate try blocks. One
        // shared catch would let the type's "already registered" throw silently
        // kill the body and leave the pane on the owner's fallback notice.
        try {
          rt.ensureTabRegistered();
        } catch (error) {
          /* the tab type is optional; the standalone page still works */
        }

        try {
          yield slots.inject("sidebar.right.pane.tab", function () {
            return slots.register({ name: "sidebar.right.pane.tab", key: TAB_ID, locale: NS }, ResultsPanel);
          });
          yield slots.inject("sidebar.right.pane.tab.title", function () {
            return slots.register({ name: "sidebar.right.pane.tab.title", key: TAB_ID }, function () {
              return tr("tab.title");
            });
          });
        } catch (error) {
          /* body registration is best-effort */
        }

        // (c) Session header toggle + the floating bar. The bar goes into
        // `shell.overlay`, never `conversation.input.dock`: the dock lives
        // inside `[data-composer-seat]`, which skins hide (and blur) while the
        // transcript scrolls — see the FindBar doc comment.
        yield slots.inject("conversation.session.header.actions", function () {
          return slots.register({ name: "conversation.session.header.actions", id: "session-find", order: 40, locale: NS }, HeaderToggle);
        });

        yield slots.inject("shell.overlay", function () {
          return slots.register({ name: "shell.overlay", id: "session-find", order: 40, locale: NS }, FindBar);
        });

        // (d) Settings page.
        yield slots.inject("settings.section", function () {
          return slots.register(
            {
              name: "settings.section",
              id: "session-find",
              order: 55,
              label: function () {
                return tr("settings.title");
              },
              locale: NS
            },
            SettingsCard
          );
        });

        // (e) Shortcuts. Only DESKTOP profiles are bound. The service validates
        // every default, and a binding outside the browser-reserved set makes
        // register() throw "Unsupported Web shortcut" — ONE such default used to
        // abort the whole registration, so none of the four commands ever
        // existed and Ctrl+F was dead on every platform. An omitted profile is
        // simply UNBOUND there, which is also the honest answer for Web: a page
        // cannot claim Ctrl+F. The page-level listener in (f) covers a plain
        // browser tab, and users rebind any desktop key in Settings → Shortcuts.
        //
        // The service is a SOFT dependency: the client mounts plugin bundles in
        // parallel, so `shortcuts` can be provided a beat after this plugin
        // activates. When it is missing we wait for it with `ctx.inject` instead
        // of dropping the bindings for the rest of the page's life.
        var profiles = ["desktop:macos", "desktop:windows", "desktop:linux"];
        // The dispatch context ALWAYS carries `modal`: `null` when no dialog is
        // open, otherwise "other" or the dialog's `data-shortcut-modal` value.
        // Testing `modal !== undefined` therefore matched every dispatch and
        // returned "pass" for every key press — the two open commands could
        // never fire. Only a non-null modal may pass the key through.
        function modalOpen(context) {
          return context !== null && context !== undefined && context.modal !== null && context.modal !== undefined;
        }
        // `null` leaves the command UNBOUND without defaulting it: the service
        // only rejects a binding it actually receives, but it rejects a default
        // without a real modifier as "modifier-required", and one rejected
        // default aborts the registration of ALL commands.
        function defaultsFor(binding) {
          var out = {};
          if (binding === null || binding === undefined) return out;
          for (var profileIndex = 0; profileIndex < profiles.length; profileIndex += 1) out[profiles[profileIndex]] = binding;
          return out;
        }
        function shortcutCommands() {
          return [
            {
              id: "session-find.open",
              label: function () {
                return tr("shortcut.open");
              },
              defaults: defaultsFor({ code: "KeyF", modifiers: ["primary"] }),
              regions: ["page", "editable"],
              resolve: function (context) {
                if (modalOpen(context)) return { status: "pass" };
                rt.openFind("session", rt.store.get().lastSessionId);
                return { status: "handled", run: function () {} };
              }
            },
            {
              id: "session-find.open-global",
              label: function () {
                return tr("shortcut.global");
              },
              defaults: defaultsFor({ code: "KeyF", modifiers: ["primary", "shift"] }),
              regions: ["page", "editable"],
              resolve: function (context) {
                if (modalOpen(context)) return { status: "pass" };
                rt.openFind("global", rt.store.get().lastSessionId);
                rt.store.set({ open: true });
                return { status: "handled", run: function () {} };
              }
            },
            {
              id: "session-find.next",
              label: function () {
                return tr("shortcut.next");
              },
              // F3 has no modifier, and the service rejects a default that has
              // none ("modifier-required"). Stay unbound here and step from the
              // page listener in (f) instead; users may still rebind these.
              defaults: defaultsFor(null),
              regions: ["page", "editable"],
              resolve: function () {
                rt.stepAndJump(1);
                return { status: "handled", run: function () {} };
              }
            },
            {
              id: "session-find.prev",
              label: function () {
                return tr("shortcut.prev");
              },
              defaults: defaultsFor(null),
              regions: ["page", "editable"],
              resolve: function () {
                rt.stepAndJump(-1);
                return { status: "handled", run: function () {} };
              }
            }
          ];
        }
        function attachShortcuts(service) {
          var commands = shortcutCommands();
          var disposers = [];
          try {
            for (var commandIndex = 0; commandIndex < commands.length; commandIndex += 1) {
              disposers.push(service.register(commands[commandIndex]));
            }
          } catch (error) {
            for (var rollbackIndex = 0; rollbackIndex < disposers.length; rollbackIndex += 1) {
              try {
                disposers[rollbackIndex]();
              } catch (ignored) {
                /* already gone */
              }
            }
            throw error;
          }
          ctx.effect(function () {
            return function () {
              for (var index = 0; index < disposers.length; index += 1) {
                try {
                  disposers[index]();
                } catch (ignored) {
                  /* already gone */
                }
              }
            };
          }, "dsh-find-session shortcuts");
        }

        var shortcutState = { service: "missing", registration: "pending", error: null };
        function tryAttach(service) {
          if (service === undefined || service === null || typeof service.register !== "function") {
            shortcutState.registration = "unavailable";
            return;
          }
          try {
            attachShortcuts(service);
            shortcutState.registration = "ok";
            shortcutState.error = null;
          } catch (error) {
            shortcutState.registration = "failed";
            shortcutState.error = error instanceof Error ? error.message : String(error);
          }
        }

        var shortcuts = ctx.get("shortcuts");
        if (shortcuts !== undefined && shortcuts !== null) {
          shortcutState.service = "present";
          tryAttach(shortcuts);
        } else {
          ctx.inject(["shortcuts"], function (scope) {
            var deferred = scope.get("shortcuts");
            if (deferred === undefined || deferred === null) deferred = scope.shortcuts;
            shortcutState.service = "deferred";
            tryAttach(deferred);
          });
        }

        // (f) Page-level fallback for the two open gestures. The shortcuts
        // service is the primary dispatcher, but on Desktop it routes entirely
        // through the native keyboard bridge: if that bridge is absent, or the
        // command never registered, the failure is silent and the page still
        // sees the key. A key the real dispatcher handled is either already
        // `defaultPrevented` (Web) or never reaches the page (Desktop), so this
        // listener cannot double-fire.
        function fallbackGesture(event) {
          if (event.defaultPrevented === true || event.isComposing === true || event.altKey === true || event.repeat === true) return;
          var isStepKey = event.code === "F3" || event.key === "F3";
          var isFindKey = event.code === "KeyF" || event.key === "f" || event.key === "F";
          if (!isStepKey && !isFindKey) return;
          if (document.querySelector("[aria-modal='true']") !== null) return;
          if (isStepKey) {
            // F3 cannot be a service default (it has no modifier), so stepping
            // lives here. Only when the find bar is open: otherwise F3 belongs
            // to whatever else the user is doing.
            if (rt.store.get().open !== true) return;
            event.preventDefault();
            rt.stepAndJump(event.shiftKey === true ? -1 : 1);
            return;
          }
          if (event.ctrlKey !== true && event.metaKey !== true) return;
          event.preventDefault();
          if (event.shiftKey === true) {
            rt.openFind("global", rt.store.get().lastSessionId);
            rt.store.set({ open: true });
          } else {
            rt.openFind("session", rt.store.get().lastSessionId);
          }
        }
        window.addEventListener("keydown", fallbackGesture, false);
        yield function () {
          window.removeEventListener("keydown", fallbackGesture, false);
        };

        // (g) Failure diagnostics. Only a registration that did not succeed is
        // worth a line in the Host log: with `registration: "ok"` the shortcut
        // service owns dispatch and the page fallback sits idle, so the normal
        // path stays write-free. The Host route reloads on its own schedule, so
        // a rejected call is retried a few times before giving up.
        var diagTimer = null;
        var diagAttempts = 0;
        function scheduleDiagnostics() {
          if (shortcutState.registration === "ok") return;
          if (diagTimer !== null || diagAttempts >= 4) return;
          diagAttempts += 1;
          diagTimer = setTimeout(reportDiagnostics, 1500);
        }
        function reportDiagnostics() {
          diagTimer = null;
          try {
            var connectionService = typeof ctx.get === "function" ? ctx.get("connection") : undefined;
            if (connectionService === undefined || connectionService === null) connectionService = ctx.connection;
            if (connectionService === undefined || connectionService === null || connectionService.rpc === undefined) return;
            var desktop = globalThis.dshDesktop;
            var pending = connectionService.rpc.call(CHANNEL, "diag", {
              service: shortcutState.service,
              registration: shortcutState.registration,
              error: shortcutState.error,
              nativeBridge: desktop !== undefined && desktop !== null && desktop.keyboard !== undefined ? "present" : "missing",
              runtime: desktop !== undefined && desktop !== null ? "desktop" : "web",
              userAgent: typeof navigator !== "undefined" ? String(navigator.userAgent) : ""
            });
            if (pending !== null && pending !== undefined && typeof pending.catch === "function") {
              pending.catch(function () {
                scheduleDiagnostics();
              });
            }
          } catch (error) {
            /* diagnostics must never break the UI */
          }
        }
        scheduleDiagnostics();
        yield function () {
          if (diagTimer !== null) clearTimeout(diagTimer);
        };
      }, "dsh-find-session: client");
    }

    module.exports = { name: name, inject: inject, apply: apply };
    return module.exports;
  }
});
