import './style.css'
import * as THREE from 'three'

// ---------- UI ----------
const elStatus = document.getElementById('status')
const elMicStatus = document.getElementById('micStatus')
const btnMic = document.getElementById('btnMic')
const btnTalk = document.getElementById('btnTalk')
const btnSend = document.getElementById('btnSend')
const btnClear = document.getElementById('btnClear')
const input = document.getElementById('input')
const chatlog = document.getElementById('chatlog')

const state = {
  listening: false,
  speaking: false,
  transcript: '',
}

function setStatus(text) {
  elStatus.textContent = text
}
function setMic(text) {
  elMicStatus.textContent = text
}

function addMsg(role, text) {
  const d = document.createElement('div')
  d.className = `msg ${role}`
  const meta = document.createElement('div')
  meta.className = 'meta'
  meta.textContent = role === 'user' ? 'You' : 'Cal'
  const body = document.createElement('div')
  body.textContent = text
  d.appendChild(meta)
  d.appendChild(body)
  chatlog.prepend(d)
}

// ---------- Voice (Web Speech API) ----------
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
    state.transcript = (finalText + ' ' + interimText).trim()
    input.value = state.transcript
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
  }
  rec.onerror = (e) => {
    console.warn('SpeechRecognition error', e)
    setMic('Mic error')
  }
} else {
  setMic('Mic: unavailable (use Chrome)')
  btnMic.disabled = true
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    addMsg('cal', text)
    return
  }
  window.speechSynthesis.cancel()

  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1.02
  u.pitch = 1.0
  u.volume = 1.0

  // Choose a decent voice if available
  const voices = window.speechSynthesis.getVoices?.() || []
  const preferred = voices.find(v => /Samantha|Alex|Daniel|Google US English/i.test(v.name))
  if (preferred) u.voice = preferred

  u.onstart = () => { state.speaking = true; setStatus('Speaking') }
  u.onend = () => { state.speaking = false; setStatus('Idle') }
  u.onerror = () => { state.speaking = false; setStatus('Idle') }

  addMsg('cal', text)
  window.speechSynthesis.speak(u)
}

function calRespond(userText) {
  // Placeholder: local “buddy” response. Next step is wiring to Clawdbot gateway/agent.
  const trimmed = (userText || '').trim()
  if (!trimmed) return

  // simple vibe
  const reply = `Got you. I heard: “${trimmed}”.\n\nI’m spinning up the Cal Portal (voice + 3D avatar) as our first project; next we’ll wire this UI into the real agent so you can talk to me hands-free.`
  speak(reply)
}

btnMic?.addEventListener('click', () => {
  if (!rec) return
  if (state.listening) rec.stop()
  else rec.start()
})

btnTalk?.addEventListener('click', () => {
  const t = input.value.trim() || 'Hey Josh. I’m here. What are we building first?'
  speak(t)
})

btnSend?.addEventListener('click', () => {
  const t = input.value.trim()
  if (!t) return
  addMsg('user', t)
  input.value = ''
  state.transcript = ''
  calRespond(t)
})

btnClear?.addEventListener('click', () => {
  chatlog.innerHTML = ''
})

setStatus('Idle')

// ---------- Three.js: simple “Cal brain orb” ----------
const canvas = document.getElementById('c')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const scene = new THREE.Scene()
scene.background = new THREE.Color('#0b1220')

const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 100)
camera.position.set(0, 0.6, 2.4)

const ambient = new THREE.AmbientLight(0xffffff, 0.55)
scene.add(ambient)

const key = new THREE.DirectionalLight(0x88e1ff, 0.9)
key.position.set(2, 2, 2)
scene.add(key)

const rim = new THREE.DirectionalLight(0xa78bfa, 0.65)
rim.position.set(-2, 1.5, -2)
scene.add(rim)

// Orb
const geo = new THREE.IcosahedronGeometry(0.62, 5)
const mat = new THREE.MeshStandardMaterial({
  color: 0x0f172a,
  roughness: 0.25,
  metalness: 0.3,
  emissive: new THREE.Color('#111827'),
  emissiveIntensity: 0.35,
})
const orb = new THREE.Mesh(geo, mat)
scene.add(orb)

// Neon wireframe overlay
const wire = new THREE.LineSegments(
  new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.64, 4)),
  new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.45 })
)
scene.add(wire)

// “Mouth” ring (animates on speech)
const mouth = new THREE.Mesh(
  new THREE.TorusGeometry(0.18, 0.02, 16, 64),
  new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x7c3aed, emissiveIntensity: 1.0 })
)
mouth.position.set(0, -0.12, 0.58)
mouth.rotation.x = Math.PI / 2
scene.add(mouth)

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
}

let t0 = performance.now()
function animate(now) {
  resize()
  const dt = (now - t0) / 1000
  t0 = now

  const t = now / 1000
  orb.rotation.y = t * 0.35
  orb.rotation.x = Math.sin(t * 0.4) * 0.05
  wire.rotation.copy(orb.rotation)

  // speaking animation
  const speakAmp = state.speaking ? 1 : 0
  mouth.scale.setScalar(1 + 0.35 * speakAmp + 0.05 * Math.sin(t * 24) * speakAmp)
  wire.material.opacity = 0.35 + 0.25 * speakAmp

  // gentle breathing
  const breath = 1 + 0.015 * Math.sin(t * 1.6)
  orb.scale.setScalar(breath)

  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
requestAnimationFrame(animate)

// ensure voices list is populated on some platforms
window.speechSynthesis?.getVoices?.()
