import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.THEATRE_WS_PORT || 8787)

const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw')
const OPENCLAW_WORKSPACE_DIR = path.join(OPENCLAW_DIR, 'workspace')
const THEATRE_DIR = path.join(OPENCLAW_WORKSPACE_DIR, 'theatre')
const EVENTS_FILE = process.env.THEATRE_EVENTS_FILE || path.join(THEATRE_DIR, 'events.jsonl')

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }) } catch {}
}

ensureDir(THEATRE_DIR)

function readLinesSafe(p) {
  try {
    const txt = fs.readFileSync(p, 'utf8')
    return txt.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function appendLine(p, line) {
  fs.appendFileSync(p, line + '\n')
}

function parseEventLine(line) {
  const raw = JSON.parse(line)
  const type = String(raw?.type || '').trim()
  const payload = raw?.payload ?? {}
  if (!type) throw new Error('missing type')
  return { type, payload }
}

function loadExample() {
  const p = path.join(process.cwd(), 'public', 'events.example.jsonl')
  return readLinesSafe(p).map(parseEventLine)
}

function snapshot() {
  // Minimal snapshot. Client is responsible for reducing.
  return { ok: true, now: Date.now() }
}

function broadcast(wss, msg) {
  const data = JSON.stringify(msg)
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(data)
  }
}

let wss = null
try {
  wss = new WebSocketServer({ port: PORT })
} catch (err) {
  // Very rare (most listen errors are async), but keep dev UX stable.
  if (err?.code === 'EADDRINUSE') {
    console.warn(`[theatre-ws] port ${PORT} already in use; assuming theatre-ws is already running`)
    process.exit(0)
  }
  throw err
}

wss.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.warn(`[theatre-ws] port ${PORT} already in use; assuming theatre-ws is already running`)
    process.exit(0)
  }
  console.error('[theatre-ws] fatal error:', err?.stack || err)
  process.exit(1)
})

console.log(`[theatre-ws] listening on ws://127.0.0.1:${PORT} (events file: ${EVENTS_FILE})`)

wss.on('connection', (ws, req) => {
  ws.send(JSON.stringify({ type: 'snapshot', payload: snapshot() }))

  ws.on('message', (buf) => {
    let msg = null
    try { msg = JSON.parse(String(buf || '')) } catch { return }

    // Client can ask to replay the bundled example events.
    if (msg?.type === 'mock.start') {
      const speed = Number(msg?.payload?.speedMs || 550)
      const events = loadExample()
      let i = 0
      const t = setInterval(() => {
        if (ws.readyState !== 1) return clearInterval(t)
        if (i >= events.length) return clearInterval(t)
        ws.send(JSON.stringify({ type: 'event', payload: events[i++] }))
      }, Math.max(50, speed))
      return
    }

    // Accept externally-produced events (for wiring to OpenClaw later).
    if (msg?.type === 'event' && msg?.payload?.type) {
      const ev = { type: String(msg.payload.type), payload: msg.payload.payload ?? {} }
      // Persist without secrets; this is for replay/debug.
      appendLine(EVENTS_FILE, JSON.stringify(ev))
      broadcast(wss, { type: 'event', payload: ev })
    }
  })
})
