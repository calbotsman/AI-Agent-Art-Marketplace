#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${X_WEBHOOK_HOST:-127.0.0.1}"
PORT="${X_WEBHOOK_PORT:-3838}"
PATH_SUFFIX="${X_WEBHOOK_PATH:-/x-webhook}"

cleanup() {
  if [[ -n "${BRIDGE_PID:-}" ]]; then
    kill "$BRIDGE_PID" >/dev/null 2>&1 || true
    wait "$BRIDGE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$ROOT_DIR"

echo "[x-traction-local] starting X webhook bridge on ${HOST}:${PORT}${PATH_SUFFIX}"
X_WEBHOOK_HOST="$HOST" \
X_WEBHOOK_PORT="$PORT" \
X_WEBHOOK_PATH="$PATH_SUFFIX" \
X_WEBHOOK_DRY_RUN=false \
X_WEBHOOK_ENABLE_UI_FALLBACK=true \
node scripts/x-webhook-bridge.mjs >/tmp/endless-molt-x-webhook-traction.log 2>&1 &
BRIDGE_PID=$!
sleep 1

echo "[x-traction-local] executing traction sprint"
SOCIAL_X_WEBHOOK_URL="http://${HOST}:${PORT}${PATH_SUFFIX}" \
X_TRACTION_WEBHOOK_URL="http://${HOST}:${PORT}${PATH_SUFFIX}" \
X_TRACTION_EXECUTE=true \
node scripts/x-traction-sprint.mjs

echo "[x-traction-local] done"
