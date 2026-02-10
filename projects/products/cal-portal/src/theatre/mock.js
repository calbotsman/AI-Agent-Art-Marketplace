import { reduceEvent, initialTheatreState } from './reducer.js'

export async function loadExampleEvents() {
  const res = await fetch('/events.example.jsonl', { cache: 'no-store' })
  if (!res.ok) throw new Error(`failed to load events.example.jsonl (${res.status})`)
  const txt = await res.text()
  const lines = txt.split('\n').filter(Boolean)
  return lines.map((ln) => JSON.parse(ln))
}

export function createMockRunner(opts) {
  const speedMs = Math.max(60, Number(opts?.speedMs || 520))
  const onState = opts?.onState
  const onEvent = opts?.onEvent

  let events = []
  let i = 0
  let timer = null
  let state = initialTheatreState()

  const step = () => {
    if (i >= events.length) return stop()
    const ev = events[i++]
    onEvent?.(ev)
    state = reduceEvent(state, ev)
    onState?.(state)
  }

  const start = async () => {
    if (!events.length) events = await loadExampleEvents()
    stop()
    i = 0
    state = initialTheatreState()
    timer = setInterval(step, speedMs)
    step()
  }

  const stop = () => {
    if (timer) clearInterval(timer)
    timer = null
  }

  const reset = () => {
    stop()
    i = 0
    state = initialTheatreState()
    onState?.(state)
  }

  return { start, stop, reset, getState: () => state }
}

