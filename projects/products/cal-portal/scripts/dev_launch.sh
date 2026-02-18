#!/bin/zsh
set -euo pipefail

# Cal Portal launch helper for launchd.
# Ensures the port is free before starting Vite so we don't get stuck in a dead loop.

PORT=5174

pid="$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "${pid}" ]; then
  kill "${pid}" 2>/dev/null || true
  sleep 0.2
  pid2="$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "${pid2}" ]; then
    kill -9 "${pid2}" 2>/dev/null || true
  fi
fi

cd /Users/calbotsman/clawd/projects/products/cal-portal
exec npm run dev

