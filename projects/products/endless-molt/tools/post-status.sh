#!/usr/bin/env bash
set -euo pipefail

# Post status with fallback:
# 1) Moltbook post
# 2) Queue locally (always)
# 3) Optional Telegram notify if TELEGRAM_FALLBACK_TARGET is set
#
# Usage:
#   ./tools/post-status.sh "Title" "Content" [submolt]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TITLE="${1:-}"
CONTENT="${2:-}"
SUBMOLT="${3:-general}"

if [[ -z "$TITLE" || -z "$CONTENT" ]]; then
  echo "Usage: $0 \"Title\" \"Content\" [submolt]" >&2
  exit 2
fi

QUEUE_FILE="${ROOT_DIR}/cache/post-fallback-queue.jsonl"
mkdir -p "$(dirname "$QUEUE_FILE")"

queue_item() {
  local reason="$1"
  python3 - "$TITLE" "$CONTENT" "$SUBMOLT" "$reason" <<'PY' >> "$QUEUE_FILE"
import json,sys,time
title,content,submolt,reason=sys.argv[1:]
print(json.dumps({
  "queued_at": int(time.time()),
  "title": title,
  "content": content,
  "submolt": submolt,
  "reason": reason
}))
PY
  echo "QUEUED: $QUEUE_FILE (reason=${reason})"
}

if output="$(./tools/post-to-moltbook-www.sh "$TITLE" "$CONTENT" "$SUBMOLT" 2>&1)"; then
  echo "$output"
  exit 0
fi

if echo "$output" | grep -q "RATE_LIMIT"; then
  queue_item "moltbook_rate_limited"
else
  queue_item "moltbook_failed"
fi

if [[ -n "${TELEGRAM_FALLBACK_TARGET:-}" ]]; then
  # Telegram notification only; content remains queued locally for controlled repost.
  openclaw message send \
    --channel telegram \
    --target "$TELEGRAM_FALLBACK_TARGET" \
    --message "Post queued: ${TITLE}" >/dev/null 2>&1 || true
fi

echo "MOLTBOOK_ERROR:"
echo "$output"
exit 1

