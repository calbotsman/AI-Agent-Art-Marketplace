#!/usr/bin/env bash
set -euo pipefail

WS="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
today="$(date +%F)"
yesterday="$(date -v-1d +%F 2>/dev/null || date -d 'yesterday' +%F)"

echo "== OpenClaw Context Check =="
echo "workspace: $WS"
echo

required=(
  "$WS/SOUL.md"
  "$WS/USER.md"
  "$WS/MEMORY.md"
  "$WS/memory/$today.md"
)

optional=(
  "$WS/memory/$yesterday.md"
  "$WS/AGENTS.md"
  "$WS/TOOLS.md"
)

missing=0
for f in "${required[@]}"; do
  if [[ -f "$f" ]]; then
    echo "[ok]  $f"
  else
    echo "[bad] $f (missing)"
    missing=1
  fi
done

for f in "${optional[@]}"; do
  if [[ -f "$f" ]]; then
    echo "[ok]  $f"
  else
    echo "[warn] $f (missing)"
  fi
done

echo
if [[ "$missing" -eq 0 ]]; then
  echo "Context status: READY"
  exit 0
fi

echo "Context status: INCOMPLETE"
exit 1

