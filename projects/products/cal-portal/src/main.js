import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// ---------- UI ----------
const elStatus = document.getElementById('status')
const elMicStatus = document.getElementById('micStatus')
const elLinkStatus = document.getElementById('linkStatus')

// always-visible status bar
const elGatewayDot = document.getElementById('gatewayDot')
const elGatewayStatus = document.getElementById('gatewayStatus')
const elTokenStatus = document.getElementById('tokenStatus')
const btnModeTalk = document.getElementById('btnModeTalk')
const btnModeOps = document.getElementById('btnModeOps')
const btnOpenSettings = document.getElementById('btnOpenSettings')

const btnMic = document.getElementById('btnMic')
const btnVoiceHud = document.getElementById('btnVoiceHud')
const btnConvo = document.getElementById('btnConvo')
const btnCall = document.getElementById('btnCall')
const btnSend = document.getElementById('btnSend')
const btnClear = document.getElementById('btnClear')

const input = document.getElementById('input')
const chatlog = document.getElementById('chatlog')

// talk-mode tray
const talkInput = document.getElementById('talkInput')
const btnTalkSend = document.getElementById('btnTalkSend')
const btnTalkClear = document.getElementById('btnTalkClear')

const toggleVoice = document.getElementById('toggleVoice')
const toggleAutoSpeak = document.getElementById('toggleAutoSpeak')
const settingsDetails = document.getElementById('settings')
const gatewayUrlEl = document.getElementById('gatewayUrl')
const gatewayTokenEl = document.getElementById('gatewayToken')
const btnConnect = document.getElementById('btnConnect')
const btnTestVoice = document.getElementById('btnTestVoice')

const dropzone = document.getElementById('dropzone')
const fileEl = document.getElementById('file')
const btnClearImages = document.getElementById('btnClearImages')
const thumbs = document.getElementById('thumbs')

const notesEl = document.getElementById('notes')
const btnSaveNotes = document.getElementById('btnSaveNotes')
const btnClearNotes = document.getElementById('btnClearNotes')

// Library + Tasks
const refTitleEl = document.getElementById('refTitle')
const refUrlEl = document.getElementById('refUrl')
const refBodyEl = document.getElementById('refBody')
const btnAddRef = document.getElementById('btnAddRef')
const btnClearRefs = document.getElementById('btnClearRefs')
const refListEl = document.getElementById('refList')

const taskTitleEl = document.getElementById('taskTitle')
const btnAddTask = document.getElementById('btnAddTask')
const taskListEl = document.getElementById('taskList')

// Runs (tiny)
const runTitleEl = document.getElementById('runTitle')
const runNotesEl = document.getElementById('runNotes')
const btnAddRun = document.getElementById('btnAddRun')
const runListEl = document.getElementById('runList')

const btnExportHub = document.getElementById('btnExportHub')
const btnImportHub = document.getElementById('btnImportHub')
const hubFileEl = document.getElementById('hubFile')

const state = {
  mode: 'talk', // 'talk' | 'ops'
  listening: false,
  speaking: false,
  transcript: '',
  conversationMode: false,
  voiceEnabled: true,
  autoSpeak: true,
  connected: false,
  lastGatewayOkAt: 0,
  lastGatewayErr: '',
  // Use same-origin path; Vite proxies /v1 -> Gateway to avoid CORS.
  gatewayUrl: '/v1/chat/completions',
  gatewayToken: '',
  history: [], // {role, content}
  pendingImages: [], // File[]
  notes: '',
  refs: [], // {id,title,url,body,ts}
  tasks: [], // {id,title,status,ts}
  runs: [], // {id,title,status,ts,notes}

  // speech helpers
  lastFinalTranscript: '',
  pttActive: false,
}

function setStatus(text) { elStatus.textContent = text }
function setMic(text) { elMicStatus.textContent = text }
function setLink(text) { elLinkStatus.textContent = text }

function maskToken(t) {
  const s = String(t || '')
  if (!s) return ''
  if (s.length <= 8) return '••••'
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}

function renderMode() {
  document.body.classList.toggle('mode-talk', state.mode === 'talk')
  document.body.classList.toggle('mode-ops', state.mode === 'ops')
  btnModeTalk?.classList.toggle('primary', state.mode === 'talk')
  btnModeOps?.classList.toggle('primary', state.mode === 'ops')
}

function renderStatusBar() {
  // token
  if (elTokenStatus) {
    elTokenStatus.textContent = state.gatewayToken
      ? `Token: set (${maskToken(state.gatewayToken)})`
      : 'Token: missing'
  }

  // gateway / connectivity
  if (elGatewayStatus) {
    const base = state.connected ? 'Gateway: connected' : 'Gateway: disconnected'
    const age = state.lastGatewayOkAt ? Math.round((Date.now() - state.lastGatewayOkAt) / 1000) : null
    const suffix = state.connected && age != null ? ` (ok ${age}s ago)` : (state.lastGatewayErr ? ` (${state.lastGatewayErr})` : '')
    elGatewayStatus.textContent = `${base}${suffix}`
  }

  if (elGatewayDot) {
    elGatewayDot.classList.remove('ok', 'warn', 'bad')
    if (!state.gatewayToken) elGatewayDot.classList.add('warn')
    else if (state.connected) elGatewayDot.classList.add('ok')
    else elGatewayDot.classList.add('bad')
  }
}

// ---------- Library + Tasks (local-first) ----------
function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function saveLocalHub() {
  try {
    localStorage.setItem('cal.refs', JSON.stringify(state.refs || []))
    localStorage.setItem('cal.tasks', JSON.stringify(state.tasks || []))
    localStorage.setItem('cal.runs', JSON.stringify(state.runs || []))
  } catch {
    // ignore
  }
}

function loadLocalHub() {
  try {
    const r = localStorage.getItem('cal.refs')
    const t = localStorage.getItem('cal.tasks')
    const runs = localStorage.getItem('cal.runs')
    if (r) state.refs = JSON.parse(r) || []
    if (t) state.tasks = JSON.parse(t) || []
    if (runs) state.runs = JSON.parse(runs) || []
  } catch {
    // ignore
  }
}

function hubExportPayload() {
  return {
    kind: 'cal-portal-hub',
    version: 1,
    exportedAt: new Date().toISOString(),
    refs: state.refs || [],
    tasks: state.tasks || [],
    runs: state.runs || [],
    notes: state.notes || '',
  }
}

function downloadJson(filename, obj) {
  const json = JSON.stringify(obj, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

function exportHub() {
  const ts = new Date().toISOString().replaceAll(':', '').replaceAll('-', '').slice(0, 15)
  downloadJson(`cal-portal-hub_${ts}.json`, hubExportPayload())
  addMsg('cal', 'Exported hub data as JSON.')
}

async function importHubFromFile(file) {
  const raw = await file.text()
  const j = JSON.parse(raw)
  if (!j || typeof j !== 'object') throw new Error('Invalid JSON')
  const refs = Array.isArray(j.refs) ? j.refs : []
  const tasks = Array.isArray(j.tasks) ? j.tasks : []
  const runs = Array.isArray(j.runs) ? j.runs : []
  const notes = typeof j.notes === 'string' ? j.notes : ''

  state.refs = refs
  state.tasks = tasks
  state.runs = runs
  state.notes = notes
  if (notesEl) notesEl.value = state.notes

  saveLocalHub()
  saveSettings()
  renderRefs()
  renderTasks()
  renderRuns()

  addMsg('cal', `Imported hub data. (${refs.length} refs, ${tasks.length} tasks, ${runs.length} runs)`)
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderRefs() {
  if (!refListEl) return
  const refs = state.refs || []
  if (!refs.length) {
    refListEl.innerHTML = '<div class="small" style="opacity:.7;">No references yet.</div>'
    return
  }
  refListEl.innerHTML = refs
    .slice()
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .map(r => {
      const title = esc(r.title || '(untitled)')
      const body = esc(r.body || '')
      const url = (r.url || '').trim()
      const link = url ? `<a href="${esc(url)}" target="_blank" rel="noreferrer">open</a>` : ''
      return `
        <div class="msg" style="margin-top:10px;">
          <div class="meta"><div>Ref</div><div>${new Date(r.ts || Date.now()).toLocaleString()}</div></div>
          <div><strong>${title}</strong> ${link ? `<span style="margin-left:8px;">${link}</span>` : ''}</div>
          ${body ? `<div style="margin-top:6px; opacity:.9; white-space:pre-wrap;">${body}</div>` : ''}
          <div style="margin-top:8px; display:flex; gap:8px;">
            <button data-ref-del="${esc(r.id)}">Delete</button>
          </div>
        </div>
      `.trim()
    })
    .join('\n')

  // bind delete
  refListEl.querySelectorAll('[data-ref-del]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-ref-del')
      state.refs = (state.refs || []).filter(x => x.id !== id)
      saveLocalHub()
      renderRefs()
    })
  })
}

function renderTasks() {
  if (!taskListEl) return
  const tasks = state.tasks || []
  if (!tasks.length) {
    taskListEl.innerHTML = '<div class="small" style="opacity:.7;">No tasks yet.</div>'
    return
  }
  taskListEl.innerHTML = tasks
    .slice()
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .map(t => {
      const title = esc(t.title || '(untitled)')
      const status = t.status || 'todo'
      const pill = status === 'done'
        ? '<span class="pill" style="border-color: rgba(34,197,94,.35);">done</span>'
        : '<span class="pill">todo</span>'
      return `
        <div class="msg" style="margin-top:10px;">
          <div class="meta"><div>Task</div><div>${new Date(t.ts || Date.now()).toLocaleString()}</div></div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div style="flex:1;">
              <div>${title}</div>
              <div style="margin-top:6px;">${pill}</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button data-task-toggle="${esc(t.id)}">Toggle</button>
              <button data-task-del="${esc(t.id)}">Delete</button>
            </div>
          </div>
        </div>
      `.trim()
    })
    .join('\n')

  taskListEl.querySelectorAll('[data-task-toggle]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-task-toggle')
      state.tasks = (state.tasks || []).map(x => x.id === id ? { ...x, status: x.status === 'done' ? 'todo' : 'done' } : x)
      saveLocalHub()
      renderTasks()
    })
  })
  taskListEl.querySelectorAll('[data-task-del]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-task-del')
      state.tasks = (state.tasks || []).filter(x => x.id !== id)
      saveLocalHub()
      renderTasks()
    })
  })
}

function renderRuns() {
  if (!runListEl) return
  const runs = state.runs || []
  if (!runs.length) {
    runListEl.innerHTML = '<div class="small" style="opacity:.7;">No runs yet.</div>'
    return
  }

  runListEl.innerHTML = runs
    .slice()
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .map(r => {
      const title = esc(r.title || '(untitled)')
      const notes = esc(r.notes || '')
      const status = r.status || 'running'
      const pill = status === 'done'
        ? '<span class="pill" style="border-color: rgba(34,197,94,.35);">done</span>'
        : '<span class="pill" style="border-color: rgba(245,158,11,.35);">running</span>'
      return `
        <div class="msg" style="margin-top:10px;">
          <div class="meta"><div>Run</div><div>${new Date(r.ts || Date.now()).toLocaleString()}</div></div>
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
            <div style="flex:1;">
              <div><strong>${title}</strong></div>
              <div style="margin-top:6px;">${pill}</div>
              ${notes ? `<div style="margin-top:8px; opacity:.9; white-space:pre-wrap;">${notes}</div>` : ''}
            </div>
            <div style="display:flex; gap:8px;">
              <button data-run-toggle="${esc(r.id)}">Toggle</button>
              <button data-run-del="${esc(r.id)}">Delete</button>
            </div>
          </div>
        </div>
      `.trim()
    })
    .join('\n')

  runListEl.querySelectorAll('[data-run-toggle]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-run-toggle')
      state.runs = (state.runs || []).map(x => x.id === id ? { ...x, status: x.status === 'done' ? 'running' : 'done' } : x)
      saveLocalHub()
      renderRuns()
    })
  })

  runListEl.querySelectorAll('[data-run-del]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-run-del')
      state.runs = (state.runs || []).filter(x => x.id !== id)
      saveLocalHub()
      renderRuns()
    })
  })
}

function addRunFromUI() {
  const title = runTitleEl?.value?.trim() || ''
  const notes = runNotesEl?.value?.trim() || ''
  if (!title && !notes) return
  state.runs = state.runs || []
  state.runs.push({ id: uid('run'), title: title || notes.slice(0, 60) || 'Run', notes, status: 'running', ts: Date.now() })
  if (runTitleEl) runTitleEl.value = ''
  if (runNotesEl) runNotesEl.value = ''
  saveLocalHub()
  renderRuns()
}

function addRefFromUI() {
  const title = refTitleEl?.value?.trim() || ''
  const url = refUrlEl?.value?.trim() || ''
  const body = refBodyEl?.value?.trim() || ''
  if (!title && !url && !body) return
  state.refs = state.refs || []
  state.refs.push({ id: uid('ref'), title: title || url || body.slice(0, 60), url, body, ts: Date.now() })
  if (refTitleEl) refTitleEl.value = ''
  if (refUrlEl) refUrlEl.value = ''
  if (refBodyEl) refBodyEl.value = ''
  saveLocalHub()
  renderRefs()
}

function addTaskFromUI() {
  const title = taskTitleEl?.value?.trim() || ''
  if (!title) return
  state.tasks = state.tasks || []
  state.tasks.push({ id: uid('task'), title, status: 'todo', ts: Date.now() })
  if (taskTitleEl) taskTitleEl.value = ''
  saveLocalHub()
  renderTasks()
}

function bindHubUI() {
  btnAddRef?.addEventListener('click', addRefFromUI)
  btnClearRefs?.addEventListener('click', () => {
    state.refs = []
    saveLocalHub()
    renderRefs()
  })

  btnAddTask?.addEventListener('click', addTaskFromUI)
  taskTitleEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTaskFromUI()
    }
  })

  btnAddRun?.addEventListener('click', addRunFromUI)
  runNotesEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      addRunFromUI()
    }
  })

  btnExportHub?.addEventListener('click', () => exportHub())

  btnImportHub?.addEventListener('click', () => {
    if (!hubFileEl) return
    hubFileEl.value = ''
    hubFileEl.click()
  })

  hubFileEl?.addEventListener('change', async () => {
    const f = hubFileEl.files?.[0]
    if (!f) return
    const ok = window.confirm('Import hub data from JSON? This will REPLACE current refs/tasks/notes in this browser.')
    if (!ok) return
    try {
      await importHubFromFile(f)
    } catch (e) {
      console.warn(e)
      addMsg('cal', `Import failed: ${String(e.message || e).slice(0, 120)}`)
    }
  })
}

function addMsg(role, content, opts = {}) {
  const d = document.createElement('div')
  d.className = `msg ${role}`

  const meta = document.createElement('div')
  meta.className = 'meta'
  const left = document.createElement('div')
  left.textContent = role === 'user' ? 'You' : 'Cal'
  const right = document.createElement('div')
  right.textContent = opts.note || ''
  meta.appendChild(left)
  meta.appendChild(right)

  const body = document.createElement('div')
  if (typeof content === 'string') {
    body.textContent = content
  } else {
    body.appendChild(content)
  }

  d.appendChild(meta)
  d.appendChild(body)
  chatlog.prepend(d)
}

function renderThumbs() {
  thumbs.innerHTML = ''
  for (const f of state.pendingImages) {
    const url = URL.createObjectURL(f)
    const wrap = document.createElement('div')
    wrap.className = 'thumb'
    const img = document.createElement('img')
    img.src = url
    img.title = f.name
    wrap.appendChild(img)
    thumbs.appendChild(wrap)
  }
}

function addImages(files) {
  const list = Array.from(files || []).filter(f => f.type.startsWith('image/'))
  if (!list.length) return
  state.pendingImages.push(...list)
  renderThumbs()
}

function clearImages() {
  state.pendingImages = []
  renderThumbs()
}

// ---------- Voice output ----------
function speak(text) {
  // Always log Cal's text response in chat; speaking is optional
  addMsg('cal', text)

  if (!state.voiceEnabled || !state.autoSpeak) return
  if (!('speechSynthesis' in window)) return

  window.speechSynthesis.cancel()

  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1.0
  u.pitch = 1.0
  u.volume = 1.0

  // Choose a decent voice if available
  const voices = window.speechSynthesis.getVoices?.() || []
  const preferred = voices.find(v => /Samantha|Alex|Daniel|Google US English/i.test(v.name))
  if (preferred) u.voice = preferred

  u.onstart = () => { state.speaking = true; setStatus('Speaking') }
  u.onend = () => { state.speaking = false; setStatus('Idle') }
  u.onerror = () => { state.speaking = false; setStatus('Idle') }

  window.speechSynthesis.speak(u)
}

function setDraftText(text) {
  const t = String(text || '')
  state.transcript = t
  if (input) input.value = t
  if (talkInput) talkInput.value = t
}

// ---------- SpeechRecognition (mic) ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
let rec = null
if (SpeechRecognition) {
  rec = new SpeechRecognition()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = 'en-US'

  rec.onresult = (event) => {
    let finalText = ''
    let interimText = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i]
      const t = res[0].transcript
      if (res.isFinal) finalText += t
      else interimText += t
    }

    const combined = (finalText + ' ' + interimText).trim()
    setDraftText(combined)

    if (finalText.trim()) state.lastFinalTranscript = finalText.trim()

    // Conversation mode: auto-send finalized chunks
    if (state.conversationMode && finalText.trim()) {
      const sendText = finalText.trim()
      state.lastFinalTranscript = ''
      setDraftText('')
      sendUserMessage(sendText)
    }
  }

  rec.onstart = () => {
    state.listening = true
    setMic('Mic: on')
    btnMic.textContent = 'Stop mic'
  }
  rec.onend = () => {
    state.listening = false
    setMic('Mic: off')
    btnMic.textContent = 'Start mic'

    // In conversation mode, keep listening (some browsers stop unexpectedly)
    if (state.conversationMode) {
      try { rec.start() } catch { /* ignore */ }
    }
  }
  rec.onerror = (e) => {
    console.warn('SpeechRecognition error', e)
    setMic('Mic error')
  }
} else {
  setMic('Mic: unavailable (use Chrome)')
  btnMic.disabled = true
}

function startMic() {
  if (!rec) return
  try { rec.start() } catch { /* ignore */ }
}
function stopMic() {
  if (!rec) return
  try { rec.stop() } catch { /* ignore */ }
}

// ---------- Gateway bridge (Clawdbot OpenAI-compatible endpoint) ----------
function loadSettings() {
  const m = localStorage.getItem('cal.mode')
  const u = localStorage.getItem('cal.gatewayUrl')
  const t = localStorage.getItem('cal.gatewayToken')
  const v = localStorage.getItem('cal.voiceEnabled')
  const a = localStorage.getItem('cal.autoSpeak')
  const n = localStorage.getItem('cal.studioNotes')
  if (m === 'talk' || m === 'ops') state.mode = m
  if (u) state.gatewayUrl = u
  if (t) state.gatewayToken = t
  if (v != null) state.voiceEnabled = v === 'true'
  if (a != null) state.autoSpeak = a === 'true'
  if (n != null) state.notes = n

  // Auto-config via URL query params (Option 1)
  // Example: http://127.0.0.1:5173/?token=...&gateway=http://127.0.0.1:18789/v1/chat/completions
  const params = new URLSearchParams(window.location.search)
  const tokenParam = params.get('token')
  const gatewayParam = params.get('gateway')
  if (gatewayParam) state.gatewayUrl = gatewayParam
  if (tokenParam) {
    state.gatewayToken = tokenParam
    // persist immediately so a refresh doesn't lose it
    localStorage.setItem('cal.gatewayToken', state.gatewayToken)
  }

  // If someone passes the gateway host without a path, normalize to /v1/chat/completions
  if (state.gatewayUrl && !state.gatewayUrl.includes('/v1/')) {
    // allow relative /v1... or full http(s)://.../v1...
    // no-op if already a /v1 path
  }

  gatewayUrlEl.value = state.gatewayUrl
  gatewayTokenEl.value = state.gatewayToken
  toggleVoice.checked = state.voiceEnabled
  toggleAutoSpeak.checked = state.autoSpeak

  if (notesEl) notesEl.value = state.notes
  if (btnVoiceHud) btnVoiceHud.textContent = state.voiceEnabled ? 'Voice: on' : 'Voice: off'

  // local hub data
  loadLocalHub()
  renderRefs()
  renderTasks()
  renderRuns()

  // keep talk tray in sync
  if (talkInput && input) talkInput.value = input.value

  renderMode()
  renderStatusBar()
}

function saveSettings() {
  localStorage.setItem('cal.mode', state.mode)
  localStorage.setItem('cal.gatewayUrl', state.gatewayUrl)
  localStorage.setItem('cal.gatewayToken', state.gatewayToken)
  localStorage.setItem('cal.voiceEnabled', String(state.voiceEnabled))
  localStorage.setItem('cal.autoSpeak', String(state.autoSpeak))
  localStorage.setItem('cal.studioNotes', String(state.notes || ''))
}

async function connectGateway() {
  state.gatewayUrl = gatewayUrlEl.value.trim() || state.gatewayUrl
  state.gatewayToken = gatewayTokenEl.value.trim()
  state.voiceEnabled = !!toggleVoice.checked
  state.autoSpeak = !!toggleAutoSpeak.checked
  saveSettings()

  if (!state.gatewayToken) {
    state.connected = false
    state.lastGatewayErr = 'token missing'
    setLink('Agent: token missing')
    renderStatusBar()
    return
  }

  setLink('Agent: connecting…')
  state.lastGatewayErr = ''
  renderStatusBar()
  try {
    // Ensure we hit same-origin /v1... by default (proxied by Vite)
    const url = state.gatewayUrl || '/v1/chat/completions'
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.gatewayToken}`,
        'Content-Type': 'application/json',
        'x-clawdbot-agent-id': 'main',
      },
      body: JSON.stringify({
        model: 'clawdbot',
        user: 'cal-portal',
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      throw new Error(`HTTP ${r.status} ${t.slice(0, 120)}`)
    }
    const j = await r.json()
    const txt = j?.choices?.[0]?.message?.content || ''
    state.connected = true
    state.lastGatewayOkAt = Date.now()
    state.lastGatewayErr = ''
    setLink('Agent: connected')
    renderStatusBar()
    if (txt && txt.toLowerCase().includes('pong')) {
      // ok
    }
  } catch (e) {
    console.warn('connectGateway failed', e)
    state.connected = false
    const msg = String(e.message || e)
    state.lastGatewayErr = msg.slice(0, 80)
    setLink(`Agent: error (${msg.slice(0, 80)})`)
    renderStatusBar()
  }
}

async function checkGatewayHeartbeat() {
  // Keep the status bar honest without being spammy.
  if (!state.gatewayToken) {
    state.connected = false
    state.lastGatewayErr = 'token missing'
    renderStatusBar()
    return
  }

  const url = state.gatewayUrl || '/v1/chat/completions'
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), 2500)
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.gatewayToken}`,
        'Content-Type': 'application/json',
        'x-clawdbot-agent-id': 'main',
      },
      body: JSON.stringify({
        model: 'clawdbot',
        user: 'cal-portal',
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: controller.signal,
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    state.connected = true
    state.lastGatewayOkAt = Date.now()
    state.lastGatewayErr = ''
  } catch (e) {
    state.connected = false
    state.lastGatewayErr = (e?.name === 'AbortError') ? 'timeout' : String(e.message || e).slice(0, 80)
  } finally {
    clearTimeout(to)
    renderStatusBar()
  }
}

async function sendToAgent(userText) {
  if (!state.connected) {
    // Try auto-connect if token is present
    if (state.gatewayToken) await connectGateway()
  }
  if (!state.connected) {
    return `I’m not connected to the gateway yet. Open Settings → paste the gateway token, then hit Connect.`
  }

  // Attach image names to the text until we add vision
  let augmented = userText
  if (state.pendingImages.length) {
    const names = state.pendingImages.map(f => f.name).join(', ')
    augmented += `\n\n[Attached images (not yet vision-enabled): ${names}]`
  }

  // Maintain conversation context in this UI
  state.history.push({ role: 'user', content: augmented })

  const systemParts = [
    "You are Cal: Josh's creative partner. Speak like a real buddy in a studio—warm, witty, and direct. In conversation mode: 1–3 short sentences max, no boilerplate. Default to asking 1 good follow-up question. If the user seems frustrated, be calm and solution-focused.",
    state.notes ? `Studio notes (persistent user prefs):\n${state.notes}` : null,
  ].filter(Boolean)

  const body = {
    model: 'clawdbot',
    user: 'cal-portal',
    messages: [
      { role: 'system', content: systemParts.join('\n\n') },
      ...state.history,
    ],
  }

  const url = state.gatewayUrl || '/v1/chat/completions'
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${state.gatewayToken}`,
      'Content-Type': 'application/json',
      'x-clawdbot-agent-id': 'main',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`Gateway error HTTP ${r.status}: ${t.slice(0, 200)}`)
  }
  const j = await r.json()
  const txt = j?.choices?.[0]?.message?.content || ''
  state.history.push({ role: 'assistant', content: txt })

  // clear one-shot attachments after send
  clearImages()

  return txt
}

async function sendUserMessage(text) {
  const t = (text || '').trim()
  if (!t) return

  addMsg('user', t, { note: state.pendingImages.length ? `${state.pendingImages.length} image(s)` : '' })

  setStatus('Thinking')
  try {
    const reply = await sendToAgent(t)
    setStatus('Idle')
    speak(reply)
  } catch (e) {
    console.warn(e)
    setStatus('Idle')
    speak(`Hmm. Something went wrong talking to the gateway. ${String(e.message || e)}`)
  }
}

// ---------- Event wiring ----------
btnModeTalk?.addEventListener('click', () => {
  state.mode = 'talk'
  saveSettings()
  renderMode()
})
btnModeOps?.addEventListener('click', () => {
  state.mode = 'ops'
  saveSettings()
  renderMode()
})

btnOpenSettings?.addEventListener('click', () => {
  state.mode = 'ops'
  saveSettings()
  renderMode()
  if (settingsDetails) settingsDetails.open = true
  settingsDetails?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
})

btnTalkSend?.addEventListener('click', () => {
  const t = (talkInput?.value || '').trim()
  if (!t) return
  talkInput.value = ''
  if (input) input.value = ''
  sendUserMessage(t)
})
btnTalkClear?.addEventListener('click', () => {
  chatlog.innerHTML = ''
  state.history = []
  clearImages()
  if (talkInput) talkInput.value = ''
  if (input) input.value = ''
})

talkInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    btnTalkSend?.click()
  }
})

btnMic?.addEventListener('click', () => {
  if (!rec) return
  if (state.listening) stopMic()
  else startMic()
})

btnConvo?.addEventListener('click', () => {
  state.conversationMode = !state.conversationMode
  btnConvo.textContent = state.conversationMode ? 'Conversation: on' : 'Conversation: off'
  btnConvo.classList.toggle('primary', state.conversationMode)

  if (state.conversationMode) {
    startMic()
  }
})

btnCall?.addEventListener('click', async () => {
  // One click: connect (if token present) + turn on conversation + start mic
  if (!state.connected && state.gatewayToken) {
    await connectGateway()
  }
  state.conversationMode = true
  btnConvo.textContent = 'Conversation: on'
  btnConvo.classList.add('primary')
  startMic()
})

btnVoiceHud?.addEventListener('click', () => {
  state.voiceEnabled = !state.voiceEnabled
  toggleVoice.checked = state.voiceEnabled
  btnVoiceHud.textContent = state.voiceEnabled ? 'Voice: on' : 'Voice: off'
  saveSettings()
})

btnSend?.addEventListener('click', () => sendUserMessage(input.value))

input?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    sendUserMessage(input.value)
    input.value = ''
    if (talkInput) talkInput.value = ''
  }
})

input?.addEventListener('input', () => {
  if (talkInput) talkInput.value = input.value
})

talkInput?.addEventListener('input', () => {
  if (input) input.value = talkInput.value
})

btnClear?.addEventListener('click', () => {
  chatlog.innerHTML = ''
  state.history = []
  clearImages()
})

btnConnect?.addEventListener('click', () => connectGateway())

// reflect token/url changes instantly in the status bar (without auto-connecting)
gatewayTokenEl?.addEventListener('input', () => {
  state.gatewayToken = gatewayTokenEl.value.trim()
  renderStatusBar()
})
gatewayUrlEl?.addEventListener('input', () => {
  state.gatewayUrl = gatewayUrlEl.value.trim() || state.gatewayUrl
  renderStatusBar()
})

btnTestVoice?.addEventListener('click', () => {
  state.voiceEnabled = !!toggleVoice.checked
  state.autoSpeak = !!toggleAutoSpeak.checked
  saveSettings()
  if (!state.voiceEnabled) return
  // direct synth test
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance('Hey Josh. Cal here. Voice is online.')
  u.rate = 1.02
  window.speechSynthesis.speak(u)
})

toggleVoice?.addEventListener('change', () => { state.voiceEnabled = !!toggleVoice.checked; if (btnVoiceHud) btnVoiceHud.textContent = state.voiceEnabled ? 'Voice: on' : 'Voice: off'; saveSettings() })
toggleAutoSpeak?.addEventListener('change', () => { state.autoSpeak = !!toggleAutoSpeak.checked; saveSettings() })

dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'rgba(34,211,238,.55)' })
dropzone?.addEventListener('dragleave', () => { dropzone.style.borderColor = 'rgba(148,163,184,.35)' })
dropzone?.addEventListener('drop', (e) => {
  e.preventDefault()
  dropzone.style.borderColor = 'rgba(148,163,184,.35)'
  addImages(e.dataTransfer?.files)
})

window.addEventListener('paste', (e) => {
  const items = e.clipboardData?.files
  if (items && items.length) addImages(items)
})

fileEl?.addEventListener('change', (e) => addImages(e.target.files))
btnClearImages?.addEventListener('click', () => clearImages())

btnSaveNotes?.addEventListener('click', () => {
  state.notes = (notesEl?.value || '').trim()
  saveSettings()
  addMsg('cal', 'Saved studio notes.')
})

btnClearNotes?.addEventListener('click', () => {
  state.notes = ''
  if (notesEl) notesEl.value = ''
  saveSettings()
})

setStatus('Idle')
bindHubUI()
loadSettings()
setLink(state.gatewayToken ? 'Agent: disconnected' : 'Agent: token missing')
renderStatusBar()

// Auto-connect if a token is present (e.g., passed via ?token=...)
if (state.gatewayToken) {
  connectGateway()
}

// lightweight connectivity heartbeat (keeps the bottom status bar accurate)
setInterval(() => {
  // only check when tab is visible to avoid useless background traffic
  if (document.visibilityState === 'visible') checkGatewayHeartbeat()
}, 15000)

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkGatewayHeartbeat()
})

// ensure voices list is populated on some platforms
window.speechSynthesis?.getVoices?.()

// ---------- Three.js: Cal in a small space ----------
const canvas = document.getElementById('c')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const scene = new THREE.Scene()
scene.background = new THREE.Color('#0b1220')

const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 100)
// default framing: face/upper-body
camera.position.set(0, 2.05, 2.35)

const ambient = new THREE.AmbientLight(0xffffff, 0.55)
scene.add(ambient)

const key = new THREE.DirectionalLight(0x88e1ff, 0.9)
key.position.set(2, 4, 2)
scene.add(key)

const rim = new THREE.DirectionalLight(0xa78bfa, 0.65)
rim.position.set(-2, 2.5, -2)
scene.add(rim)

// simple floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95, metalness: 0.0 })
)
floor.rotation.x = -Math.PI / 2
floor.position.y = 0
scene.add(floor)

// studio vibe: subtle grid + walls + a "desk"
const grid = new THREE.GridHelper(20, 20, 0x1a2540, 0x0f172a)
grid.material.opacity = 0.35
grid.material.transparent = true
grid.position.y = 0.001
scene.add(grid)

const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.95, metalness: 0.0 })
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 6), wallMat)
backWall.position.set(0, 3, -6)
scene.add(backWall)

const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallMat)
sideWall.position.set(-6, 3, -1)
sideWall.rotation.y = Math.PI / 2
scene.add(sideWall)

// desk
const desk = new THREE.Mesh(
  new THREE.BoxGeometry(2.6, 0.12, 1.2),
  new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.1 })
)
desk.position.set(1.6, 0.72, -0.6)
scene.add(desk)

// neon sign
const neon = new THREE.Mesh(
  new THREE.PlaneGeometry(1.6, 0.5),
  new THREE.MeshStandardMaterial({ color: 0x111827, emissive: 0x22d3ee, emissiveIntensity: 1.2 })
)
neon.position.set(0, 2.4, -5.95)
scene.add(neon)

// fallback “brain orb” while the avatar loads
const fallbackGroup = new THREE.Group()
scene.add(fallbackGroup)

const geo = new THREE.IcosahedronGeometry(0.55, 5)
const mat = new THREE.MeshStandardMaterial({
  color: 0x0f172a,
  roughness: 0.25,
  metalness: 0.3,
  emissive: new THREE.Color('#111827'),
  emissiveIntensity: 0.35,
})
const orb = new THREE.Mesh(geo, mat)
fallbackGroup.add(orb)

const wire = new THREE.LineSegments(
  new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.57, 4)),
  new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35 })
)
fallbackGroup.add(wire)

const mouthRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.16, 0.02, 16, 64),
  new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x7c3aed, emissiveIntensity: 1.0 })
)
mouthRing.position.set(0, -0.10, 0.52)
mouthRing.rotation.x = Math.PI / 2
fallbackGroup.add(mouthRing)

fallbackGroup.position.set(0, 0.85, 0)

// Avatar (RobotExpressive v1 — face/body)
let avatarRoot = null
let mixer = null
let mouthMesh = null
let mouthIndex = null
let blinkLeftIndex = null
let blinkRightIndex = null

function findMorphIndex(mesh, keywords) {
  if (!mesh?.morphTargetDictionary) return null
  const entries = Object.entries(mesh.morphTargetDictionary)
  for (const [name, idx] of entries) {
    const n = name.toLowerCase()
    if (keywords.some(k => n.includes(k))) return idx
  }
  return null
}

function findFirstSkinnedMesh(root) {
  let found = null
  root.traverse(obj => {
    if (!found && obj.isSkinnedMesh) found = obj
  })
  return found
}

setStatus('Loading avatar…')
const loader = new GLTFLoader()
loader.load(
  '/models/RobotExpressive.glb',
  (gltf) => {
    avatarRoot = gltf.scene
    avatarRoot.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = false
        obj.receiveShadow = false
      }
    })

    // scale + position
    avatarRoot.scale.setScalar(0.9)
    avatarRoot.position.set(0, 0, 0)
    scene.add(avatarRoot)

    // try to locate morph targets on a skinned mesh
    const sk = findFirstSkinnedMesh(avatarRoot)
    mouthMesh = sk
    mouthIndex = findMorphIndex(sk, ['mouthopen', 'mouth_open', 'jawopen', 'jaw_open', 'aa', 'viseme'])
    blinkLeftIndex = findMorphIndex(sk, ['blinkleft', 'eyeblinkleft', 'eye_blink_l', 'blink_l'])
    blinkRightIndex = findMorphIndex(sk, ['blinkright', 'eyeblinkright', 'eye_blink_r', 'blink_r'])

    // animations
    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(avatarRoot)
      const idle = gltf.animations.find(a => /idle/i.test(a.name)) || gltf.animations[0]
      mixer.clipAction(idle).play()
    }

    fallbackGroup.visible = false
    setStatus('Idle')
  },
  undefined,
  (err) => {
    console.warn('Failed to load avatar', err)
    setStatus('Idle')
  }
)

// movement controls (WASD)
const keys = new Set()
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (['w', 'a', 's', 'd'].includes(k)) keys.add(k)
})
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase()
  keys.delete(k)
})

// Push-to-talk: hold Space to listen (when not typing in an input)
function isTypingTarget(el) {
  const tag = (el?.tagName || '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || el?.isContentEditable
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return
  if (e.code !== 'Space') return
  if (isTypingTarget(document.activeElement)) return
  if (!rec) return

  // don't steal spacebar from page scrolling
  e.preventDefault()

  state.pttActive = true
  state.lastFinalTranscript = ''
  startMic()
})

window.addEventListener('keyup', (e) => {
  if (e.code !== 'Space') return
  if (!state.pttActive) return
  state.pttActive = false

  e.preventDefault()
  stopMic()

  // If we captured a final transcript chunk, fire it on release.
  // (Conversation mode already auto-sends, so skip.)
  if (!state.conversationMode) {
    const sendText = (state.lastFinalTranscript || state.transcript || '').trim()
    state.lastFinalTranscript = ''
    if (sendText) {
      setDraftText('')
      sendUserMessage(sendText)
    }
  }
})

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
}

function setMorph(mesh, idx, value) {
  if (!mesh || idx == null || !mesh.morphTargetInfluences) return
  mesh.morphTargetInfluences[idx] = value
}

let t0 = performance.now()
function animate(now) {
  resize()
  const dt = Math.min(0.05, (now - t0) / 1000)
  t0 = now

  const t = now / 1000

  // fallback animation
  if (fallbackGroup.visible) {
    orb.rotation.y = t * 0.35
    orb.rotation.x = Math.sin(t * 0.4) * 0.05
    wire.rotation.copy(orb.rotation)
    const speakAmp = state.speaking ? 1 : 0
    mouthRing.scale.setScalar(1 + 0.35 * speakAmp + 0.05 * Math.sin(t * 24) * speakAmp)
    wire.material.opacity = 0.35 + 0.25 * speakAmp
    fallbackGroup.scale.setScalar(1 + 0.015 * Math.sin(t * 1.6))
  }

  if (avatarRoot) {
    avatarRoot.position.y = 0.02 * Math.sin(t * 1.2)

    const speed = 1.2
    const dz = (keys.has('w') ? -1 : 0) + (keys.has('s') ? 1 : 0)
    const dx = (keys.has('a') ? -1 : 0) + (keys.has('d') ? 1 : 0)
    if (dx || dz) {
      const v = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speed * dt)
      avatarRoot.position.add(v)
      const targetRot = Math.atan2(v.x, v.z)
      avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, targetRot, 0.12)
    } else {
      const toCam = new THREE.Vector3().subVectors(camera.position, avatarRoot.position)
      const targetRot = Math.atan2(toCam.x, toCam.z)
      avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, targetRot, 0.04)
    }

    const mouth = state.speaking ? (0.5 + 0.4 * Math.abs(Math.sin(t * 18))) : 0
    setMorph(mouthMesh, mouthIndex, mouth)

    const blink = Math.abs(Math.sin(t * 0.9 + 1.2)) < 0.04 ? 1 : 0
    setMorph(mouthMesh, blinkLeftIndex, blink)
    setMorph(mouthMesh, blinkRightIndex, blink)

    const desired = new THREE.Vector3(avatarRoot.position.x, 2.05, avatarRoot.position.z + 2.2)
    camera.position.lerp(desired, 0.05)
    camera.lookAt(avatarRoot.position.x, 1.95, avatarRoot.position.z)

    if (mixer) mixer.update(dt)
  }

  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
requestAnimationFrame(animate)
