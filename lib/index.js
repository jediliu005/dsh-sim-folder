/**
 * dsh-sim-folder — host half (v3).
 *
 * 只存一份 sidecar：$DSH_HOME/sim-folder.json
 *   { folders: [{id,name,collapsed}], assign: {sessionId: folderId}, order: {folderId: [sessionId...]} }
 * 绝不读写 workspace 注册表、会话存储、任何会话的 cwd —— DSH 自己的会话分组不受影响。
 */
import fs from 'node:fs'
import path from 'node:path'

const NAME = 'dsh-sim-folder'
const HOME = process.env.USERPROFILE || process.env.HOME || '.'
const FILE = path.join(HOME, '.dsh', 'sim-folder.json')

const blank = () => ({ folders: [], assign: {}, order: {}, alias: {} })

function readState() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    return normalize(raw)
  } catch {
    return blank()
  }
}

function normalize(input) {
  const folders = Array.isArray(input?.folders) ? input.folders : []
  const assign = input?.assign && typeof input.assign === 'object' && !Array.isArray(input.assign) ? input.assign : {}
  const order = input?.order && typeof input.order === 'object' && !Array.isArray(input.order) ? input.order : {}

  const seen = new Set()
  const clean = []
  for (const f of folders) {
    if (!f || typeof f.id !== 'string' || typeof f.name !== 'string') continue
    const id = f.id.slice(0, 80)
    const name = f.name.trim().slice(0, 80)
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    clean.push({ id, name, collapsed: f.collapsed === true })
  }

  const ids = new Set(clean.map((f) => f.id))
  const map = {}
  for (const [session, folder] of Object.entries(assign)) {
    if (typeof session !== 'string' || typeof folder !== 'string') continue
    if (ids.has(folder)) map[session] = folder
  }

  const ord = {}
  for (const [folder, list] of Object.entries(order)) {
    if (folder !== '__loose__' && !ids.has(folder)) continue
    if (!Array.isArray(list)) continue
    const arr = []
    for (const id of list) {
      if (typeof id !== 'string' || arr.includes(id)) continue
      arr.push(id.slice(0, 120))
      if (arr.length >= 5000) break
    }
    if (arr.length) ord[folder] = arr
  }

  const alias = {}
  const rawAlias = input?.alias && typeof input.alias === 'object' && !Array.isArray(input.alias) ? input.alias : {}
  for (const [session, name] of Object.entries(rawAlias)) {
    if (typeof session !== 'string' || typeof name !== 'string') continue
    const v = name.trim().slice(0, 80)
    if (v) alias[session] = v
  }

  return { folders: clean, assign: map, order: ord, alias }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  const tmp = `${FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8')
  fs.renameSync(tmp, FILE)
}


/** 只读 DSH 的 workspace 注册表，拿「哪些会话已归档」用来把行画灰。绝不写它。 */
function archivedSessionIds() {
  try {
    const file = path.join(HOME, '.dsh', 'storages', 'workspace.json')
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const ids = raw?.global?.archivedSessionIds
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}
function sendJson(res, code, body) {
  const text = JSON.stringify(body)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text),
  })
  res.end(text)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

export const name = NAME
export const inject = ['webServer']

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/sim-folder/api/list',
        handler: async (req, res) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method not allowed' })
          sendJson(res, 200, { ...readState(), archived: archivedSessionIds() })
        },
      }),
    `${NAME}: list`,
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/sim-folder/api/save',
        handler: async (req, res) => {
          if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
          try {
            const next = normalize(JSON.parse(await readBody(req)))
            writeState(next)
            sendJson(res, 200, { ok: true, state: next })
          } catch (error) {
            sendJson(res, 400, { error: String(error?.message ?? error) })
          }
        },
      }),
    `${NAME}: save`,
  )
}