import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || path.join(process.cwd(), 'public', 'events.example.jsonl')
const txt = fs.readFileSync(file, 'utf8')
const lines = txt.split('\n').filter(Boolean)

let ok = true
for (let i = 0; i < lines.length; i++) {
  try {
    const ev = JSON.parse(lines[i])
    if (!ev?.type || typeof ev.type !== 'string') throw new Error('missing type')
    if (!('payload' in ev)) throw new Error('missing payload')
  } catch (e) {
    ok = false
    console.error(`[invalid] line ${i + 1}: ${String(e?.message || e)}`)
  }
}

if (!ok) process.exit(1)
console.log(`[ok] ${lines.length} events in ${file}`)

