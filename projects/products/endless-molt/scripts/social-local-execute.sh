#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${X_WEBHOOK_HOST:-127.0.0.1}"
PORT="${X_WEBHOOK_PORT:-3838}"
PATH_SUFFIX="${X_WEBHOOK_PATH:-/x-webhook}"
DRY_RUN="${X_WEBHOOK_DRY_RUN:-true}"

cleanup() {
  if [[ -n "${BRIDGE_PID:-}" ]]; then
    kill "$BRIDGE_PID" >/dev/null 2>&1 || true
    wait "$BRIDGE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$ROOT_DIR"

echo "[social-local-execute] starting X webhook bridge on ${HOST}:${PORT}${PATH_SUFFIX} (dry_run=${DRY_RUN})"
X_WEBHOOK_HOST="$HOST" \
X_WEBHOOK_PORT="$PORT" \
X_WEBHOOK_PATH="$PATH_SUFFIX" \
X_WEBHOOK_DRY_RUN="$DRY_RUN" \
node scripts/x-webhook-bridge.mjs >/tmp/endless-molt-x-webhook.log 2>&1 &
BRIDGE_PID=$!
sleep 1

echo "[social-local-execute] executing social loop"
SOCIAL_AUTONOMOUS_EXECUTE=true \
SOCIAL_X_WEBHOOK_URL="http://${HOST}:${PORT}${PATH_SUFFIX}" \
node scripts/social-autonomous.mjs

echo "[social-local-execute] done"
