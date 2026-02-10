import { spawn } from 'node:child_process'

function run(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { stdio: 'inherit', ...opts })
  p.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code
  })
  return p
}

// 1) Start theatre WS server (8787)
const ws = run('node', ['server/theatre-ws.mjs'])

// 2) Start Vite (5174)
const vite = run('node', ['node_modules/vite/bin/vite.js', '--port', '5174', '--configLoader', 'native'])

const shutdown = () => {
  try { ws.kill('SIGTERM') } catch {}
  try { vite.kill('SIGTERM') } catch {}
}

process.on('SIGINT', () => { shutdown(); process.exit(0) })
process.on('SIGTERM', () => { shutdown(); process.exit(0) })

