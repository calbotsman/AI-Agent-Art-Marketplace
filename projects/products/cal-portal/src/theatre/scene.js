import * as PIXI from 'pixi.js'
import { STATIONS, LOUNGE, PORTAL, stationForStepKind } from './stations.js'
import { damp } from './easing.js'

// Deekay-ish: bright fills, thick clean outlines, 2-tone shading, restrained accents.
const COLORS = {
  outline: 0x152235,      // deep blue-gray (linework)
  outlineSoft: 0x20314a,  // softer line for secondary strokes
  ink: 0x0b1220,          // text/ink when needed
  paper: 0xffffff,        // main fill
  shade: 0xe8eef8,        // subtle shadow fill
  stageNight: 0x0b1020,   // wall
  stageNight2: 0x0a1428,  // floor
  stageDay: 0xf6f7fb,     // wall
  stageDay2: 0xecf0f7,    // floor

  cyan: 0x2dd4ff,
  lilac: 0xb7a6ff,
  mint: 0x34d399,
  amber: 0xfbbf24,
  pink: 0xfb7185,

  ok: 0x22c55e,
  bad: 0xef4444,
  muted: 0x7b8aa4,
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

function hashNum(s) {
  const str = String(s || 'x')
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = (h ^ str.charCodeAt(i)) * 16777619
  return (h >>> 0)
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

    this.theme = 'night' // 'day' | 'night'
    this.roomLayer = new PIXI.Container()
    this.roomLayer.zIndex = 0

    this.stationNodes = new Map() // stationId -> {c, monitorBar, alarm}
    this.agentNodes = new Map() // agentId -> {c, body, head, face, bubble, target, state, home, vel, limbs...}
    this.handoff = new PIXI.Graphics()
    this.handoff.zIndex = 30
    this.fx = new PIXI.Container()
    this.fx.zIndex = 26
    this.particles = [] // {g, x,y,vx,vy,life,maxLife,alpha0,scale0}
    this.particlePool = []

    // Kenney character skins (idle/run/work). This gives us true walk cycles today.
    // Each skin: { idle: [tex], run: [tex...], work: [tex...] }
    this.skins = []
    this.propTex = {} // { [name: string]: PIXI.Texture }

    // Player avatar (you). View-layer only, not part of the reducer.
    this.player = null
    this.playerKeys = { x: 0, y: 0 }

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

    await this.loadKenneySkins()
    await this.loadPropTextures()
    this.world.addChild(this.roomLayer)
    this.drawRoom()
    this.drawStations()
    this.world.addChild(this.handoff)
    this.world.addChild(this.fx)
    this.createPlayer()

    this.app.ticker.add(this.tick)
    this.ready = true
  }

  async loadKenneySkins() {
    // Kenney Isometric Prototype Tiles includes multiple human variants with:
    // - Human_X_Idle0.png
    // - Human_X_Run0..Run9.png
    // - Human_X_Pickup0..Pickup9.png  (good enough for "working")
    try {
      const skins = []
      for (let skin = 0; skin < 8; skin++) {
        const idleTex = await PIXI.Assets.load(`/src/assets/kenney/Characters/Human/Human_${skin}_Idle0.png`)
        if (!idleTex) continue

        const run = []
        for (let i = 0; i < 10; i++) {
          const t = await PIXI.Assets.load(`/src/assets/kenney/Characters/Human/Human_${skin}_Run${i}.png`)
          if (t) run.push(t)
        }

        const work = []
        for (let i = 0; i < 10; i++) {
          const t = await PIXI.Assets.load(`/src/assets/kenney/Characters/Human/Human_${skin}_Pickup${i}.png`)
          if (t) work.push(t)
        }

        skins.push({ idle: [idleTex], run, work })
      }
      this.skins = skins
    } catch {
      this.skins = []
    }
  }

  async loadPropTextures() {
    // Quick way to add "desk detail" without hand-drawing everything: use Kenney preview sprites
    // as small props. We'll keep alpha low so they read as set dressing, not a style clash.
    try {
      const wanted = [
        ['chair', '/src/assets/kenney/Previews/chair.png'],
        ['computer', '/src/assets/kenney/Previews/computer.png'],
        ['computerSystem', '/src/assets/kenney/Previews/computer-system.png'],
        ['computerWide', '/src/assets/kenney/Previews/computer-wide.png'],
        ['computerScreen', '/src/assets/kenney/Previews/computer-screen.png'],
        ['table', '/src/assets/kenney/Previews/table.png'],
        ['tableLarge', '/src/assets/kenney/Previews/table-large.png'],
      ]
      const out = {}
      for (const [k, url] of wanted) {
        const tex = await PIXI.Assets.load(url)
        if (tex) out[k] = tex
      }
      this.propTex = out
    } catch {
      this.propTex = {}
    }
  }

  destroy() {
    try { this.app.destroy(true) } catch {}
  }

  drawRoom() {
    this.roomLayer.removeChildren()

    const g = new PIXI.Graphics()
    const w = 1200
    const h = 720
    // Deekay-ish room: readable shapes, bold-ish strokes, "studio" dressing.
    const isDay = this.theme === 'day'
    const stroke = { color: COLORS.outline, alpha: isDay ? 0.28 : 0.42, width: 4 }
    const wall = isDay ? COLORS.stageDay : COLORS.stageNight
    const floor = isDay ? COLORS.stageDay2 : COLORS.stageNight2
    g.roundRect(24, 24, w - 48, h - 48, 28)
      .fill({ color: wall, alpha: isDay ? 0.86 : 0.92 })
      .stroke(stroke)

    // floor slab (2.5D)
    g.roundRect(70, 90, w - 140, h - 160, 26)
      .fill({ color: floor, alpha: isDay ? 0.92 : 0.95 })
      .stroke({ color: COLORS.outline, alpha: isDay ? 0.18 : 0.26, width: 3 })

    // Deekay-ish “paper texture”: sparse dots (keeps it lively, not noisy).
    const dotAlpha = isDay ? 0.06 : 0.10
    for (let i = 0; i < 140; i++) {
      const x = 90 + Math.random() * (w - 180)
      const y = 110 + Math.random() * (h - 220)
      g.circle(x, y, 1.2 + Math.random() * 1.2).fill({ color: COLORS.outline, alpha: dotAlpha * (0.4 + Math.random() * 0.8) })
    }

    g.zIndex = 0
    this.roomLayer.addChild(g)

    // Studio dressing: window, clock, shelves, posters. Still simple shapes but more character.
    const deco = new PIXI.Container()
    deco.zIndex = 2
    this.roomLayer.addChild(deco)

    const win = new PIXI.Graphics()
    win.roundRect(90, 48, 260, 120, 22)
      .fill({ color: isDay ? 0xffffff : 0x0b1020, alpha: isDay ? 0.55 : 0.60 })
      .stroke({ color: COLORS.outline, alpha: isDay ? 0.22 : 0.26, width: 3 })
    win.roundRect(102, 60, 236, 96, 18).fill({ color: isDay ? 0x93c5fd : 0x60a5fa, alpha: isDay ? 0.18 : 0.12 })
    // simple blinds lines
    for (let y = 72; y < 148; y += 14) {
      win.moveTo(110, y).lineTo(330, y).stroke({ color: COLORS.outline, alpha: isDay ? 0.06 : 0.10, width: 2 })
    }
    deco.addChild(win)

    const clock = new PIXI.Graphics()
    const cx = 600, cy = 66
    clock.circle(cx, cy, 26).fill({ color: isDay ? 0xffffff : 0x0b1020, alpha: isDay ? 0.65 : 0.75 }).stroke({ color: COLORS.outline, alpha: 0.22, width: 3 })
    clock.moveTo(cx, cy).lineTo(cx, cy - 12).stroke({ color: COLORS.outline, alpha: 0.55, width: 2 })
    clock.moveTo(cx, cy).lineTo(cx + 10, cy + 6).stroke({ color: COLORS.outline, alpha: 0.45, width: 2 })
    deco.addChild(clock)

    const shelf = new PIXI.Graphics()
    shelf.roundRect(860, 56, 250, 18, 10).fill({ color: isDay ? 0xffffff : 0x0b1020, alpha: isDay ? 0.45 : 0.65 }).stroke({ color: COLORS.outline, alpha: 0.18, width: 2 })
    // books
    for (let i = 0; i < 8; i++) {
      const bx = 878 + i * 26
      const bh = 26 + (i % 3) * 8
      shelf.roundRect(bx, 30 + (34 - bh), 18, bh, 6).fill({ color: [0xa78bfa, 0x22d3ee, 0x2dd4bf, 0xf59e0b][i % 4], alpha: 0.28 })
    }
    // small plant
    shelf.roundRect(1094, 36, 18, 14, 6).fill({ color: 0x111827, alpha: 0.8 })
    shelf.circle(1103, 32, 10).fill({ color: 0x22c55e, alpha: 0.25 })
    deco.addChild(shelf)

    // Tiny "sun/moon" indicator so it feels alive.
    const orb = new PIXI.Graphics()
    orb.circle(1120, 72, 10).fill({ color: isDay ? COLORS.amber : 0x93c5fd, alpha: 0.55 })
    deco.addChild(orb)
  }

  setTheme(theme) {
    const t = (theme === 'day') ? 'day' : 'night'
    if (this.theme === t) return
    this.theme = t
    this.drawRoom()
  }

  createPlayer() {
    if (this.player) return
    const c = new PIXI.Container()
    c.zIndex = 21
    const outline = 0x0a1020

    // shadow
    const sh = new PIXI.Graphics()
    sh.ellipse(0, 18, 18, 8).fill({ color: 0x000000, alpha: 0.22 })
    c.addChild(sh)

    // Player uses the same Kenney skin system.
    const skinIdx = 0
    const skin = this.skins?.[skinIdx]
    let anim = null
    if (skin?.idle?.length) {
      anim = new PIXI.AnimatedSprite(skin.idle)
      anim.anchor.set(0.5, 1.0)
      anim.x = 0
      anim.y = 18
      const targetH = 120
      const s = targetH / Math.max(1, anim.height)
      anim.scale.set(s)
      anim.loop = true
      anim.gotoAndStop(0)
      anim.alpha = 0.98
      c.addChild(anim)
    } else {
      const fallback = new PIXI.Graphics()
      fallback.roundRect(-18, -10, 36, 44, 16)
        .fill({ color: 0xf1f5f9, alpha: 0.98 })
        .stroke({ color: outline, alpha: 0.85, width: 3 })
      c.addChild(fallback)
    }

    const name = new PIXI.Text('You', labelStyle(11, '900', COLORS.ink))
    name.anchor.set(0.5, 0)
    name.y = 26
    name.alpha = 0.92
    c.addChild(name)

    c.x = 980
    c.y = 560

    this.player = {
      c,
      skinIdx,
      skin,
      anim,
      animMode: 'idle',
      animBaseScale: anim ? Math.abs(anim.scale.x || 1) : 1,
      facing: 1,
      vel: { x: 0, y: 0 },
      walk: Math.random() * Math.PI * 2,
      bob: Math.random() * Math.PI * 2,
    }
    this.world.addChild(c)
  }

  setPlayerIntent(dx, dy) {
    this.playerKeys.x = clamp(dx, -1, 1)
    this.playerKeys.y = clamp(dy, -1, 1)
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
      if (st.kind === 'review') return COLORS.pink
      return COLORS.muted
    })()

    const base = new PIXI.Graphics()
    base.roundRect(-90, -46, 180, 92, 20)
      .fill({ color: (this.theme === 'day') ? 0xffffff : 0x0d1426, alpha: (this.theme === 'day') ? 0.35 : 0.98 })
      .stroke({ color: COLORS.outline, alpha: 0.20, width: 3 })
    c.addChild(base)

    // soft shadow under base
    const shadow = new PIXI.Graphics()
    shadow.ellipse(0, 50, 86, 16).fill({ color: 0x000000, alpha: 0.25 })
    shadow.zIndex = -1
    c.addChildAt(shadow, 0)

    // monitor
    const monitor = new PIXI.Graphics()
    monitor.roundRect(-56, -22, 112, 44, 12)
      .fill({ color: 0x0b1020, alpha: 0.85 })
      .stroke({ color: COLORS.outline, alpha: 0.22, width: 2 })
    c.addChild(monitor)

    // Deekay-ish props per station (simple shapes, readable silhouettes).
    // Keep them subtle so the room reads as a "stage", not clutter.
    const props = new PIXI.Container()
    props.zIndex = 1
    c.addChild(props)

    const addKenneyProp = (key, x, y, scale, alpha = 0.42, tint = null) => {
      const tex = this.propTex?.[key]
      if (!tex) return null
      const sp = new PIXI.Sprite(tex)
      sp.anchor.set(0.5, 1)
      sp.x = x
      sp.y = y
      sp.scale.set(scale)
      sp.alpha = alpha
      if (tint != null) sp.tint = tint
      // ensure props stay behind the monitor stroke/glow
      sp.zIndex = 0
      props.addChild(sp)
      return sp
    }

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
      addKenneyProp('computerSystem', -18, 44, 0.20, 0.34)
      addKenneyProp('chair', 70, 46, 0.20, 0.28)
      addPlant(-78, -2, 0.9)
      addPapers(-38, 10)
      addLamp(74, 4)
    } else if (st.id === 'whiteboard') {
      addPapers(-12, 12)
    } else if (st.id === 'verifybench') {
      addKenneyProp('computerWide', -18, 44, 0.19, 0.30)
      addPapers(-20, 10)
      addPlant(78, 0, 0.75)
    } else if (st.id === 'testrig') {
      // little "beaker"
      const b = new PIXI.Graphics()
      b.roundRect(76, 8, 12, 18, 4).fill({ color: 0x60a5fa, alpha: 0.22 })
      b.roundRect(76, 8, 12, 18, 4).stroke({ color: 0xffffff, alpha: 0.10, width: 1 })
      props.addChild(b)
    } else if (st.id === 'prkiosk') {
      addKenneyProp('computer', 6, 44, 0.18, 0.26)
      // printer tray
      const pr = new PIXI.Graphics()
      pr.roundRect(-84, 12, 26, 10, 4).fill({ color: 0x0b1020, alpha: 0.75 })
      props.addChild(pr)
    } else if (st.id === 'reviewtable') {
      addKenneyProp('tableLarge', 4, 52, 0.22, 0.22)
      // coffee cups
      const cup = new PIXI.Graphics()
      cup.roundRect(70, 12, 10, 10, 3).fill({ color: 0x111827, alpha: 0.8 })
      cup.roundRect(84, 12, 10, 10, 3).fill({ color: 0x111827, alpha: 0.7 })
      props.addChild(cup)
    }

    // monitor glow (accent)
    const glow = new PIXI.Graphics()
    glow.roundRect(-56, -22, 112, 44, 12)
      .stroke({ color: accent, alpha: 0.20, width: 4 })
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
      .fill({ color: (this.theme === 'day') ? 0xffffff : 0x101827, alpha: (this.theme === 'day') ? 0.22 : 0.95 })
      .stroke({ color: COLORS.outline, alpha: 0.18, width: 3 })
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
      .stroke({ color: COLORS.outline, alpha: 0.18, width: 3 })
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
    const outline = COLORS.outline

    // feet shadow
    const sh = new PIXI.Graphics()
    sh.ellipse(0, 18, 18, 8).fill({ color: 0x000000, alpha: 0.28 })
    c.addChild(sh)

    // Kenney character (true frame animation).
    const skinIdx = this.skins.length
      ? (Math.abs(hashNum(a.id || a.name || 'x')) % this.skins.length)
      : 0
    const skin = this.skins[skinIdx]

    let anim = null
    if (skin?.idle?.length) {
      anim = new PIXI.AnimatedSprite(skin.idle)
      anim.anchor.set(0.5, 1.0) // feet on the floor
      anim.x = 0
      anim.y = 18
      const targetH = 110
      const s = targetH / Math.max(1, anim.height)
      anim.scale.set(s)
      anim.loop = true
      anim.gotoAndStop(0)
      anim.alpha = 0.98
      c.addChild(anim)
    } else {
      // Fallback: simple paper blob if assets aren't available.
      const fallback = new PIXI.Graphics()
      fallback.roundRect(-18, -10, 36, 44, 16)
        .fill({ color: COLORS.paper, alpha: 0.98 })
        .stroke({ color: outline, alpha: 0.85, width: 3 })
      c.addChild(fallback)
    }

    const name = new PIXI.Text(a.name || a.id, labelStyle(11, '800', COLORS.ink))
    name.anchor.set(0.5, 0)
    name.y = 36
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
      bubble,
      skinIdx,
      skin,
      anim,
      animMode: 'idle', // 'idle' | 'run' | 'work'
      animBaseScale: anim ? Math.abs(anim.scale.x || 1) : 1,
      facing: 1, // -1 = left, +1 = right
      target: { x: home.x, y: home.y },
      home,
      state: 'spawning',
      lastState: 'spawning',
      bob: Math.random() * Math.PI * 2,
      walk: Math.random() * Math.PI * 2,
      shake: 0,
      vel: { x: 0, y: 0 },
      stepClock: 0, // used for footstep dust pacing
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
    // No-op: faces are baked into the Deekay sprites.
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

      // Walk cycle (based on speed) + state poses (sprite-based).
      const speed = Math.hypot(node.vel.x, node.vel.y)
      const walking = speed > 36
      node.walk += deltaSec * (walking ? Math.min(10, 3 + speed / 30) : 1.6)
      const phase = Math.sin(node.walk)
      const swing = walking ? phase : 0
      const st = String(node.state || 'idle')

      // Kenney animation modes (idle/run/work). Keeps it readable and "gamey".
      const setAnimMode = (mode) => {
        if (!node.anim || node.animMode === mode) return
        const skin = node.skin
        if (!skin) return

        if (mode === 'run' && skin.run?.length) {
          node.anim.textures = skin.run
          node.anim.loop = true
          node.anim.animationSpeed = clamp(speed / 360, 0.14, 0.34)
          node.anim.play()
        } else if (mode === 'work' && skin.work?.length) {
          node.anim.textures = skin.work
          node.anim.loop = true
          node.anim.animationSpeed = 0.18
          node.anim.play()
        } else {
          node.anim.textures = skin.idle?.length ? skin.idle : node.anim.textures
          node.anim.gotoAndStop(0)
        }
        node.animMode = mode
      }

      const wantMode = (walking && st !== 'spawning' && st !== 'blocked')
        ? 'run'
        : ((st === 'working' || st === 'collaborating') ? 'work' : 'idle')
      setAnimMode(wantMode)

      if (node.anim) {
        // facing
        if (dir) node.facing = dir
        const base = node.animBaseScale || Math.abs(node.anim.scale.x || 1) || 1
        node.anim.scale.set(base * node.facing, base)
        // blocked tint
        node.anim.tint = (st === 'blocked') ? 0xffd1d1 : 0xffffff
      }

      // Tiny squash/stretch on the whole container. This is the Deekay “bouncy” feel.
      const squish = walking ? 0.035 * Math.sin(node.walk * 2.0) : 0.018 * Math.sin(node.bob * 2.0)
      node.c.scale.x = damp(node.c.scale.x, 1 + squish * 0.6, 10.0, deltaSec)
      node.c.scale.y = damp(node.c.scale.y, 1 - squish, 10.0, deltaSec)

      // Tilt/pose by state. (Keep it subtle; sprites can look like stickers if rotated too far.)
      const dir = (Math.abs(node.vel.x) > 12) ? Math.sign(node.vel.x) : 0
      const wantRot = (st === 'blocked')
        ? 0.06 * Math.sin(node.bob * 3.2)
        : (walking ? 0.02 * swing + 0.012 * dir : 0)
      node.c.rotation = damp(node.c.rotation, wantRot, 10.0, deltaSec)
      if (st === 'blocked') node.c.y += 4

      // Extra micro-motion so the sprite doesn't feel like a sticker.
      if (node.anim) {
        const s = node.anim
        const sway = walking ? 1.2 * swing : 0.4 * Math.sin(node.bob * 1.4)
        s.x = damp(s.x, 0.7 * sway, 12.0, deltaSec)
        s.y = damp(s.y, 18 + (walking ? 0.7 * Math.abs(swing) : 0.3 * Math.sin(node.bob * 2.0)), 12.0, deltaSec)
        s.skew.x = damp(s.skew.x, (walking ? 0.03 * dir : 0), 10.0, deltaSec)
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
        // keep whatever squash/stretch is doing; just damp toward 1 slowly
        node.c.scale.x = damp(node.c.scale.x, node.c.scale.x, 1.0, deltaSec)
        node.c.scale.y = damp(node.c.scale.y, node.c.scale.y, 1.0, deltaSec)
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

      // Footstep dust (only when moving). This is a big readability win.
      if (walking && st !== 'spawning') {
        node.stepClock += deltaSec * (1.2 + Math.min(2.2, speed / 160))
        if (node.stepClock >= 1) {
          node.stepClock = 0
          const dustX = node.c.x + (dir * 6) + 8 * (Math.random() - 0.5)
          const dustY = node.c.y + 18
          const dustVx = 18 * (Math.random() - 0.5)
          const dustVy = -12 - 10 * Math.random()
          const dustCol = (this.theme === 'day') ? 0x94a3b8 : 0x64748b
          this.emitParticle(dustX, dustY, dustVx, dustVy, dustCol, 0.55, 0.45)
        }
      } else {
        node.stepClock = 0
      }
    }

    // Player movement (arrow keys): keep in-bounds, never blocks typing UI because key handling is in theatre-main.
    if (this.player) {
      const p = this.player
      p.bob += deltaSec * 2.0
      const wantX = this.playerKeys.x
      const wantY = this.playerKeys.y
      const speed = 340
      const ax = wantX * speed
      const ay = wantY * speed
      p.vel.x = damp(p.vel.x, ax, 10.0, deltaSec)
      p.vel.y = damp(p.vel.y, ay, 10.0, deltaSec)
      p.c.x += p.vel.x * deltaSec
      p.c.y += p.vel.y * deltaSec

      // Floor bounds (match slab area roughly)
      p.c.x = clamp(p.c.x, 92, 1108)
      p.c.y = clamp(p.c.y, 120, 640)

      const sp = Math.hypot(p.vel.x, p.vel.y)
      const walking = sp > 24
      p.walk += deltaSec * (walking ? Math.min(10, 3 + sp / 60) : 1.2)

      // Player anim mode
      if (p.anim && p.skin) {
        const setMode = (mode) => {
          if (!p.anim || p.animMode === mode) return
          if (mode === 'run' && p.skin.run?.length) {
            p.anim.textures = p.skin.run
            p.anim.loop = true
            p.anim.animationSpeed = clamp(sp / 360, 0.14, 0.34)
            p.anim.play()
          } else {
            p.anim.textures = p.skin.idle?.length ? p.skin.idle : p.anim.textures
            p.anim.gotoAndStop(0)
          }
          p.animMode = mode
        }

        setMode(walking ? 'run' : 'idle')
        const dir = (Math.abs(p.vel.x) > 12) ? Math.sign(p.vel.x) : 0
        if (dir) p.facing = dir
        const base = p.animBaseScale || Math.abs(p.anim.scale.x || 1) || 1
        p.anim.scale.set(base * p.facing, base)
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
