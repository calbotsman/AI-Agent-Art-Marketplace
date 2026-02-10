# Cal Studio (Agent Theatre)

A local, no-cloud visualizer for OpenClaw.

It renders a single-room "agent theatre" (PixiJS) where each agent is a character moving between stations based on a normalized event stream.

## What You Get

- 2D office scene (stations + lounge + spawn portal)
- Agents as characters (spawn, idle, think, work, collaborate, blocked)
- WebSocket transport for live events
- A mock event sequence so the theatre works without OpenClaw wiring

## Run

```bash
cd /Users/calbotsman/clawd/projects/products/cal-portal
npm install
npm run dev
```

Then open:

- UI: `http://127.0.0.1:5174/`
- Theatre WS: `ws://127.0.0.1:8787`

Notes:

- `npm run dev` starts both the WebSocket server and Vite.
- The theatre persists inbound events to: `~/.openclaw/workspace/theatre/events.jsonl`

## Event Schema (Normalized)

All incoming events are normalized to:

```json
{ "type": "agent.created", "payload": { "agentId": "...", "name": "...", "role": "..." } }
```

Supported types (minimum set):

- `agent.created` `{ agentId, name, role, parentAgentId? }`
- `agent.state_changed` `{ agentId, state: idle|thinking|working|collaborating|spawning|blocked, detail?, runId?, stepId? }`
- `step.queued` `{ runId, stepId, stepKind, agentRole? }`
- `step.claimed` `{ runId, stepId, agentId }`
- `step.progress` `{ runId, stepId, done?, total?, message? }`
- `step.finished` `{ runId, stepId, status: succeeded|failed, error? }`

The server also emits `snapshot` on connect.

## WebSocket Protocol

Client to server:

- `{ "type": "mock.start", "payload": { "speedMs": 550 } }`
  - Streams the scripted demo events from `public/events.example.jsonl`

- `{ "type": "event", "payload": { "type": "step.claimed", "payload": { ... } } }`
  - Broadcasts to all clients and appends to `~/.openclaw/workspace/theatre/events.jsonl`

Server to client:

- `{ "type": "snapshot", "payload": { ... } }`
- `{ "type": "event", "payload": { "type": "...", "payload": { ... } } }`

## Mock Demo

`public/events.example.jsonl` demonstrates:

spawn -> plan -> implement (progress) -> verify -> failure -> retry -> success -> PR -> review

## Where To Plug In Real OpenClaw Events

The theatre is built so the reducer is pure and deterministic. To go live you only need an adapter that emits the normalized events above.

Implementation points:

- WS server: `server/theatre-ws.mjs`
- Reducer: `src/theatre/reducer.js`
- Scene: `src/theatre/scene.js`

## Dev Scripts

- `npm run dev`: WS + Vite
- `npm run dev:web`: Vite only (5174)
- `npm run dev:ws`: WS only (8787)
- `npm run lint:quick`: validates `public/events.example.jsonl`
