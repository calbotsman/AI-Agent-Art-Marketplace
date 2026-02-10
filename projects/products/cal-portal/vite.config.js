import { defineConfig } from 'vite'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { spawn } from 'node:child_process'

// Proxy the Clawdbot Gateway so Cal Portal can call it without CORS issues.
// This keeps requests same-origin (http://127.0.0.1:517x) and forwards to the OpenClaw gateway.
export default defineConfig(() => {
  // Simple build stamp so the UI can always show "yes, you’re on the updated build".
  // We keep it deterministic + local-first (no network calls).
  const git = process.env.GIT_COMMIT || 'dev'
  const builtAt = process.env.BUILD_AT || new Date().toISOString()

  const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw')
  const OPENCLAW_DEV_DIR = path.join(os.homedir(), '.openclaw-dev')
  const OPENCLAW_CFG = path.join(OPENCLAW_DIR, 'openclaw.json')
  const OPENCLAW_SESSIONS = path.join(OPENCLAW_DIR, 'agents', 'main', 'sessions', 'sessions.json')
  const OPENCLAW_WORKSPACE_DIR = path.join(OPENCLAW_DIR, 'workspace')
  const THEATRE_DIR = path.join(OPENCLAW_WORKSPACE_DIR, 'theatre')
  const THEATRE_EVENTS = path.join(THEATRE_DIR, 'events.ndjson')

  // Roster should not depend on "sessions exist". Read installed agents from disk.
  const AGENT_DIRS = [
    { source: 'openclaw', dir: path.join(OPENCLAW_DIR, 'agents') },
    { source: 'openclaw-dev', dir: path.join(OPENCLAW_DEV_DIR, 'agents') },
  ]

  function json(res, status, data) {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
  }

  function readJsonSafe(p) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'))
    } catch {
      return null
    }
  }

  function ensureDir(p) {
    try {
      fs.mkdirSync(p, { recursive: true })
    } catch {
      // ignore
    }
  }

  function readFileSafe(p) {
    try {
      return fs.readFileSync(p, 'utf8')
    } catch {
      return ''
    }
  }

  function getGatewayTokenPairFromConfig() {
    const cfg = readJsonSafe(OPENCLAW_CFG)
    const auth = cfg?.gateway?.auth?.token
    const remote = cfg?.gateway?.remote?.token
    return { auth: typeof auth === 'string' ? auth : '', remote: typeof remote === 'string' ? remote : '' }
  }

  function ensureGatewayTokenCoherent() {
    // Fix the most common break: gateway token mismatch (remote.token != auth.token).
    // Never rotate tokens automatically here.
    const cfg = readJsonSafe(OPENCLAW_CFG)
    const auth = cfg?.gateway?.auth?.token
    if (!auth || typeof auth !== 'string') return { ok: false, changed: false }
    const before = cfg?.gateway?.remote?.token
    if (before === auth) return { ok: true, changed: false }
    try {
      cfg.gateway.remote = cfg.gateway.remote || {}
      cfg.gateway.remote.token = auth
      fs.writeFileSync(OPENCLAW_CFG, JSON.stringify(cfg, null, 2) + '\n')
      return { ok: true, changed: true }
    } catch {
      return { ok: false, changed: false }
    }
  }

  async function gatewayHealthWs() {
    // NOTE: http://127.0.0.1:19001/health is served by OpenClaw Control’s UI and can return HTTP 200 even when the gateway is broken.
    const listening = await isPortListening('127.0.0.1', 19001, 350)
    if (!listening) return { ok: false, detail: 'port 19001 closed' }

    const p = await runOpenclaw(['gateway', 'health', '--url', 'ws://127.0.0.1:19001', '--json'], 4500)
    return { ok: p.ok, detail: (p.stderr || p.stdout || '').trim().slice(0, 400) }
  }

  function isPortListening(host, port, timeoutMs = 400) {
    return new Promise((resolve) => {
      let done = false
      const finish = (v) => {
        if (done) return
        done = true
        resolve(v)
      }

      const sock = net.createConnection({ host, port })
      sock.on('connect', () => {
        try { sock.destroy() } catch {}
        finish(true)
      })
      sock.on('error', () => finish(false))
      sock.setTimeout(timeoutMs, () => finish(false))
    })
  }

  async function killPort19001() {
    return new Promise((resolve) => {
      execFile('lsof', ['-tiTCP:19001', '-sTCP:LISTEN'], { timeout: 2000 }, (err, stdout) => {
        const pid = String(stdout || '').trim().split('\n').filter(Boolean)[0] || ''
        if (!pid) return resolve({ ok: true, pid: null })
        execFile('kill', ['-9', pid], { timeout: 2000 }, () => resolve({ ok: true, pid }))
      })
    })
  }

  let lastGatewaySpawnAt = 0
  async function ensureGatewayRunning() {
    // Best-effort self-heal: if the gateway isn't reachable, try starting it.
    // This avoids manual "paste token / click connect" loops.
    const fix = ensureGatewayTokenCoherent()

    const healthy = await gatewayHealthWs()
    if (healthy.ok) return { ok: true, healthy: true, fixedToken: fix.changed, action: 'noop', detail: healthy.detail }

    // Avoid tight spawn loops.
    const now = Date.now()
    if ((now - lastGatewaySpawnAt) < 5000) {
      return { ok: false, healthy: false, fixedToken: fix.changed, action: 'throttle', error: healthy.detail || 'gateway unhealthy' }
    }
    lastGatewaySpawnAt = now

    try {
      // If something is holding the port but the gateway is unhealthy, clear it so we can self-heal.
      await killPort19001()

      const child = spawn(
        'openclaw',
        ['gateway', 'run', '--bind', 'loopback', '--port', '19001', '--force'],
        { detached: true, stdio: 'ignore' },
      )
      child.unref()
    } catch (e) {
      return { ok: false, healthy: false, fixedToken: fix.changed, action: 'spawn-failed', error: String(e?.message || e) }
    }

    // Wait briefly for the gateway to come up.
    const deadline = Date.now() + 3500
    while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 250))
      // eslint-disable-next-line no-await-in-loop
      const h = await gatewayHealthWs()
      if (h.ok) return { ok: true, healthy: true, fixedToken: fix.changed, action: 'spawned', detail: h.detail }
    }

    return { ok: false, healthy: false, fixedToken: fix.changed, action: 'spawned-timeout' }
  }

  function getGatewayTokenFromConfig() {
    const { auth } = getGatewayTokenPairFromConfig()
    return auth || null
  }

  function loadSessions() {
    const raw = readJsonSafe(OPENCLAW_SESSIONS)
    if (!raw || typeof raw !== 'object') return []

    const sessions = Object.entries(raw).map(([key, v]) => {
      const updatedAt = v?.updatedAt || v?.updated_at || null
      const updatedMs =
        typeof updatedAt === 'number'
          ? updatedAt
          : (typeof updatedAt === 'string' ? Date.parse(updatedAt) : null)
      return {
        key,
        sessionId: v?.sessionId || v?.session_id || null,
        agentId: v?.agentId || v?.agent_id || v?.agent || v?.agentName || v?.agent_name || null,
        channel: v?.channel || null,
        modelProvider: v?.modelProvider || v?.model_provider || null,
        model: v?.model || null,
        contextTokens: v?.contextTokens ?? v?.context_tokens ?? null,
        totalTokens: v?.totalTokens ?? v?.total_tokens ?? null,
        updatedAt,
        updatedMs,
        abortedLastRun: Boolean(v?.abortedLastRun ?? v?.aborted_last_run ?? false),
      }
    })

    sessions.sort((a, b) => (b.updatedMs || 0) - (a.updatedMs || 0))
    return sessions
  }

  function loadAgentRoster() {
    const agents = []
    for (const entry of AGENT_DIRS) {
      try {
        const names = fs.readdirSync(entry.dir, { withFileTypes: true })
        for (const d of names) {
          if (!d.isDirectory()) continue
          const id = d.name
          if (!id || id.startsWith('.')) continue
          agents.push({ id, source: entry.source, dir: path.join(entry.dir, id) })
        }
      } catch {
        // ignore missing dirs
      }
    }

    // stable ordering, de-dupe by id (prefer non-dev if both exist)
    const map = new Map()
    for (const a of agents) {
      if (!map.has(a.id) || (map.get(a.id)?.source === 'openclaw-dev' && a.source === 'openclaw')) {
        map.set(a.id, a)
      }
    }

    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id))
  }

  const modelsCache = {
    ts: 0,
    inFlight: false,
    value: null,
  }

  function runOpenclaw(args, timeoutMs = 15000) {
    return new Promise((resolve) => {
      execFile('openclaw', args, { timeout: timeoutMs }, (err, stdout, stderr) => {
        resolve({
          ok: !err,
          code: err?.code ?? 0,
          stdout: (stdout || '').toString(),
          stderr: (stderr || '').toString(),
        })
      })
    })
  }

  // ---------------- Theatre event spine (local-only) ----------------
  ensureDir(THEATRE_DIR)

  let theatreLastId = 0
  try {
    const txt = readFileSafe(THEATRE_EVENTS)
    const lines = txt.trim().split('\n').filter(Boolean)
    const last = lines.length ? JSON.parse(lines[lines.length - 1]) : null
    if (last && typeof last.id === 'number') theatreLastId = last.id
  } catch {
    theatreLastId = 0
  }

  function appendTheatreEvent(input) {
    const now = Date.now()
    const ev = {
      id: ++theatreLastId,
      ts: now,
      runId: input?.runId ?? null,
      agentId: input?.agentId ?? null,
      stepId: input?.stepId ?? null,
      type: String(input?.type || '').trim(),
      payload: input?.payload ?? {},
    }
    if (!ev.type) throw new Error('missing event.type')

    fs.appendFileSync(THEATRE_EVENTS, JSON.stringify(ev) + '\n')
    return ev
  }

  function readTheatreEvents(afterId, limit = 500) {
    const txt = readFileSafe(THEATRE_EVENTS)
    const lines = txt.split('\n').filter(Boolean)
    const out = []
    for (let i = Math.max(0, lines.length - 20000); i < lines.length; i++) {
      try {
        const ev = JSON.parse(lines[i])
        if (typeof ev?.id !== 'number') continue
        if (ev.id <= afterId) continue
        out.push(ev)
        if (out.length >= limit) break
      } catch {
        // ignore bad lines
      }
    }
    return out
  }

  return {
    define: {
      __CAL_PORTAL_BUILD__: JSON.stringify({ git, builtAt }),
    },
    // Vite writes cache files by default under node_modules/.vite, which is
    // blocked in this sandboxed environment. Keep cache in the project root.
    cacheDir: '.vite-cache',
    plugins: [
      {
        name: 'cal-portal-openclaw-ops',
        configureServer(server) {
          // Local-only ops API for Cal Portal. Not intended for deployment without hardening.
          server.middlewares.use(async (req, res, next) => {
            try {
              if (!req.url) return next()
              const url = new URL(req.url, 'http://127.0.0.1')

              if (url.pathname === '/ops/status' && req.method === 'GET') {
                const now = Date.now()
                const activeWindowMs = 2 * 60 * 1000
                const sessions = loadSessions().map((s) => ({
                  ...s,
                  active: Boolean(s.updatedMs && (now - s.updatedMs) < activeWindowMs),
                }))
                const gw = await gatewayHealthWs()
                return json(res, 200, {
                  ok: true,
                  now,
                  gateway: { ok: Boolean(gw.ok), detail: gw.detail || '' },
                  sessionsPath: OPENCLAW_SESSIONS,
                  sessions,
                })
              }

              if (url.pathname === '/ops/agents' && req.method === 'GET') {
                const agents = loadAgentRoster()
                return json(res, 200, {
                  ok: true,
                  agentDirs: AGENT_DIRS,
                  agents,
                })
              }

              if (url.pathname === '/ops/models' && req.method === 'GET') {
                const now = Date.now()
                const maxAgeMs = 60_000
                const forceFresh = url.searchParams.get('fresh') === '1'

                if (!forceFresh && modelsCache.value && (now - modelsCache.ts) < maxAgeMs) {
                  return json(res, 200, { ok: true, cached: true, ...modelsCache.value })
                }

                if (!forceFresh && modelsCache.inFlight) {
                  return json(res, 202, { ok: true, cached: true, pending: true, ...modelsCache.value })
                }

                // Refresh cache (may take a few seconds due to doctor warnings).
                modelsCache.inFlight = true
                const out = await runOpenclaw(['models', 'list'])
                modelsCache.inFlight = false
                modelsCache.ts = now
                modelsCache.value = { ok: out.ok, code: out.code, stdout: out.stdout, stderr: out.stderr }
                return json(res, 200, { cached: false, ...modelsCache.value })
              }

              if (url.pathname === '/ops/gateway-token' && req.method === 'GET') {
                // Local convenience: returns the current gateway token from ~/.openclaw/openclaw.json.
                // Keep this endpoint local-only. If you deploy Cal Portal, remove this or protect it.
                const token = getGatewayTokenFromConfig()
                if (!token) return json(res, 404, { ok: false, error: 'No gateway token found in ~/.openclaw/openclaw.json' })
                return json(res, 200, { ok: true, token })
              }

              if (url.pathname === '/ops/gateway/ensure' && req.method === 'POST') {
                const out = await ensureGatewayRunning()
                return json(res, 200, {
                  ok: true,
                  healthy: Boolean(out.ok),
                  fixedToken: Boolean(out.fixedToken),
                  action: out.action || '',
                  detail: out.detail || out.error || '',
                })
              }

              if (url.pathname === '/ops/gateway/restart' && req.method === 'POST') {
                const out = await runOpenclaw(['gateway', 'restart'])
                return json(res, 200, { ok: out.ok, code: out.code, stdout: out.stdout, stderr: out.stderr })
              }

              if (url.pathname === '/ops/theatre/snapshot' && req.method === 'GET') {
                const now = Date.now()
                const agents = loadAgentRoster()
                const sessions = loadSessions()
                return json(res, 200, {
                  ok: true,
                  now,
                  lastEventId: theatreLastId,
                  agents,
                  sessions,
                })
              }

              if (url.pathname === '/ops/theatre/events' && req.method === 'GET') {
                const after = Number(url.searchParams.get('after') || '0')
                const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') || '500')))
                const events = readTheatreEvents(Number.isFinite(after) ? after : 0, limit)
                return json(res, 200, { ok: true, after: Number.isFinite(after) ? after : 0, lastEventId: theatreLastId, events })
              }

              if (url.pathname === '/ops/theatre/events' && req.method === 'POST') {
                let raw = ''
                req.on('data', (c) => { raw += c })
                req.on('end', () => {
                  try {
                    const input = raw ? JSON.parse(raw) : {}
                    const ev = appendTheatreEvent(input)
                    return json(res, 200, { ok: true, event: ev })
                  } catch (e) {
                    return json(res, 400, { ok: false, error: String(e?.message || e) })
                  }
                })
                return
              }

              return next()
            } catch (e) {
              return json(res, 500, { ok: false, error: String(e?.message || e) })
            }
          })
        },
      },
    ],
    server: {
      // Stable fixed port for Cal Portal.
      // strictPort=true makes Vite fail if 5174 is already in use (instead of auto-choosing another port).
      port: 5174,
      strictPort: true,
      // Bind explicitly to IPv4 loopback. On some macOS setups, localhost resolves to ::1
      // and the server can end up reachable only over IPv6, which is confusing in browsers.
      host: '127.0.0.1',
      proxy: {
        '/v1': {
          target: 'http://127.0.0.1:19001',
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  }
})
