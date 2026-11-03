/**
 * dsh-sim-folder — client half (v4).
 *
 * 文件夹式会话面板：只在自己的 sidecar 里记 sessionId → folderId 与手动顺序，
 * 不参与 DSH 的会话分组、不改 workspace 注册表。
 *
 * v4（2026-11-03 第四轮反馈）：
 *   1. 整个文件夹块都是放置区（原来只有标题条能放，新建的空文件夹几乎点不中）
 *   2. 已归档会话明显变淡 + 删除线 + 「已归档」小徽章
 */
window.__ModuleLoader__.load({
  id: 'dsh-sim-folder',
  factory: function (require) {
    var React = require('react')
    var h = React.createElement
    var useCallback = React.useCallback
    var useEffect = React.useEffect
    var useMemo = React.useMemo
    var useRef = React.useRef
    var useState = React.useState

    var PANEL_ID = 'sim-folder'
    var API = '/sim-folder/api'
    var LOOSE = '__loose__'

    var INTERNAL_1 = /^\[dsh-/
    var INTERNAL_2 = /^session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i
    var isInternalTitle = function (t) { return INTERNAL_1.test(t) || INTERNAL_2.test(t) }

    var CSS = [
      '.sf-root{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13px;padding:10px 12px;gap:8px;color:var(--dsw-alias-label-primary,#1f2937)}',
      '.sf-head{display:flex;align-items:center;gap:8px}',
      '.sf-title{flex:1;font-weight:600;font-size:14px}',
      '.sf-btn{border:1px solid var(--dsw-alias-border-l2,#d1d5db);background:transparent;color:inherit;border-radius:6px;padding:2px 9px;font-size:12px;cursor:pointer}',
      '.sf-btn:hover{border-color:var(--dsw-alias-brand-primary,#2563eb);color:var(--dsw-alias-brand-primary,#2563eb)}',
      '.sf-input{flex:1;min-width:80px;font-size:12px;padding:2px 6px;border:1px solid var(--dsw-alias-brand-primary,#2563eb);border-radius:6px;background:transparent;color:inherit}',
      '.sf-body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:6px}',
      '.sf-folder{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:8px;overflow:hidden;transition:box-shadow .12s}',
      '.sf-folder.sf-drop{border-color:var(--dsw-alias-brand-primary,#2563eb);box-shadow:0 0 0 2px rgba(37,99,235,.35) inset}',
      '.sf-fhead{display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:pointer;user-select:none;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.03))}',
      '.sf-caret{width:12px;color:var(--dsw-alias-label-secondary,#9ca3af)}',
      '.sf-fname{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sf-count{font-size:11px;color:var(--dsw-alias-label-secondary,#9ca3af)}',
      '.sf-mini{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#9ca3af);cursor:pointer;font-size:12px;line-height:1;padding:0 3px}',
      '.sf-mini:disabled{opacity:.3;cursor:default}',
      '.sf-mini:hover:not(:disabled){color:var(--dsw-alias-brand-primary,#2563eb)}',
      '.sf-x{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#9ca3af);cursor:pointer;font-size:14px;line-height:1;padding:0 4px}',
      '.sf-x:hover{color:#b91c1c}',
      '.sf-rows{min-height:26px}',
      '.sf-row{display:flex;align-items:center;gap:8px;padding:5px 8px 5px 26px;overflow:hidden}',
      '.sf-row:hover{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.04))}',
      '.sf-row.sf-over{box-shadow:inset 0 2px 0 var(--dsw-alias-brand-primary,#2563eb)}',
      '.sf-row.sf-archived{opacity:.45;background:repeating-linear-gradient(135deg,transparent,transparent 6px,rgba(0,0,0,.035) 6px,rgba(0,0,0,.035) 12px)}',
      '.sf-row.sf-archived .sf-rtitle{color:#9ca3af;text-decoration:line-through;font-style:italic}',
      '.sf-badge{font-size:10px;padding:0 5px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#d1d5db);color:var(--dsw-alias-label-secondary,#9ca3af);white-space:nowrap}',
      '.sf-rtitle{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}',
      '.sf-rtitle:hover{text-decoration:underline}',
      '.sf-sel{font-size:11px;max-width:110px;border:1px solid var(--dsw-alias-border-l2,#d1d5db);border-radius:6px;background:transparent;color:inherit;padding:1px 2px}',
      '.sf-empty{padding:6px 8px 6px 26px;font-size:12px;color:var(--dsw-alias-label-secondary,#9ca3af)}',
      '.sf-foot{font-size:11px;color:var(--dsw-alias-label-secondary,#9ca3af)}',
      '.sf-err{color:#b91c1c}',
      '.sf-menu{position:fixed;z-index:9999;min-width:150px;padding:4px;border:1px solid var(--dsw-alias-border-l2,#d1d5db);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 8px 24px rgba(0,0,0,.18)}',
      '.sf-mi{display:block;width:100%;text-align:left;border:none;background:transparent;color:inherit;font-size:12px;padding:5px 8px;border-radius:6px;cursor:pointer}',
      '.sf-mi:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.06))}',
      '.sf-mi:disabled{opacity:.45;cursor:default}',
    ].join('\n')

    function ensureCss() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-sim-folder]')) return
      var el = document.createElement('style')
      el.setAttribute('data-sim-folder', '')
      el.textContent = CSS
      document.head.appendChild(el)
    }

    function getState() {
      return fetch(API + '/list', { headers: { accept: 'application/json' } }).then(function (r) {
        if (!r.ok) throw new Error('list HTTP ' + r.status)
        return r.json()
      })
    }

    function putState(state) {
      return fetch(API + '/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(state),
      }).then(function (r) {
        if (!r.ok) throw new Error('save HTTP ' + r.status)
        return r.json()
      })
    }

    function toArray(snap) {
      if (!snap) return []
      if (Array.isArray(snap)) return snap
      if (Array.isArray(snap.items)) return snap.items
      if (Array.isArray(snap.sessions)) return snap.sessions
      if (snap.byId && typeof snap.byId === 'object') {
        var out = []
        Object.keys(snap.byId).forEach(function (k) { out.push(snap.byId[k]) })
        return out
      }
      return []
    }

    function pickId(s) { return (s && (s.sessionId || s.id || (s.session && s.session.sessionId))) || '' }
    function pickTitle(s) {
      if (!s) return ''
      return s.title || s.name || (s.summary && s.summary.title) || pickId(s)
    }
    function pickTime(s) {
      var t = (s && (s.updatedAt || s.lastActivityAt || s.createdAt)) || 0
      var n = typeof t === 'number' ? t : Date.parse(t)
      return Number.isFinite(n) ? n : 0
    }

    function archivedSet(workspaces) {
      var out = {}
      try {
        var snap = workspaces && workspaces.list && workspaces.list.getSnapshot ? workspaces.list.getSnapshot() : null
        var ids = snap && (snap.archivedSessionIds || (snap.global && snap.global.archivedSessionIds))
        if (Array.isArray(ids)) ids.forEach(function (id) { out[id] = true })
      } catch (e) {}
      return out
    }

    function Panel(props) {
      var open = props.open
      var sessions = props.sessions
      var workspaces = props.workspaces

      var [db, setDb] = useState({ folders: [], assign: {}, order: {}, alias: {} })
      var [list, setList] = useState([])
      var [arch, setArch] = useState({})
      var [err, setErr] = useState('')
      var [dropOn, setDropOn] = useState(null)
      var [overRow, setOverRow] = useState(null)
      var [hidden, setHidden] = useState(0)
      var [creating, setCreating] = useState(false)
      var [renaming, setRenaming] = useState(null)
      var [aliasEdit, setAliasEdit] = useState(null)
      var skipBlur = useRef(false)
      var [menu, setMenu] = useState(null)
      var dragId = useRef('')
      var lastSig = useRef('')
      var lastArchSig = useRef('')

      useEffect(function () {
        var alive = true
        getState().then(function (s) {
          if (!alive) return
          setDb({ folders: Array.isArray(s.folders) ? s.folders : [], assign: s.assign || {}, order: s.order || {}, alias: s.alias || {} })
          if (Array.isArray(s.archived) && s.archived.length) { var m = {}; s.archived.forEach(function (id) { m[id] = true }); var msig = s.archived.slice().sort().join('|'); if (msig !== lastArchSig.current) { lastArchSig.current = msig; setArch(m) } }
        }).catch(function (e) { if (alive) setErr(String((e && e.message) || e)) })
        return function () { alive = false }
      }, [])

      useEffect(function () {
        function pull() {
          try {
            var snap = sessions && sessions.list && sessions.list.getSnapshot ? sessions.list.getSnapshot() : null
            var seen = {}
            var arr = []
            var skipped = 0
            toArray(snap).forEach(function (s) {
              var id = pickId(s)
              if (!id || seen[id]) return
              var title = pickTitle(s)
              if (isInternalTitle(title)) { skipped += 1; return }
              seen[id] = true
              arr.push({ id: id, title: title, t: pickTime(s) })
            })
            arr.sort(function (a, b) { return b.t - a.t })
            var sig = arr.map(function (x) { return x.id + ':' + x.title }).join('|')
            if (sig !== lastSig.current) { lastSig.current = sig; setList(arr) }
            setHidden(skipped)
            var wsArch = archivedSet(workspaces)
            var archSig = Object.keys(wsArch).sort().join('|')
            if (archSig && archSig !== lastArchSig.current) { lastArchSig.current = archSig; setArch(wsArch) }
          } catch (e) { setErr('读取会话失败：' + String((e && e.message) || e)) }
        }
        pull()
        var timer = setInterval(pull, 1500)
        return function () { clearInterval(timer) }
      }, [sessions, workspaces])

      useEffect(function () {
        function close() { setMenu(null) }
        window.addEventListener('click', close)
        window.addEventListener('scroll', close, true)
        return function () {
          window.removeEventListener('click', close)
          window.removeEventListener('scroll', close, true)
        }
      }, [])

      var save = useCallback(function (next) {
        if (!next.alias) next = Object.assign({}, next, { alias: db.alias || {} })
        setDb(next)
        putState(next).then(function () { setErr('') }).catch(function (e) { setErr(String((e && e.message) || e)) })
      }, [db])

      var byFolder = useMemo(function () {
        var map = {}
        var loose = []
        db.folders.forEach(function (f) { map[f.id] = [] })
        list.forEach(function (row) {
          var fid = db.assign[row.id]
          if (fid && map[fid]) map[fid].push(row)
          else loose.push(row)
        })
        function sortBy(fid, rows) {
          var ord = db.order[fid] || []
          var rank = {}
          ord.forEach(function (id, i) { rank[id] = i })
          return rows.slice().sort(function (a, b) {
            var ra = rank[a.id] === undefined ? 1e9 : rank[a.id]
            var rb = rank[b.id] === undefined ? 1e9 : rank[b.id]
            if (ra !== rb) return ra - rb
            return b.t - a.t
          })
        }
        Object.keys(map).forEach(function (k) { map[k] = sortBy(k, map[k]) })
        return { map: map, loose: sortBy(LOOSE, loose) }
      }, [db, list])

      function addFolder(name) {
        var id = 'f' + Date.now().toString(36)
        save({ folders: db.folders.concat([{ id: id, name: name.slice(0, 80), collapsed: false }]), assign: db.assign, order: db.order, alias: db.alias })
        setCreating(false)
      }

      function renameFolder(f, name) {
        save({
          folders: db.folders.map(function (x) { return x.id === f.id ? { id: x.id, name: name.slice(0, 80), collapsed: x.collapsed } : x }),
          assign: db.assign, order: db.order,
        })
        setRenaming(null)
      }

      function removeFolder(f) {
        var n = (byFolder.map[f.id] || []).length
        if (!window.confirm('删除文件夹「' + f.name + '」？\n里面 ' + n + ' 条会话会自动回到「未分类」，会话本身不会被删除。')) return
        var assign = {}
        Object.keys(db.assign).forEach(function (k) { if (db.assign[k] !== f.id) assign[k] = db.assign[k] })
        var order = {}
        Object.keys(db.order).forEach(function (k) { if (k !== f.id) order[k] = db.order[k] })
        save({ folders: db.folders.filter(function (x) { return x.id !== f.id }), assign: assign, order: order })
      }

      function toggleFolder(f) {
        save({
          folders: db.folders.map(function (x) { return x.id === f.id ? { id: x.id, name: x.name, collapsed: !x.collapsed } : x }),
          assign: db.assign, order: db.order,
        })
      }

      function moveFolder(f, delta) {
        var idx = -1
        db.folders.forEach(function (x, i) { if (x.id === f.id) idx = i })
        var j = idx + delta
        if (idx < 0 || j < 0 || j >= db.folders.length) return
        var copy = db.folders.slice()
        var tmp = copy[idx]; copy[idx] = copy[j]; copy[j] = tmp
        save({ folders: copy, assign: db.assign, order: db.order })
      }

      function aliasOf(r) { return (db.alias && db.alias[r.id]) || r.title }
      function setAlias(id, name) {
        var alias = Object.assign({}, db.alias || {})
        var v = name == null ? '' : String(name).trim().slice(0, 80)
        if (v) alias[id] = v
        else delete alias[id]
        save({ folders: db.folders, assign: db.assign, order: db.order, alias: alias })
      }

      function folderOf(sessionId) { return db.assign[sessionId] || LOOSE }

      function assignTo(sessionId, folderId) {
        var assign = {}
        Object.keys(db.assign).forEach(function (k) { assign[k] = db.assign[k] })
        if (folderId && folderId !== LOOSE) assign[sessionId] = folderId
        else delete assign[sessionId]
        save({ folders: db.folders, assign: assign, order: db.order })
      }

      function orderFor(fid) {
        var cur = db.order[fid] || []
        var ids = (fid === LOOSE ? byFolder.loose : (byFolder.map[fid] || [])).map(function (r) { return r.id })
        var out = cur.filter(function (id) { return ids.indexOf(id) >= 0 })
        ids.forEach(function (id) { if (out.indexOf(id) < 0) out.push(id) })
        return out
      }

      function insertBefore(fid, draggedId, targetId) {
        var arr = orderFor(fid)
        var from = arr.indexOf(draggedId)
        if (from >= 0) arr.splice(from, 1)
        var at = arr.indexOf(targetId)
        if (at < 0) arr.push(draggedId)
        else arr.splice(at, 0, draggedId)
        var order = {}
        Object.keys(db.order).forEach(function (k) { order[k] = db.order[k] })
        order[fid] = arr
        var assign = {}
        Object.keys(db.assign).forEach(function (k) { assign[k] = db.assign[k] })
        if (fid === LOOSE) delete assign[draggedId]
        else assign[draggedId] = fid
        save({ folders: db.folders, assign: assign, order: order })
      }

      function onDropFolder(folderId, event) {
        event.preventDefault(); event.stopPropagation()
        var sid = dragId.current || ''
        setDropOn(null)
        if (!sid) return
        var assign = {}
        Object.keys(db.assign).forEach(function (k) { assign[k] = db.assign[k] })
        if (folderId && folderId !== LOOSE) assign[sid] = folderId
        else delete assign[sid]
        var order = {}
        Object.keys(db.order).forEach(function (k) { order[k] = db.order[k] })
        var arr = (order[folderId] || []).filter(function (x) { return x !== sid })
        arr.push(sid)
        order[folderId] = arr
        save({ folders: db.folders, assign: assign, order: order })
      }

      function onDropRow(targetId, event) {
        event.preventDefault(); event.stopPropagation()
        var sid = dragId.current || ''
        setOverRow(null)
        if (!sid || sid === targetId) return
        insertBefore(folderOf(targetId), sid, targetId)
      }


      var menuNode = menu ? h('div', {
        className: 'sf-menu',
        style: { left: menu.x + 'px', top: menu.y + 'px' },
        onClick: function (e) { e.stopPropagation() },
      },
        h('button', {
          className: 'sf-mi',
          onClick: function () { try { navigator.clipboard.writeText(menu.id) } catch (e) {} setMenu(null) },
        }, '复制会话 ID'),
        h('button', {
          className: 'sf-mi',
          onClick: function () { setAliasEdit({ id: menu.id, value: menu.title || '' }); setMenu(null) },
        }, '重命名（别名）')
      ) : null

      function row(r) {
        var cur = folderOf(r.id)
        var opts = [h('option', { key: LOOSE, value: LOOSE }, '未分类')].concat(
          db.folders.map(function (f) { return h('option', { key: f.id, value: f.id }, f.name) })
        )
        var isArch = arch[r.id] === true
        return h('div', {
          key: r.id,
          className: 'sf-row' + (isArch ? ' sf-archived' : '') + (overRow === r.id ? ' sf-over' : ''),
          draggable: true,
          onDragStart: function (e) {
            dragId.current = r.id
            try { e.dataTransfer.setData('text/plain', r.id); e.dataTransfer.effectAllowed = 'move' } catch (err) {}
          },
          onDragOver: function (e) { e.preventDefault(); e.stopPropagation(); setOverRow(r.id) },
          onDragLeave: function () { setOverRow(null) },
          onDrop: function (e) { onDropRow(r.id, e) },
          onContextMenu: function (e) {
            e.preventDefault()
            setMenu({ x: e.clientX, y: e.clientY, id: r.id, archived: isArch, title: aliasOf(r) })
          },
        },
          aliasEdit && aliasEdit.id === r.id
            ? h('input', {
                className: 'sf-input', defaultValue: aliasOf(r), placeholder: '面板里显示的别名', autoFocus: true,
                onClick: function (e) { e.stopPropagation() },
                onKeyDown: function (e) {
                  if (e.key === 'Enter') { setAlias(r.id, e.target.value); setAliasEdit(null) }
                  if (e.key === 'Escape') { skipBlur.current = true; setAliasEdit(null) }
                },
                onBlur: function (e) { if (skipBlur.current) { skipBlur.current = false; return } setAlias(r.id, e.target.value); setAliasEdit(null) },
              })
            : h('span', {
                className: 'sf-rtitle', title: aliasOf(r),
                onClick: function () { if (typeof open === 'function') open(r.id) },
              }, aliasOf(r)),
          isArch ? h('span', { className: 'sf-badge' }, '已归档') : null,
          h('select', {
            className: 'sf-sel', title: '移动到文件夹', value: cur,
            onClick: function (e) { e.stopPropagation() },
            onChange: function (e) { assignTo(r.id, e.target.value) },
          }, opts)
        )
      }

      function folderBlock(f, index) {
        var rows = byFolder.map[f.id] || []
        var head = renaming === f.id
          ? h('div', { className: 'sf-fhead' },
              h('span', { className: 'sf-caret' }, f.collapsed ? '▸' : '▾'),
              h('input', {
                className: 'sf-input', defaultValue: f.name, autoFocus: true,
                onKeyDown: function (e) {
                  if (e.key === 'Enter') renameFolder(f, e.target.value.trim() || f.name)
                  if (e.key === 'Escape') { skipBlur.current = true; setRenaming(null) }
                },
                onBlur: function (e) { if (skipBlur.current) { skipBlur.current = false; return } renameFolder(f, e.target.value.trim() || f.name) },
              }))
          : h('div', {
              className: 'sf-fhead',
              onClick: function () { toggleFolder(f) },
              onDoubleClick: function (e) { e.stopPropagation(); setRenaming(f.id) },
            },
              h('span', { className: 'sf-caret' }, f.collapsed ? '▸' : '▾'),
              h('span', { className: 'sf-fname' }, f.name),
              h('span', { className: 'sf-count' }, String(rows.length)),
              h('button', { className: 'sf-mini', title: '上移', disabled: index === 0, onClick: function (e) { e.stopPropagation(); moveFolder(f, -1) } }, '▲'),
              h('button', { className: 'sf-mini', title: '下移', disabled: index === db.folders.length - 1, onClick: function (e) { e.stopPropagation(); moveFolder(f, 1) } }, '▼'),
              h('button', { className: 'sf-x', title: '删除文件夹（会话回到未分类）', onClick: function (e) { e.stopPropagation(); removeFolder(f) } }, '×')
            )

        return h('div', {
          key: f.id,
          className: 'sf-folder' + (dropOn === f.id ? ' sf-drop' : ''),
          onDragOver: function (e) { e.preventDefault(); setDropOn(f.id) },
          onDragLeave: function (e) { if (!e.currentTarget.contains(e.relatedTarget)) setDropOn(null) },
          onDrop: function (e) { onDropFolder(f.id, e) },
        },
          head,
          f.collapsed ? null : h('div', { className: 'sf-rows' },
            rows.length ? rows.map(row) : h('div', { className: 'sf-empty' }, '把会话拖进来，或用右侧下拉选它')
          )
        )
      }

      var looseBlock = h('div', {
        key: '__loose',
        className: 'sf-folder' + (dropOn === LOOSE ? ' sf-drop' : ''),
        onDragOver: function (e) { e.preventDefault(); setDropOn(LOOSE) },
        onDragLeave: function (e) { if (!e.currentTarget.contains(e.relatedTarget)) setDropOn(null) },
        onDrop: function (e) { onDropFolder(LOOSE, e) },
      },
        h('div', { className: 'sf-fhead' },
          h('span', { className: 'sf-caret' }, '·'),
          h('span', { className: 'sf-fname' }, '未分类'),
          h('span', { className: 'sf-count' }, String(byFolder.loose.length)),
        ),
        h('div', { className: 'sf-rows' }, byFolder.loose.map(row))
      )

      return h('div', { className: 'sf-root' },
        h('div', { className: 'sf-head' },
          h('span', { className: 'sf-title' }, '会话文件夹'),
          creating
            ? h('input', {
                className: 'sf-input', placeholder: '文件夹名，回车确认', autoFocus: true,
                onKeyDown: function (e) {
                  if (e.key === 'Enter') { var v = e.target.value.trim(); if (v) addFolder(v) }
                  if (e.key === 'Escape') setCreating(false)
                },
                onBlur: function (e) { var v = e.target.value.trim(); if (v) addFolder(v); else setCreating(false) },
              })
            : h('button', { className: 'sf-btn', onClick: function () { setCreating(true) } }, '+ 文件夹'),
          h('button', {
            className: 'sf-btn', title: '重新读取',
            onClick: function () {
              getState().then(function (s) {
                setDb({ folders: s.folders || [], assign: s.assign || {}, order: s.order || {}, alias: s.alias || {} })
              }).catch(function (e) { setErr(String((e && e.message) || e)) })
            },
          }, '⟳'),
        ),
        h('div', { className: 'sf-body' }, db.folders.map(folderBlock), looseBlock),
        h('div', { className: 'sf-foot' + (err ? ' sf-err' : '') },
          err ? err : ('显示 ' + list.length + ' 条会话（已隐藏 ' + hidden + ' 条内部派生会话）· ' + db.folders.length + ' 个文件夹 · 拖到某行＝插到它前面，拖到文件夹任意位置＝放进去'),
        ),
        menuNode
      )
    }

    function Entry(props) {
      var size = typeof props.size === 'number' ? props.size : 18
      return h('span', {
        title: '会话文件夹',
        style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.78) + 'px', lineHeight: 1 },
      }, '📁')
    }

    function apply(ctx) {
      ensureCss()

      var openSession = function (id) {
        try {
          var api = ctx && typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : null
          var fn = api && api.openSession
          if (typeof fn === 'function') { fn.call(api, id); return }
        } catch (e) {}
        try {
          var alt = ctx && ctx.uiWorkspace
          if (alt && typeof alt.openSession === 'function') { alt.openSession(id); return }
        } catch (e) {}
        console.warn('[sim-folder] 找不到打开会话的接口')
      }



      ctx.slots.inject('main', function () {
        return ctx.slots.inject('sidebar.panellist', function () {
          var stopMain = ctx.slots.register({
            name: 'main',
            key: PANEL_ID,
            inject: function () { return { sessions: ctx.sessions, workspaces: ctx.workspaces, open: openSession } },
          }, Panel)

          var stopEntry = ctx.slots.register({
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 40,
            label: function () { return '会话文件夹' },
          }, Entry)

          return function () {
            try { stopMain && stopMain() } catch (e) {}
            try { stopEntry && stopEntry() } catch (e) {}
          }
        })
      })
    }

    return { inject: ['slots', 'sessions', 'workspaces', 'layout'], apply: apply }
  },
})