import * as PIXI from 'pixi.js'
import { STATIONS, LOUNGE, PORTAL, stationForStepKind } from './stations.js'
import { damp } from './easing.js'

const COLORS = {
  bg0: 0x0b0f1a,
  bg1: 0x0f1526,
  ink: 0xe6edf7,
  muted: 0xa9b4c5,
  accent: 0xff3b3b,
  mint: 0x2dd4bf,
  lilac: 0xa78bfa,
  cyan: 0x22d3ee,
  amber: 0xf59e0b,
  ok: 0x34d399,
  bad: 0xef4444,
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

function colorFromString(s) {
  // stable hash -> hue palette
  const str = String(s || 'x')
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = (h ^ str.charCodeAt(i)) * 16777619
  const n = Math.abs(h >>> 0) % 6
  return [COLORS.cyan, COLORS.lilac, COLORS.mint, COLORS.amber, 0x60a5fa, 0xf472b6][n]
}

function labelStyle(size = 14, weight = '700', color = COLORS.ink, alpha = 0.95) {
  return new PIXI.TextStyle({
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    fontSize: size,
    fontWeight: weight,
    fill: color,
    align: 'left',
    letterSpacing: -0.2,
  })
}

export class TheatreScene {
  /** @param {{mount: HTMLElement, canvas?: HTMLCanvasElement}} opts */
  constructor(opts) {
    this.mount = opts.mount
    this.canvas = opts.canvas || null
    this.app = new PIXI.Application()
    this.ready = false
    this.world = new PIXI.Container()
    this.world.sortableChildren = true

    this.stationNodes = new Map() // stationId -> {c, monitorBar, alarm}
    this.agentNodes = new Map() // agentId -> {c, body, head, face, bubble, target, state, home, vel, limbs...}
    this.handoff = new PIXI.Graphics()
    this.handoff.zIndex = 30
    this.fx = new PIXI.Container()
    this.fx.zIndex = 26
    this.particles = [] // {g, x,y,vx,vy,life,maxLife,alpha0,scale0}
    this.particlePool = []

    this.tick = this.tick.bind(this)
  }

  async init() {
    await this.app.init({
      resizeTo: this.mount,
      canvas: this.canvas || undefined,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    })
    if (!this.canvas) this.mount.appendChild(this.app.canvas)
    this.app.stage.addChild(this.world)

    this.drawRoom()
    this.drawStations()
    this.world.addChild(this.handoff)
    this.world.addChild(this.fx)

    this.app.ticker.add(this.tick)
    this.ready = true
  }

  destroy() {
    try { this.app.destroy(true) } catch {}
  }

  drawRoom() {
    const g = new PIXI.Graphics()
    const w = 1200
    const h = 720
    g.roundRect(24, 24, w - 48, h - 48, 28)
      .fill({ color: COLORS.bg1, alpha: 0.9 })
      .stroke({ color: 0x2a3550, alpha: 0.35, width: 1 })

    // floor slab (2.5D)
    g.roundRect(70, 90, w - 140, h - 160, 26)
      .fill({ color: 0x0a1020, alpha: 0.95 })
      .stroke({ color: 0x334155, alpha: 0.18, width: 1 })

    // subtle grid
    for (let x = 90; x < w - 90; x += 64) {
      g.moveTo(x, 92).lineTo(x, h - 72).stroke({ color: 0xffffff, alpha: 0.02, width: 1 })
    }
    for (let y = 110; y < h - 72; y += 64) {
      g.moveTo(72, y).lineTo(w - 72, y).stroke({ color: 0xffffff, alpha: 0.018, width: 1 })
    }

    g.zIndex = 0
    this.world.addChild(g)
  }

  drawStations() {
    for (const st of STATIONS) {
      const node = this.createStation(st)
      this.stationNodes.set(st.id, node)
      this.world.addChild(node.c)
    }
    const lounge = this.createLounge()
    this.stationNodes.set('lounge', lounge)
    this.world.addChild(lounge.c)

    const portal = this.createPortal()
    this.stationNodes.set('portal', portal)
    this.world.addChild(portal.c)
  }

  createStation(st) {
    const c = new PIXI.Container()
    c.x = st.x
    c.y = st.y
    c.zIndex = 10

    const accent = (() => {
      if (st.kind === 'plan') return COLORS.cyan
      if (st.kind === 'implement') return COLORS.mint
      if (st.kind === 'verify') return COLORS.lilac
      if (st.kind === 'test') return 0x60a5fa
      if (st.kind === 'pr') return COLORS.amber
      if (st.kind === 'review') return 0xf472b6
      return COLORS.muted
    })()

    const base = new PIXI.Graphics()
    base.roundRect(-90, -46, 180, 92, 20)
      .fill({ color: 0x0d1426, alpha: 0.98 })
      .stroke({ color: 0x3b4a6a, alpha: 0.22, width: 1 })
    c.addChild(base)

    // soft shadow under base
    const shadow = new PIXI.Graphics()
    shadow.ellipse(0, 50, 86, 16).fill({ color: 0x000000, alpha: 0.25 })
    shadow.zIndex = -1
    c.addChildAt(shadow, 0)

    // monitor
    const monitor = new PIXI.Graphics()
    monitor.roundRect(-56, -22, 112, 44, 12)
      .fill({ color: 0x0b1020, alpha: 0.9 })
      .stroke({ color: 0x4b5563, alpha: 0.18, width: 1 })
    c.addChild(monitor)

    // Deekay-ish props per station (simple shapes, readable silhouettes).
    // Keep them subtle so the room reads as a "stage", not clutter.
    const props = new PIXI.Container()
    props.zIndex = 1
    c.addChild(props)

    const addPlant = (x, y, s = 1) => {
      const pot = new PIXI.Graphics()
      pot.roundRect(x - 10 * s, y + 6 * s, 20 * s, 14 * s, 6 * s)
        .fill({ color: 0x111827, alpha: 0.85 })
        .stroke({ color: 0xffffff, alpha: 0.08, width: 1 })
      const leaf = new PIXI.Graphics()
      leaf.moveTo(x, y)
      leaf.bezierCurveTo(x - 10 * s, y - 14 * s, x - 4 * s, y - 28 * s, x + 2 * s, y - 18 * s)
      leaf.bezierCurveTo(x + 10 * s, y - 8 * s, x + 8 * s, y + 2 * s, x, y)
      leaf.fill({ color: 0x22c55e, alpha: 0.8 })
      props.addChild(pot, leaf)
    }

    const addPapers = (x, y) => {
      const p = new PIXI.Graphics()
      p.roundRect(x, y, 18, 12, 3).fill({ color: 0xe2e8f0, alpha: 0.5 })
      p.roundRect(x + 6, y + 4, 18, 12, 3).fill({ color: 0xe2e8f0, alpha: 0.35 })
      props.addChild(p)
    }

    const addLamp = (x, y) => {
      const l = new PIXI.Graphics()
      l.roundRect(x, y, 6, 26, 3).fill({ color: 0x0b1020, alpha: 0.8 })
      l.roundRect(x - 8, y - 10, 22, 12, 6).fill({ color: 0xf59e0b, alpha: 0.25 })
      props.addChild(l)
    }

    if (st.id === 'devdesk') {
      addPlant(-78, -2, 0.9)
      addPapers(-38, 10)
      addLamp(74, 4)
    } else if (st.id === 'whiteboard') {
      addPapers(-12, 12)
    } else if (st.id === 'verifybench') {
      addPapers(-20, 10)
      addPlant(78, 0, 0.75)
    } else if (st.id === 'testrig') {
      // little "beaker"
      const b = new PIXI.Graphics()
      b.roundRect(76, 8, 12, 18, 4).fill({ color: 0x60a5fa, alpha: 0.22 })
      b.roundRect(76, 8, 12, 18, 4).stroke({ color: 0xffffff, alpha: 0.10, width: 1 })
      props.addChild(b)
    } else if (st.id === 'prkiosk') {
      // printer tray
      const pr = new PIXI.Graphics()
      pr.roundRect(-84, 12, 26, 10, 4).fill({ color: 0x0b1020, alpha: 0.75 })
      props.addChild(pr)
    } else if (st.id === 'reviewtable') {
      // coffee cups
      const cup = new PIXI.Graphics()
      cup.roundRect(70, 12, 10, 10, 3).fill({ color: 0x111827, alpha: 0.8 })
      cup.roundRect(84, 12, 10, 10, 3).fill({ color: 0x111827, alpha: 0.7 })
      props.addChild(cup)
    }

    // monitor glow (accent)
    const glow = new PIXI.Graphics()
    glow.roundRect(-56, -22, 112, 44, 12)
      .stroke({ color: accent, alpha: 0.14, width: 3 })
    c.addChild(glow)

    const monitorBar = new PIXI.Graphics()
    monitorBar.x = -52
    monitorBar.y = 10
    c.addChild(monitorBar)

    const alarm = new PIXI.Graphics()
    alarm.circle(72, -30, 7).fill({ color: COLORS.bad, alpha: 0.0 })
    c.addChild(alarm)

    const t = new PIXI.Text(st.label, labelStyle(12, '800', COLORS.muted))
    t.x = -86
    t.y = -70
    c.addChild(t)

    return { c, monitorBar, alarm, kind: st.kind }
  }

  createLounge() {
    const c = new PIXI.Container()
    c.x = LOUNGE.x
    c.y = LOUNGE.y
    c.zIndex = 5

    const g = new PIXI.Graphics()
    g.roundRect(-120, -44, 240, 88, 28)
      .fill({ color: 0x101827, alpha: 0.95 })
      .stroke({ color: 0x3b4a6a, alpha: 0.18, width: 1 })
    // couch cushions
    g.roundRect(-98, -22, 72, 44, 18).fill({ color: 0x0f1a2d, alpha: 0.95 })
    g.roundRect(-20, -22, 72, 44, 18).fill({ color: 0x0f1a2d, alpha: 0.95 })
    g.roundRect(58, -22, 50, 44, 18).fill({ color: 0x0f1a2d, alpha: 0.95 })
    c.addChild(g)

    const t = new PIXI.Text('Lounge', labelStyle(12, '800', COLORS.muted))
    t.x = -110
    t.y = -72
    c.addChild(t)

    return { c, monitorBar: null, alarm: null, kind: 'idle' }
  }

  createPortal() {
    const c = new PIXI.Container()
    c.x = PORTAL.x
    c.y = PORTAL.y
    c.zIndex = 6

    const g = new PIXI.Graphics()
    g.roundRect(-72, -42, 144, 84, 22)
      .fill({ color: 0x0b1224, alpha: 0.92 })
      .stroke({ color: 0x3b4a6a, alpha: 0.18, width: 1 })
    // portal ring
    g.circle(0, -6, 26).stroke({ color: COLORS.lilac, alpha: 0.35, width: 3 })
    g.circle(0, -6, 16).stroke({ color: COLORS.cyan, alpha: 0.22, width: 3 })
    c.addChild(g)

    const t = new PIXI.Text('Spawn', labelStyle(12, '800', COLORS.muted))
    t.x = -64
    t.y = -72
    c.addChild(t)

    return { c, monitorBar: null, alarm: null, kind: 'spawn' }
  }

  ensureAgentNode(a, idx, count) {
    if (this.agentNodes.has(a.id)) return this.agentNodes.get(a.id)

    const c = new PIXI.Container()
    c.zIndex = 20

    const accent = colorFromString(a.id || a.name || '')
    const outline = 0x0a1020

    // feet shadow
    const sh = new PIXI.Graphics()
    sh.ellipse(0, 18, 18, 8).fill({ color: 0x000000, alpha: 0.28 })
    c.addChild(sh)

    // body
    const body = new PIXI.Graphics()
    // Deekay-ish: bright fill + bold outline + soft accent ring.
    body.roundRect(-18, -10, 36, 32, 14)
      .fill({ color: 0xf1f5f9, alpha: 0.98 })
      .stroke({ color: outline, alpha: 0.85, width: 3 })
    body.roundRect(-18, -10, 36, 32, 14)
      .stroke({ color: accent, alpha: 0.22, width: 6 })
    c.addChild(body)

    // head
    const head = new PIXI.Graphics()
    head.circle(0, -24, 18)
      .fill({ color: 0xffffff, alpha: 0.98 })
      .stroke({ color: outline, alpha: 0.85, width: 3 })
    head.circle(0, -24, 18)
      .stroke({ color: accent, alpha: 0.18, width: 6 })
    c.addChild(head)

    // Limbs as containers so we can animate (walk cycle + working poses).
    const limbs = new PIXI.Container()
    limbs.zIndex = 19
    c.addChild(limbs)

    const mkLimb = (x, y, w, h, r = 8) => {
      const k = new PIXI.Container()
      k.x = x
      k.y = y
      k.pivot.set(w / 2, 0)
      const g = new PIXI.Graphics()
      g.roundRect(0, 0, w, h, r)
        .fill({ color: 0xf1f5f9, alpha: 0.98 })
        .stroke({ color: outline, alpha: 0.7, width: 2 })
      k.addChild(g)
      return k
    }

    const legL = mkLimb(-10, 6, 10, 18, 7)
    const legR = mkLimb(0, 6, 10, 18, 7)
    const armL = mkLimb(-26, -4, 11, 22, 8)
    const armR = mkLimb(15, -4, 11, 22, 8)
    limbs.addChild(legL, legR, armL, armR)

    const face = new PIXI.Graphics()
    c.addChild(face)

    const name = new PIXI.Text(a.name || a.id, labelStyle(11, '800', COLORS.ink))
    name.anchor.set(0.5, 0)
    name.y = 26
    name.alpha = 0.9
    c.addChild(name)

    const bubble = new PIXI.Container()
    bubble.zIndex = 40
    c.addChild(bubble)

    // home positions: a neat row near the middle, later they drift to lounge.
    const span = Math.max(1, Math.min(6, count))
    const col = idx % span
    const row = Math.floor(idx / span)
    const home = { x: 340 + col * 90, y: 320 + row * 70 }

    c.x = PORTAL.x
    c.y = PORTAL.y

    const node = {
      c,
      body,
      head,
      face,
      bubble,
      limbs,
      armL,
      armR,
      legL,
      legR,
      target: { x: home.x, y: home.y },
      home,
      state: 'spawning',
      lastState: 'spawning',
      bob: Math.random() * Math.PI * 2,
      walk: Math.random() * Math.PI * 2,
      shake: 0,
      vel: { x: 0, y: 0 },
      spawnT: 0,
      accent,
      outline,
    }

    this.agentNodes.set(a.id, node)
    this.world.addChild(c)
    return node
  }

  setBubble(node, text, kind = 'think') {
    node.bubble.removeChildren()
    if (!text) return

    const bg = new PIXI.Graphics()
    const w = Math.min(220, 10 + text.length * 6.8)
    bg.roundRect(-w / 2, -72, w, 34, 12)
      .fill({ color: 0x0b1020, alpha: 0.78 })
      .stroke({ color: node.outline || 0x0a1020, alpha: 0.45, width: 2 })
    node.bubble.addChild(bg)

    const t = new PIXI.Text(text, labelStyle(12, '700', COLORS.ink))
    t.anchor.set(0.5, 0.5)
    t.x = 0
    t.y = -55
    t.alpha = 0.95
    node.bubble.addChild(t)

    const dot = new PIXI.Graphics()
    const c = (kind === 'alert') ? COLORS.bad : ((kind === 'speak') ? COLORS.amber : COLORS.cyan)
    dot.circle(-w / 2 + 10, -55, 4).fill({ color: c, alpha: 0.9 })
    node.bubble.addChild(dot)
  }

  drawFace(node, state) {
    node.face.clear()
    const mood = String(state || 'idle')

    // eyes
    node.face.circle(-6.5, -28, 2.3).fill({ color: node.outline || 0x0a1020, alpha: 0.9 })
    node.face.circle(6.5, -28, 2.3).fill({ color: node.outline || 0x0a1020, alpha: 0.9 })

    // mouth
    if (mood === 'blocked') {
      node.face.moveTo(-7, -20).lineTo(7, -20).stroke({ color: COLORS.bad, alpha: 0.75, width: 2.5 })
    } else if (mood === 'thinking') {
      node.face.arc(0, -20, 6.5, Math.PI, Math.PI * 1.65).stroke({ color: COLORS.cyan, alpha: 0.7, width: 2.5 })
    } else if (mood === 'working') {
      node.face.arc(0, -20, 6.5, 0, Math.PI).stroke({ color: COLORS.mint, alpha: 0.7, width: 2.5 })
    } else if (mood === 'collaborating') {
      node.face.arc(0, -20, 6.5, 0, Math.PI).stroke({ color: COLORS.lilac, alpha: 0.7, width: 2.5 })
    } else {
      node.face.arc(0, -20, 5.8, 0, Math.PI).stroke({ color: node.outline || 0x0a1020, alpha: 0.6, width: 2.4 })
    }
  }

  applyStateToTarget(a) {
    const state = String(a.state || 'idle')
    const stepKind = String(a.lastStepKind || '')

    if (state === 'spawning') return { x: PORTAL.x, y: PORTAL.y }
    if (state === 'blocked') {
      const sid = stationForStepKind(stepKind) || 'devdesk'
      const st = this.stationNodes.get(sid)
      if (st) return { x: st.c.x + 72, y: st.c.y + 34 }
      return { x: 520, y: 360 }
    }
    if (state === 'thinking') {
      const st = this.stationNodes.get('whiteboard')
      if (st) return { x: st.c.x + 84, y: st.c.y + 44 }
      return { x: 200, y: 160 }
    }
    if (state === 'collaborating') {
      const st = this.stationNodes.get('reviewtable')
      if (st) return { x: st.c.x - 20, y: st.c.y + 48 }
      return { x: 820, y: 420 }
    }
    if (state === 'working') {
      const sid = stationForStepKind(stepKind) || 'devdesk'
      const st = this.stationNodes.get(sid)
      if (st) return { x: st.c.x, y: st.c.y + 60 }
      return { x: 520, y: 240 }
    }
    // idle
    return { x: LOUNGE.x, y: LOUNGE.y + 46 }
  }

  render(s) {
    const agents = Object.values(s.agents || {})
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))

    // ensure nodes
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i]
      const node = this.ensureAgentNode(a, i, agents.length)
      node.state = a.state || 'idle'
      if (node.lastState !== node.state) {
        node.lastState = node.state
        node.shake = (node.state === 'blocked') ? 1 : 0
        if (node.state === 'spawning') node.spawnT = 0
      }
      node.target = this.applyStateToTarget(a)

      // bubble content (small + readable)
      const d = String(a.detail || '')
      if (node.state === 'working' && d) this.setBubble(node, d.slice(0, 28), 'speak')
      else if (node.state === 'thinking' && d) this.setBubble(node, d.slice(0, 28), 'think')
      else if (node.state === 'blocked') this.setBubble(node, (a.blockedReason || 'blocked').slice(0, 28), 'alert')
      else node.bubble.removeChildren()

      this.drawFace(node, node.state)
    }

    // station monitors: show progress if any claimed step is mapped there
    for (const [stationId, node] of this.stationNodes.entries()) {
      if (!node.monitorBar) continue
      node.monitorBar.clear()
      node.alarm.alpha = 0.0

      const active = Object.values(s.steps || {}).find((st) => {
        if (st.status !== 'claimed') return false
        const sid = stationForStepKind(st.kind)
        return sid === stationId
      })

      const failed = Object.values(s.steps || {}).find((st) => {
        if (st.status !== 'failed') return false
        const sid = stationForStepKind(st.kind)
        return sid === stationId
      })

      if (failed) {
        node.alarm.alpha = 0.45 + 0.35 * Math.sin(performance.now() / 180)
      }

      if (!active) continue

      const done = (active.progress?.done == null) ? null : Number(active.progress.done)
      const total = (active.progress?.total == null) ? null : Number(active.progress.total)
      let p = 0.2
      if (done != null && total != null && total > 0) p = Math.max(0.05, Math.min(1, done / total))

      node.monitorBar.roundRect(0, 0, 104, 6, 4).fill({ color: 0x111827, alpha: 0.7 })
      node.monitorBar.roundRect(0, 0, 104 * p, 6, 4).fill({ color: COLORS.cyan, alpha: 0.92 })
    }

    // simple handoff effect: if any agent is collaborating, draw link to nearest other agent
    this.handoff.clear()
    const collab = agents.filter((a) => (a.state === 'collaborating'))
    if (collab.length >= 1 && agents.length >= 2) {
      const a0 = collab[0]
      const n0 = this.agentNodes.get(a0.id)
      const other = agents.find((a) => a.id !== a0.id) || null
      const n1 = other ? this.agentNodes.get(other.id) : null
      if (n0 && n1) {
        this.handoff.moveTo(n0.c.x, n0.c.y - 8).lineTo(n1.c.x, n1.c.y - 8)
          .stroke({ color: COLORS.lilac, alpha: 0.25, width: 2 })
        // packet dot
        const t = (performance.now() / 700) % 1
        const px = n0.c.x + (n1.c.x - n0.c.x) * t
        const py = (n0.c.y - 8) + ((n1.c.y - 8) - (n0.c.y - 8)) * t
        this.handoff.circle(px, py, 4).fill({ color: COLORS.amber, alpha: 0.9 })
      }
    }
  }

  tick(dt) {
    if (!this.ready) return
    const deltaSec = (dt?.deltaTime || 1) / 60

    // Particles: update + cull.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= deltaSec
      if (p.life <= 0) {
        try { this.fx.removeChild(p.g) } catch {}
        this.particlePool.push(p.g)
        this.particles.splice(i, 1)
        continue
      }
      p.x += p.vx * deltaSec
      p.y += p.vy * deltaSec
      const t = 1 - (p.life / p.maxLife)
      p.g.x = p.x
      p.g.y = p.y
      p.g.alpha = (p.alpha0 ?? 1) * (1 - t)
      const s = (p.scale0 ?? 1) * (1 - 0.2 * t)
      p.g.scale.set(s)
    }

    for (const node of this.agentNodes.values()) {
      node.bob += deltaSec * 2.2
      const bobY = Math.sin(node.bob) * 1.8

      const tx = node.target?.x ?? node.home.x
      const ty = node.target?.y ?? node.home.y

      // Springy movement (Deekay-ish): acceleration toward target, plus damping.
      const k = 40.0
      const d = 12.5
      const ax = (tx - node.c.x) * k
      const ay = ((ty + bobY) - node.c.y) * k
      node.vel.x += ax * deltaSec
      node.vel.y += ay * deltaSec
      node.vel.x *= Math.exp(-d * deltaSec)
      node.vel.y *= Math.exp(-d * deltaSec)
      node.c.x += node.vel.x * deltaSec
      node.c.y += node.vel.y * deltaSec

      // Walk cycle (based on speed) + state poses.
      const speed = Math.hypot(node.vel.x, node.vel.y)
      const walking = speed > 36
      node.walk += deltaSec * (walking ? Math.min(10, 3 + speed / 30) : 1.6)
      const phase = Math.sin(node.walk)
      const swing = walking ? phase : 0

      // Default pose.
      const armBase = 0
      const legBase = 0

      // Pose based on state: working = subtle typing, thinking = hand-to-chin-ish, blocked = slumped.
      const st = String(node.state || 'idle')
      if (st === 'working') {
        node.armL.rotation = damp(node.armL.rotation, -0.35 + 0.08 * Math.sin(node.walk * 2.6), 14.0, deltaSec)
        node.armR.rotation = damp(node.armR.rotation, 0.35 + 0.08 * Math.sin(node.walk * 2.2), 14.0, deltaSec)
        node.legL.rotation = damp(node.legL.rotation, 0.05 * swing, 14.0, deltaSec)
        node.legR.rotation = damp(node.legR.rotation, -0.05 * swing, 14.0, deltaSec)
      } else if (st === 'thinking') {
        node.armL.rotation = damp(node.armL.rotation, -0.55, 12.0, deltaSec)
        node.armR.rotation = damp(node.armR.rotation, 0.10, 12.0, deltaSec)
        node.legL.rotation = damp(node.legL.rotation, 0.06 * swing, 12.0, deltaSec)
        node.legR.rotation = damp(node.legR.rotation, -0.06 * swing, 12.0, deltaSec)
      } else if (st === 'blocked') {
        node.armL.rotation = damp(node.armL.rotation, -0.15, 10.0, deltaSec)
        node.armR.rotation = damp(node.armR.rotation, 0.15, 10.0, deltaSec)
        node.legL.rotation = damp(node.legL.rotation, -0.10, 10.0, deltaSec)
        node.legR.rotation = damp(node.legR.rotation, 0.10, 10.0, deltaSec)
      } else {
        node.armL.rotation = damp(node.armL.rotation, armBase + 0.35 * swing, 10.0, deltaSec)
        node.armR.rotation = damp(node.armR.rotation, -armBase - 0.35 * swing, 10.0, deltaSec)
        node.legL.rotation = damp(node.legL.rotation, legBase - 0.45 * swing, 10.0, deltaSec)
        node.legR.rotation = damp(node.legR.rotation, legBase + 0.45 * swing, 10.0, deltaSec)
      }

      // Tiny squash/stretch so characters feel alive.
      const sxy = 1 + (walking ? 0.02 * Math.sin(node.walk * 2) : 0.01 * Math.sin(node.bob * 2))
      node.limbs.scale.set(1, sxy)

      // blocked wobble
      if (node.state === 'blocked') {
        node.c.rotation = damp(node.c.rotation, Math.sin(node.bob * 3) * 0.06, 10.0, deltaSec)
        node.c.y += 4
      } else {
        node.c.rotation = damp(node.c.rotation, 0, 10.0, deltaSec)
      }

      // spawning pop-in
      if (node.state === 'spawning') {
        node.spawnT = clamp(node.spawnT + deltaSec * 1.8, 0, 1)
        const t = node.spawnT
        // easeOutBack-ish
        const c1 = 1.70158
        const c3 = c1 + 1
        const e = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
        node.c.scale.set(0.2 + 0.8 * e)
      } else {
        node.c.scale.set(damp(node.c.scale.x, 1, 9.0, deltaSec))
      }

      // Emit small particles (low rate, readable).
      // Working: typing sparks near head.
      if (st === 'working' && Math.random() < 0.14 * deltaSec * 60) {
        this.emitParticle(node.c.x + 8, node.c.y - 8, 30 * (Math.random() - 0.5), -40 - 20 * Math.random(), COLORS.cyan, 0.6, 0.55)
      }
      // Thinking: bubble dots above head.
      if (st === 'thinking' && Math.random() < 0.10 * deltaSec * 60) {
        this.emitParticle(node.c.x - 10 + 20 * Math.random(), node.c.y - 56, 6 * (Math.random() - 0.5), -16 - 10 * Math.random(), COLORS.amber, 0.45, 0.85)
      }
      // Blocked: alert pings.
      if (st === 'blocked' && Math.random() < 0.08 * deltaSec * 60) {
        this.emitParticle(node.c.x + 18 * (Math.random() - 0.5), node.c.y - 52, 10 * (Math.random() - 0.5), -24 - 10 * Math.random(), COLORS.bad, 0.55, 0.9)
      }
    }
  }

  emitParticle(x, y, vx, vy, color, radius = 0.6, life = 0.6) {
    const g = this.particlePool.pop() || new PIXI.Graphics()
    g.clear()
    g.circle(0, 0, 6 * radius).fill({ color, alpha: 0.95 })
    g.x = x
    g.y = y
    g.alpha = 1
    g.scale.set(1)
    this.fx.addChild(g)
    this.particles.push({
      g,
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      alpha0: 0.9,
      scale0: 1,
    })
  }
}
