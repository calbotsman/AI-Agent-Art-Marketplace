export const AgentStates = /** @type {const} */ ([
  'idle',
  'thinking',
  'working',
  'collaborating',
  'spawning',
  'blocked',
])

export const StepStatuses = /** @type {const} */ ([
  'queued',
  'claimed',
  'succeeded',
  'failed',
])

export function nowMs() {
  return Date.now()
}

export function safeStr(x) {
  return (typeof x === 'string' && x.trim()) ? x.trim() : ''
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

