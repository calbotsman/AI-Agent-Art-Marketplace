import './style.css'
import './portal.css'

import { initialTheatreState, reduceEvent } from './theatre/reducer.js'
import { TheatreScene } from './theatre/scene.js'
import { createMockRunner } from './theatre/mock.js'
import { createWsClient } from './theatre/ws-client.js'

// Existing Cal Portal HTML has these anchors.
const elAgentDock = document.getElementById('agentDock')
const elStageOverlay = document.getElementById('stageOverlay')
const elStatus = document.getElementById('status')
const elLinkStatus = document.getElementById('linkStatus')
const elBuildInfo = document.getElementById('buildInfo')
const elGatewayStatus = document.getElementById('gatewayStatus')
const elGatewayDot = document.getElementById('gatewayDot')

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

function setMode(mode) {
  document.body.classList.toggle('mode-talk', mode === 'talk')
  document.body.classList.toggle('mode-ops', mode === 'ops')
  btnModeTalk?.classList.toggle('active', mode === 'talk')
  btnModeOps?.classList.toggle('active', mode === 'ops')
}

function renderAgentList(s) {
  if (!elAgentDock) return
  const agents = Object.values(s.agents || {}).slice().sort((a, b) => a.id.localeCompare(b.id))
  elAgentDock.innerHTML = agents.map((a) => {
    const st = String(a.state || 'idle')
    const role = a.role ? `<div class="tiny">${escapeHtml(a.role)}</div>` : ''
    const line = a.detail ? `<div class="tiny muted">${escapeHtml(a.detail)}</div>` : ''
    return `
      <button class="agentChip" data-agent="${escapeHtml(a.id)}" title="${escapeHtml(a.id)}">
        <div class="agentChipTop">
          <span class="agentDot ${st}"></span>
          <span class="agentName">${escapeHtml(a.name || a.id)}</span>
        </div>
        <div class="agentMeta">${escapeHtml(st)}${a.lastStepKind ? ` · ${escapeHtml(a.lastStepKind)}` : ''}</div>
        ${role}
        ${line}
      </button>
    `
  }).join('')

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
    elStageOverlay.innerHTML = ''
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
          <span class="theatreBadge">${escapeHtml(String(a.state || 'idle'))}</span>
          ${a.lastStepKind ? `<span class="theatreBadge">${escapeHtml(a.lastStepKind)}</span>` : ''}
        </div>
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
  onConn: (c) => setText(elLinkStatus, `Theatre WS: ${c.status}`),
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

// Kick mock if WS is absent (optional)
setTimeout(() => {
  // If no agents have been created yet, show the demo.
  if (Object.keys(theatre.agents || {}).length === 0) {
    mock.start().catch(() => {})
  }
}, 900)

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

// Expose mock start via console for quick demos.
window.__CAL_STUDIO__ = {
  mockStart: () => mock.start(),
  wsMockStart: () => ws.startMock(520),
}

