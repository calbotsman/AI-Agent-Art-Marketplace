import { reduceEvent, initialTheatreState } from './reducer.js'

export function createWsClient(opts) {
  const url = opts?.url || 'ws://127.0.0.1:8787'
  const onState = opts?.onState
  const onConn = opts?.onConn

  let ws = null
  let state = initialTheatreState()
  let reconnectTimer = null
  let closed = false

  const setConn = (c) => onConn?.(c)

  const connect = () => {
    if (closed) return
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return

    setConn({ status: 'connecting', url })
    ws = new WebSocket(url)

    ws.onopen = () => setConn({ status: 'open', url })
    ws.onclose = () => {
      setConn({ status: 'closed', url })
      if (closed) return
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(connect, 800)
    }
    ws.onerror = () => setConn({ status: 'error', url })

    ws.onmessage = (msg) => {
      let m = null
      try { m = JSON.parse(msg.data) } catch { return }

      if (m?.type === 'snapshot') {
        // Snapshot is intentionally minimal for MVP.
        onState?.(state)
        return
      }

      if (m?.type === 'event' && m?.payload?.type) {
        state = reduceEvent(state, m.payload)
        onState?.(state)
      }
    }
  }

  const startMock = (speedMs = 520) => {
    try {
      ws?.send(JSON.stringify({ type: 'mock.start', payload: { speedMs } }))
    } catch {}
  }

  const stop = () => {
    closed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    try { ws?.close() } catch {}
    ws = null
  }

  return { connect, stop, startMock, getState: () => state }
}

