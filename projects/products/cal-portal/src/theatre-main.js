import './style.css'
import './portal.css'

import { initialTheatreState, reduceEvent } from './theatre/reducer.js'
import { TheatreScene } from './theatre/scene.js'
import { createMockRunner } from './theatre/mock.js'
import { createWsClient } from './theatre/ws-client.js'

// Theatre-first layout and styling.
document.body.dataset.app = 'theatre'

// Existing Cal Portal HTML has these anchors.
const elAgentDock = document.getElementById('agentDock')
const elStageOverlay = document.getElementById('stageOverlay')
const elStatus = document.getElementById('status')
const elLinkStatus = document.getElementById('linkStatus')
const elTheatreWsStatus = document.getElementById('theatreWsStatus')
const elBuildInfo = document.getElementById('buildInfo')
const elGatewayStatus = document.getElementById('gatewayStatus')
const elGatewayDot = document.getElementById('gatewayDot')

// Talk tray (keep a minimal ability to message Cal without the legacy portal JS).
const talkInput = document.getElementById('talkInput')
const btnTalkSend = document.getElementById('btnTalkSend')
const btnTalkClear = document.getElementById('btnTalkClear')
const btnCall = document.getElementById('btnCall')
const btnConnect = document.getElementById('btnConnect')

const gatewayUrlEl = document.getElementById('gatewayUrl')
const gatewayTokenEl = document.getElementById('gatewayToken')
const agentIdEl = document.getElementById('agentId')

const btnModeTalk = document.getElementById('btnModeTalk')
const btnModeOps = document.getElementById('btnModeOps')

// We keep the rest of the legacy UI around, but focus it on theatre/ops visibility.
const btnNewThread = document.getElementById('btnNewThread')
const btnOpenSettings = document.getElementById('btnOpenSettings')

const BUILD = (typeof __CAL_PORTAL_BUILD__ !== 'undefined')
  ? __CAL_PORTAL_BUILD__
  : { git: 'dev', builtAt: '' }

let theatre = initialTheatreState()

function setText(el, txt) {
  if (!el) return
  el.textContent = String(txt || '')
}

function setDot(el, ok) {
  if (!el) return
  el.style.background = ok ? '#34d399' : '#ef4444'
  el.style.opacity = '0.95'
}

function humanizeState(state) {
  const s = String(state || 'idle')
  switch (s) {
    case 'idle': return 'waiting'
    case 'thinking': return 'planning'
    case 'working': return 'building'
    case 'collaborating': return 'pairing'
    case 'spawning': return 'arriving'
    case 'blocked': return 'stuck'
    default: return s
  }
}

function jobTitleForRole(role, agentId) {
  const r = String(role || '').toLowerCase().trim()
  const id = String(agentId || '').toLowerCase().trim()
  const k = r || id
  if (!k) return ''
  if (k === 'main' || k.includes('cal')) return 'Director'
  if (k === 'pm' || k.includes('product')) return 'Producer'
  if (k === 'builder' || k.includes('dev') || k.includes('engineer')) return 'Engineer'
  if (k === 'ops' || k.includes('operator')) return 'Operator'
  if (k.includes('qa') || k.includes('verify')) return 'Verifier'
  if (k.includes('test')) return 'Tester'
  if (k.includes('design')) return 'Designer'
  if (k.includes('research')) return 'Researcher'
  return role ? role : agentId
}

function humanizeStepKind(kind) {
  const k = String(kind || '').toLowerCase()
  if (!k) return ''
  if (k.includes('plan')) return 'planning'
  if (k.includes('impl') || k.includes('build') || k.includes('dev')) return 'writing code'
  if (k.includes('verify') || k.includes('qa')) return 'checking work'
  if (k.includes('test')) return 'running tests'
  if (k.includes('pr')) return 'packaging a PR'
  if (k.includes('review')) return 'reviewing'
  if (k.includes('deploy')) return 'shipping'
  return k
}

function humanizeDoing(agent) {
  const st = String(agent?.state || 'idle')
  const step = humanizeStepKind(agent?.lastStepKind)
  const detail = String(agent?.detail || '').trim()

  if (st === 'blocked') return detail ? `blocked: ${detail}` : 'blocked'
  if (st === 'spawning') return 'joining the studio'
  if (st === 'idle') return 'hanging in the lounge'
  if (st === 'thinking') return step ? `thinking about ${step}` : (detail || 'thinking')
  if (st === 'collaborating') return detail || 'syncing with another agent'
  if (st === 'working') return step ? step : (detail || 'working')
  return detail || humanizeState(st)
}

function setMode(mode) {
  document.body.classList.toggle('mode-talk', mode === 'talk')
  document.body.classList.toggle('mode-ops', mode === 'ops')
  btnModeTalk?.classList.toggle('active', mode === 'talk')
  btnModeOps?.classList.toggle('active', mode === 'ops')
}

// Default: theatre mode (no big Ops panel). `O` toggles Ops panel.
setMode('talk')
window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return
  if (e.key === 'o' || e.key === 'O') {
    setMode(document.body.classList.contains('mode-ops') ? 'talk' : 'ops')
  }
})

function getLocal(k, fallback = '') {
  try { return localStorage.getItem(k) || fallback } catch { return fallback }
}

function setLocal(k, v) {
  try { localStorage.setItem(k, String(v || '')) } catch {}
}

function normalizeGatewayUrl(s) {
  const raw = String(s || '').trim()
  if (!raw) return '/v1/chat/completions'
  if (raw.startsWith('/v1/')) return raw
  // allow pasting host only
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/+$/, '') + '/v1/chat/completions'
  return raw
}

async function pullTokenFromOpenclaw() {
  // Local-only endpoint served by Vite middleware (reads ~/.openclaw/openclaw.json).
  const r = await fetch('/ops/gateway-token', { method: 'GET' })
  if (!r.ok) throw new Error(`token fetch failed (${r.status})`)
  const j = await r.json().catch(() => null)
  if (!j?.token) throw new Error('token missing in response')
  return String(j.token)
}

async function connectGatewayLite() {
  // Keep the same localStorage keys as the legacy portal.
  const agentId = String(agentIdEl?.value || getLocal('cal.agentId', 'main') || 'main').trim() || 'main'
  const url = normalizeGatewayUrl(gatewayUrlEl?.value || getLocal('cal.gatewayUrl', '/v1/chat/completions') || '/v1/chat/completions')

  // Always refresh token for local gateways so we never get into stale-token loops.
  let token = String(gatewayTokenEl?.value || getLocal('cal.gatewayToken', '') || '').trim()
  try {
    token = await pullTokenFromOpenclaw()
  } catch {
    // keep existing token (maybe remote gateway). If missing, connect will fail with a crisp error.
  }

  if (gatewayUrlEl) gatewayUrlEl.value = url
  if (gatewayTokenEl) gatewayTokenEl.value = token
  if (agentIdEl) agentIdEl.value = agentId

  setLocal('cal.agentId', agentId)
  setLocal('cal.gatewayUrl', url)
  setLocal('cal.gatewayToken', token)

  if (!token) {
    setText(elLinkStatus, 'Agent: token missing')
    return { ok: false, error: 'token missing' }
  }

  setText(elLinkStatus, 'Agent: connecting…')
  const r = await fetch(url || '/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-clawdbot-agent-id': agentId,
    },
    body: JSON.stringify({
      model: 'clawdbot',
      user: 'cal-studio',
      messages: [{ role: 'user', content: 'ping' }],
    }),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    setText(elLinkStatus, 'Agent: disconnected')
    return { ok: false, error: `HTTP ${r.status} ${t.slice(0, 160)}` }
  }
  setText(elLinkStatus, 'Agent: connected')
  return { ok: true }
}

const chatLog = []
function pushChat(role, content) {
  chatLog.push({ role, content: String(content || ''), ts: Date.now() })
  while (chatLog.length > 8) chatLog.shift()
  renderChatToast()
}

function renderChatToast() {
  // Prefer rendering near the input (never behind UI). Fall back to stage overlay.
  const tray = document.getElementById('talkTray')
  const mount = tray || elStageOverlay
  if (!mount) return

  // If agent detail panel is open, don't overlap it on the stage.
  if (!tray && theatre.selectedAgentId) return

  const items = chatLog.slice().reverse()
  if (items.length === 0) {
    mount.innerHTML = ''
    return
  }

  const html = `
    <div class="theatreToast">
      <div class="theatreToastTitle">Transcript</div>
      <div class="theatreToastBody">
        ${items.map((m) => `<div class="theatreToastLine ${m.role}"><span>${escapeHtml(m.role)}</span> ${escapeHtml(m.content)}</div>`).join('')}
      </div>
    </div>
  `
  if (tray) {
    // Keep the input usable: transcript sits above it.
    const existing = tray.querySelector('.theatreToast')
    if (existing) existing.outerHTML = html
    else tray.insertAdjacentHTML('afterbegin', html)
  } else {
    mount.innerHTML = html
  }
}

async function sendToAgentLite(text) {
  const t = String(text || '').trim()
  if (!t) return
  pushChat('user', t)
  setText(elStatus, 'thinking')

  const ok = await ensureGateway()
  if (!ok) {
    pushChat('system', 'gateway down (auto-repair failed)')
    setText(elStatus, 'Idle')
    return
  }

  const c = await connectGatewayLite()
  if (!c.ok) {
    pushChat('system', c.error || 'connect failed')
    setText(elStatus, 'Idle')
    return
  }

  const agentId = String(agentIdEl?.value || getLocal('cal.agentId', 'main') || 'main').trim() || 'main'
  const url = normalizeGatewayUrl(gatewayUrlEl?.value || getLocal('cal.gatewayUrl', '/v1/chat/completions') || '/v1/chat/completions')
  const token = String(gatewayTokenEl?.value || getLocal('cal.gatewayToken', '') || '').trim()

  const r = await fetch(url || '/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-clawdbot-agent-id': agentId,
    },
    body: JSON.stringify({
      model: 'clawdbot',
      user: 'cal-studio',
      messages: [{ role: 'user', content: t }],
    }),
  })

  if (!r.ok) {
    const err = await r.text().catch(() => '')
    pushChat('system', `HTTP ${r.status} ${err.slice(0, 160)}`)
    setText(elStatus, 'Idle')
    return
  }
  const j = await r.json().catch(() => null)
  const out = j?.choices?.[0]?.message?.content || ''
  pushChat('assistant', out || '(no content)')
  setText(elStatus, 'Idle')
}

function renderAgentList(s) {
  if (!elAgentDock) return
  const agents = Object.values(s.agents || {}).slice().sort((a, b) => a.id.localeCompare(b.id))
  elAgentDock.innerHTML = [
    `
      <div class="dockHead">
        <div class="dockTitle">Agents</div>
        <div class="dockHint">Press <span class="kbd">O</span> for Ops</div>
      </div>
    `,
    ...agents.map((a) => {
    const st = String(a.state || 'idle')
    const stHuman = humanizeState(st)
    const doing = humanizeDoing(a)
    const title = jobTitleForRole(a.role, a.id)
    const role = title ? `<div class="tiny">${escapeHtml(title)}</div>` : ''
    const line = a.detail ? `<div class="tiny muted">${escapeHtml(a.detail)}</div>` : ''
    return `
      <button class="agentChip" data-agent="${escapeHtml(a.id)}" title="${escapeHtml(a.id)}">
        <div class="agentChipTop">
          <span class="agentDot ${st}"></span>
          <span class="agentName">${escapeHtml(a.name || a.id)}</span>
        </div>
        <div class="agentMeta">${escapeHtml(stHuman)}${a.lastStepKind ? ` · ${escapeHtml(humanizeStepKind(a.lastStepKind))}` : ''}</div>
        <div class="tiny muted">${escapeHtml(doing)}</div>
        ${role}
        ${line}
      </button>
    `
    }),
  ].join('')

  for (const b of elAgentDock.querySelectorAll('button[data-agent]')) {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-agent')
      theatre.selectedAgentId = id
      renderOverlayDetail(theatre)
    })
  }
}

function renderOverlayDetail(s) {
  if (!elStageOverlay) return
  const id = s.selectedAgentId
  if (!id || !s.agents[id]) {
    renderChatToast()
    return
  }
  const a = s.agents[id]
  const tail = (s.lastEventsByAgent[id] || []).slice().reverse()
  elStageOverlay.innerHTML = `
    <div class="theatreDetail">
      <div class="theatreDetailHeader">
        <div class="theatreDetailTitle">${escapeHtml(a.name || id)}</div>
        <button class="theatreDetailClose" type="button" id="btnCloseDetailX">Close</button>
      </div>
      <div class="theatreDetailBody">
        <div class="tiny muted">${escapeHtml(id)}${a.role ? ` · ${escapeHtml(a.role)}` : ''}</div>
        <div class="theatreBadgeRow">
          <span class="theatreBadge">${escapeHtml(humanizeState(String(a.state || 'idle')))}</span>
          ${a.lastStepKind ? `<span class="theatreBadge">${escapeHtml(humanizeStepKind(a.lastStepKind))}</span>` : ''}
        </div>
        <div class="tiny muted" style="margin-top:8px;">${escapeHtml(humanizeDoing(a))}</div>
        <div class="theatreEvents">
          ${tail.map((e) => `<div class="theatreEvent"><span class="theatreEventType">${escapeHtml(e.type)}</span><span class="theatreEventTs">${new Date(e.ts).toLocaleTimeString()}</span></div>`).join('')}
        </div>
      </div>
    </div>
  `
  const btn = document.getElementById('btnCloseDetailX')
  btn?.addEventListener('click', () => {
    theatre.selectedAgentId = null
    renderOverlayDetail(theatre)
  })
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function ensureGateway() {
  try {
    const r = await fetch('/ops/gateway/ensure', { method: 'POST' })
    const j = await r.json().catch(() => null)
    const ok = Boolean(j?.healthy)
    setText(elGatewayStatus, ok ? 'Gateway: ok' : 'Gateway: down')
    setDot(elGatewayDot, ok)
    return ok
  } catch {
    setText(elGatewayStatus, 'Gateway: unknown')
    setDot(elGatewayDot, false)
    return false
  }
}

function applyEvent(line) {
  theatre = reduceEvent(theatre, line)
  scene.render(theatre)
  renderAgentList(theatre)
  renderOverlayDetail(theatre)

  // surface the most relevant status in the top-left badge
  const active = Object.values(theatre.agents || {}).find((a) => a.state && a.state !== 'idle') || null
  setText(elStatus, active ? String(active.state) : 'Idle')
}

// Scene
const stageEl = document.querySelector('.stage')
const canvasEl = document.getElementById('c')
const scene = new TheatreScene({ mount: stageEl, canvas: canvasEl })
await scene.init()

setText(elBuildInfo, `${BUILD.git}${BUILD.builtAt ? ` · ${new Date(BUILD.builtAt).toLocaleString()}` : ''}`)

// Transport: prefer WS; fallback to mock.
const ws = createWsClient({
  url: 'ws://127.0.0.1:8787',
  onConn: (c) => setText(elTheatreWsStatus, `Theatre WS: ${c.status}`),
  onState: (s) => {
    theatre = s
    scene.render(theatre)
    renderAgentList(theatre)
    renderOverlayDetail(theatre)
  },
})

const mock = createMockRunner({
  speedMs: 520,
  onEvent: (e) => applyEvent(e),
  onState: (s) => {
    theatre = s
    scene.render(theatre)
    renderAgentList(theatre)
    renderOverlayDetail(theatre)
  },
})

ws.connect()
await ensureGateway()
try {
  // Keep settings fields in sync (optional).
  if (gatewayUrlEl) gatewayUrlEl.value = normalizeGatewayUrl(getLocal('cal.gatewayUrl', '/v1/chat/completions'))
  if (agentIdEl) agentIdEl.value = getLocal('cal.agentId', 'main') || 'main'
  const token = await pullTokenFromOpenclaw()
  if (gatewayTokenEl) gatewayTokenEl.value = token
  setLocal('cal.gatewayToken', token)
} catch {}

// Try to connect the agent once on load so the HUD is truthful.
setTimeout(async () => {
  try { await connectGatewayLite() } catch {}
}, 450)

// Always respawn the demo sequence on refresh (until we wire real events).
// This keeps the "theatre" feeling alive even when nothing is running yet.
setTimeout(() => {
  ws.startMock(520)
  // If WS isn't available, local mock still drives the reducer.
  if (Object.keys(theatre.agents || {}).length === 0) mock.start().catch(() => {})
}, 250)

// Controls (reuse existing buttons)
btnNewThread?.addEventListener('click', () => {
  theatre = initialTheatreState()
  scene.render(theatre)
  renderAgentList(theatre)
  renderOverlayDetail(theatre)
})

btnOpenSettings?.addEventListener('click', () => {
  // Use the existing Settings panel as a generic “ops” drawer.
  setMode(document.body.classList.contains('mode-ops') ? 'talk' : 'ops')
})

btnModeTalk?.addEventListener('click', () => setMode('talk'))
btnModeOps?.addEventListener('click', () => setMode('ops'))

// Add small keyboard helpers.
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault()
    setMode('ops')
  }
})

btnCall?.addEventListener('click', async () => {
  await ensureGateway()
  const c = await connectGatewayLite()
  if (!c.ok) pushChat('system', c.error || 'connect failed')
})

btnConnect?.addEventListener('click', async () => {
  await ensureGateway()
  const c = await connectGatewayLite()
  if (!c.ok) pushChat('system', c.error || 'connect failed')
})

btnTalkSend?.addEventListener('click', async () => {
  const t = String(talkInput?.value || '').trim()
  if (!t) return
  if (talkInput) talkInput.value = ''
  await sendToAgentLite(t)
})

btnTalkClear?.addEventListener('click', () => {
  if (talkInput) talkInput.value = ''
  chatLog.length = 0
  renderChatToast()
})

talkInput?.addEventListener('keydown', (e) => {
  // Enter sends; Shift+Enter inserts newline.
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    btnTalkSend?.click()
  }
})

// Expose mock start via console for quick demos.
window.__CAL_STUDIO__ = {
  mockStart: () => mock.start(),
  wsMockStart: () => ws.startMock(520),
  send: (t) => sendToAgentLite(t),
}
