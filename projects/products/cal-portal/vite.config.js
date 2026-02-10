import { defineConfig } from 'vite'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'

// Proxy the Clawdbot Gateway so Cal Portal can call it without CORS issues.
// This keeps requests same-origin (http://127.0.0.1:517x) and forwards to the OpenClaw gateway.
export default defineConfig(() => {
  // Simple build stamp so the UI can always show "yes, you’re on the updated build".
  // We keep it deterministic + local-first (no network calls).
  const git = process.env.GIT_COMMIT || 'dev'
  const builtAt = process.env.BUILD_AT || new Date().toISOString()

  const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw')
  const OPENCLAW_CFG = path.join(OPENCLAW_DIR, 'openclaw.json')
  const OPENCLAW_SESSIONS = path.join(OPENCLAW_DIR, 'agents', 'main', 'sessions', 'sessions.json')

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

  async function gatewayHealth() {
    try {
      const r = await fetch('http://127.0.0.1:19001/health', { method: 'GET' })
      return { ok: r.ok, status: r.status }
    } catch (e) {
      return { ok: false, status: null, error: String(e?.message || e) }
    }
  }

  function getGatewayTokenFromConfig() {
    const cfg = readJsonSafe(OPENCLAW_CFG)
    const token = cfg?.gateway?.auth?.token
    if (!token || typeof token !== 'string') return null
    return token
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

  const modelsCache = {
    ts: 0,
    inFlight: false,
    value: null,
  }

  function runOpenclaw(args) {
    return new Promise((resolve) => {
      execFile('openclaw', args, { timeout: 15000 }, (err, stdout, stderr) => {
        resolve({
          ok: !err,
          code: err?.code ?? 0,
          stdout: (stdout || '').toString(),
          stderr: (stderr || '').toString(),
        })
      })
    })
  }

  return {
    define: {
      __CAL_PORTAL_BUILD__: JSON.stringify({ git, builtAt }),
    },
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
                const gw = await gatewayHealth()
                return json(res, 200, {
                  ok: true,
                  now,
                  gateway: gw,
                  sessionsPath: OPENCLAW_SESSIONS,
                  sessions,
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

              if (url.pathname === '/ops/gateway/restart' && req.method === 'POST') {
                const out = await runOpenclaw(['gateway', 'restart'])
                return json(res, 200, { ok: out.ok, code: out.code, stdout: out.stdout, stderr: out.stderr })
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
