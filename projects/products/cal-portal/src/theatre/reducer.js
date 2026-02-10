import { nowMs, safeStr, clamp } from './schema.js'

/*
Pure reducer: (snapshot + event history) -> derived state.
No timers, no randomness. Visual layer reads this and animates accordingly.
*/

export function initialTheatreState() {
  return {
    now: nowMs(),
    selectedAgentId: null,
    agents: {}, // agentId -> {id,name,role,state,detail,runId,stepId,lastStepKind,createdAt,updatedAt,blockedReason,home:{x,y}}
    runs: {}, // runId -> {id, workflowId, task, status}
    steps: {}, // stepId -> {id, runId, kind, status, agentId, progress:{done,total,message}, error}
    lastEventsByAgent: {}, // agentId -> [event,...] (tail)
    lastEventAt: 0,
  }
}

function pushAgentEvent(s, agentId, ev, max = 10) {
  if (!agentId) return
  const list = s.lastEventsByAgent[agentId] || []
  list.push(ev)
  while (list.length > max) list.shift()
  s.lastEventsByAgent[agentId] = list
}

function ensureAgent(s, agentId) {
  const id = safeStr(agentId)
  if (!id) return null
  if (s.agents[id]) return s.agents[id]
  const a = {
    id,
    name: id,
    role: '',
    state: 'idle',
    detail: '',
    runId: null,
    stepId: null,
    lastStepKind: '',
    createdAt: nowMs(),
    updatedAt: nowMs(),
    blockedReason: '',
    home: { x: 0, y: 0 },
  }
  s.agents[id] = a
  return a
}

function ensureRun(s, runId) {
  const id = safeStr(runId)
  if (!id) return null
  if (s.runs[id]) return s.runs[id]
  const r = { id, workflowId: '', task: '', status: 'pending' }
  s.runs[id] = r
  return r
}

function ensureStep(s, runId, stepId) {
  const id = safeStr(stepId)
  if (!id) return null
  if (s.steps[id]) return s.steps[id]
  const st = {
    id,
    runId: safeStr(runId) || null,
    kind: '',
    status: 'queued',
    agentId: null,
    progress: { done: null, total: null, message: '' },
    error: '',
  }
  s.steps[id] = st
  return st
}

export function reduceEvent(prev, ev) {
  const s = structuredClone(prev)
  s.now = nowMs()

  const type = safeStr(ev?.type)
  const payload = ev?.payload || {}
  const t = s.now
  s.lastEventAt = t

  if (!type) return s

  switch (type) {
    case 'agent.created': {
      const agentId = safeStr(payload.agentId)
      const a = ensureAgent(s, agentId)
      if (!a) break
      a.name = safeStr(payload.name) || a.name
      a.role = safeStr(payload.role) || a.role
      a.state = 'spawning'
      a.detail = 'spawn'
      a.updatedAt = t
      pushAgentEvent(s, agentId, { type, payload, ts: t })
      break
    }
    case 'agent.state_changed': {
      const agentId = safeStr(payload.agentId)
      const a = ensureAgent(s, agentId)
      if (!a) break
      a.state = safeStr(payload.state) || a.state
      a.detail = safeStr(payload.detail)
      a.runId = safeStr(payload.runId) || null
      a.stepId = safeStr(payload.stepId) || null
      if (a.state === 'blocked') a.blockedReason = a.detail || a.blockedReason
      a.updatedAt = t
      pushAgentEvent(s, agentId, { type, payload, ts: t })
      break
    }
    case 'run.created': {
      const r = ensureRun(s, payload.runId)
      if (!r) break
      r.workflowId = safeStr(payload.workflowId)
      r.task = safeStr(payload.task)
      r.status = r.status || 'pending'
      break
    }
    case 'run.status_changed': {
      const r = ensureRun(s, payload.runId)
      if (!r) break
      r.status = safeStr(payload.status) || r.status
      break
    }
    case 'step.queued': {
      const st = ensureStep(s, payload.runId, payload.stepId)
      if (!st) break
      st.kind = safeStr(payload.stepKind) || st.kind
      st.runId = safeStr(payload.runId) || st.runId
      st.status = 'queued'
      break
    }
    case 'step.claimed': {
      const st = ensureStep(s, payload.runId, payload.stepId)
      if (!st) break
      st.runId = safeStr(payload.runId) || st.runId
      st.status = 'claimed'
      st.agentId = safeStr(payload.agentId) || st.agentId
      const a = ensureAgent(s, st.agentId)
      if (a) {
        a.lastStepKind = safeStr(st.kind) || a.lastStepKind
        a.runId = st.runId
        a.stepId = st.id
        a.updatedAt = t
        if (a.state === 'idle') a.state = 'working'
        pushAgentEvent(s, a.id, { type, payload, ts: t })
      }
      break
    }
    case 'step.progress': {
      const st = ensureStep(s, payload.runId, payload.stepId)
      if (!st) break
      st.progress = {
        done: (payload.done == null) ? null : Number(payload.done),
        total: (payload.total == null) ? null : Number(payload.total),
        message: safeStr(payload.message),
      }
      if (st.progress.done != null && st.progress.total != null) {
        st.progress.done = clamp(st.progress.done, 0, st.progress.total)
      }
      break
    }
    case 'step.finished': {
      const st = ensureStep(s, payload.runId, payload.stepId)
      if (!st) break
      const status = safeStr(payload.status)
      st.status = (status === 'succeeded') ? 'succeeded' : ((status === 'failed') ? 'failed' : st.status)
      st.error = safeStr(payload.error)
      if (st.status === 'failed' && st.agentId) {
        const a = ensureAgent(s, st.agentId)
        if (a) {
          a.state = 'blocked'
          a.detail = st.error || 'failed'
          a.blockedReason = a.detail
          a.updatedAt = t
          pushAgentEvent(s, a.id, { type, payload, ts: t })
        }
      }
      break
    }
    default:
      break
  }

  return s
}

