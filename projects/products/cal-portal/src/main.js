import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

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

// ---------- Three.js: Cal in a small space ----------
const canvas = document.getElementById('c')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const scene = new THREE.Scene()
scene.background = new THREE.Color('#0b1220')

const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 100)
// default framing: face/upper-body
camera.position.set(0, 1.6, 2.6)

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

const grid = new THREE.GridHelper(20, 20, 0x1f2a44, 0x111827)
grid.position.y = 0.001
scene.add(grid)

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
    blinkLeftIndex = findMorphIndex(sk, ['blinkleft', 'eyeBlinkLeft'.toLowerCase(), 'eye_blink_l', 'blink_l'])
    blinkRightIndex = findMorphIndex(sk, ['blinkright', 'eyeBlinkRight'.toLowerCase(), 'eye_blink_r', 'blink_r'])

    // animations
    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(avatarRoot)
      // prefer idle if present
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
  keys.add(e.key.toLowerCase())
})
window.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase())
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

  // avatar idle breathing + look-at camera
  if (avatarRoot) {
    // subtle bob
    avatarRoot.position.y = 0.02 * Math.sin(t * 1.2)

    // basic movement
    const speed = 1.2
    const dz = (keys.has('w') ? -1 : 0) + (keys.has('s') ? 1 : 0)
    const dx = (keys.has('a') ? -1 : 0) + (keys.has('d') ? 1 : 0)
    if (dx || dz) {
      const v = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speed * dt)
      avatarRoot.position.add(v)
      // face direction of travel
      const targetRot = Math.atan2(v.x, v.z)
      avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, targetRot, 0.12)
    } else {
      // slowly face camera when idle
      const toCam = new THREE.Vector3().subVectors(camera.position, avatarRoot.position)
      const targetRot = Math.atan2(toCam.x, toCam.z)
      avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, targetRot, 0.04)
    }

    // speech-driven mouth (best effort)
    const mouth = state.speaking ? (0.5 + 0.4 * Math.abs(Math.sin(t * 18))) : 0
    setMorph(mouthMesh, mouthIndex, mouth)

    // blinking
    const blink = Math.abs(Math.sin(t * 0.9 + 1.2)) < 0.04 ? 1 : 0
    setMorph(mouthMesh, blinkLeftIndex, blink)
    setMorph(mouthMesh, blinkRightIndex, blink)

    // keep camera roughly following
    const desired = new THREE.Vector3(avatarRoot.position.x, 1.6, avatarRoot.position.z + 2.4)
    camera.position.lerp(desired, 0.05)
    camera.lookAt(avatarRoot.position.x, 1.45, avatarRoot.position.z)

    if (mixer) mixer.update(dt)
  }

  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
requestAnimationFrame(animate)

// ensure voices list is populated on some platforms
window.speechSynthesis?.getVoices?.()
