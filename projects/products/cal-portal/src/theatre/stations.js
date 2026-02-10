export const STATIONS = [
  { id: 'whiteboard', label: 'Plan Desk', kind: 'plan', x: 140, y: 120 },
  { id: 'devdesk', label: 'Build Desk', kind: 'implement', x: 520, y: 150 },
  { id: 'verifybench', label: 'QA Bench', kind: 'verify', x: 860, y: 140 },
  { id: 'testrig', label: 'Test Rig', kind: 'test', x: 260, y: 420 },
  { id: 'prkiosk', label: 'PR Kiosk', kind: 'pr', x: 640, y: 430 },
  { id: 'reviewtable', label: 'Review Table', kind: 'review', x: 900, y: 420 },
]

export const LOUNGE = { id: 'lounge', label: 'Lounge', x: 140, y: 520 }
export const PORTAL = { id: 'portal', label: 'Portal', x: 520, y: 520 }

export function stationForStepKind(kind) {
  const k = String(kind || '').toLowerCase()
  if (!k) return null
  if (k.includes('plan')) return 'whiteboard'
  if (k.includes('impl') || k.includes('build') || k.includes('dev')) return 'devdesk'
  if (k.includes('verify') || k.includes('qa')) return 'verifybench'
  if (k.includes('test')) return 'testrig'
  if (k.includes('pr')) return 'prkiosk'
  if (k.includes('review')) return 'reviewtable'
  if (k.includes('deploy')) return 'prkiosk'
  return 'devdesk'
}
