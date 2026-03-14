#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$(date +"%Y-%m-%d_%H%M%S")"
OUTDIR="$ROOT/reports/self-improve"
OUT="$OUTDIR/health_$TS.md"
LOCK_FILE="$ROOT/loops/.self_improve.lock"
LOCK_TIMEOUT_SECONDS=7200  # 2 hours

mkdir -p "$OUTDIR"

# Lock file collision prevention
if [[ -f "$LOCK_FILE" ]]; then
  LOCK_AGE=$(($(date +%s) - $(stat -f %m "$LOCK_FILE" 2>/dev/null || stat -c %Y "$LOCK_FILE" 2>/dev/null || echo "0")))
  if [[ $LOCK_AGE -lt $LOCK_TIMEOUT_SECONDS ]]; then
    echo "# Self-improve health run (skipped)" > "$OUT"
    echo >> "$OUT"
    echo "- timestamp: $(date)" >> "$OUT"
    echo "- host: $(hostname)" >> "$OUT"
    echo "- root: $ROOT" >> "$OUT"
    echo >> "$OUT"
    echo "Lock file exists and is fresh (${LOCK_AGE}s old). Skipping run to avoid collision." >> "$OUT"
    echo "$OUT"
    exit 0
  else
    echo "Lock file is stale (${LOCK_AGE}s old). Removing and proceeding." >&2
    rm -f "$LOCK_FILE"
  fi
fi

# Create lock file
touch "$LOCK_FILE"

# Remove lock file on exit (success or failure)
trap "rm -f '$LOCK_FILE'" EXIT

{
  echo "# Self-improve health run"
  echo
  echo "- timestamp: $(date)"
  echo "- host: $(hostname)"
  echo "- root: $ROOT"
  echo
  echo "## 1a) Docker availability"
  echo
  echo '```'
  if command -v docker &> /dev/null
  then
      echo "Docker command found. Status:"
      docker --version
  else
      echo "Docker command not found on PATH."
  fi
  echo '```'
  echo
  echo "## 1) openclaw status"
  echo
  echo '```'
  (cd "$ROOT" && openclaw status) || true
  echo '```'
  echo
  echo "## 1b) memory status"
  echo
  echo '```'
  (cd "$ROOT" && openclaw memory status) || true
  echo '```'
  echo
  echo "## 2) gateway + guardian logs (tail)"
  echo
  for f in "$HOME/.openclaw/logs/gateway.err.log" "$HOME/.openclaw/logs/openclaw-guardian.log"; do
    echo "### $f"
    echo
    if [[ -f "$f" ]]; then
      echo '```'
      tail -n 200 "$f" || true
      echo '```'
    else
      echo "(missing)"
    fi
    echo
  done
  echo "## 3) repo status"
  echo
  echo '```'
  (cd "$ROOT" && git status -sb) || true
  echo '```'
  echo
  echo "## 4) cron snapshot (errors + delivery sanity)"
  echo
  echo "### openclaw cron list"
  echo
  echo '```'
  (cd "$ROOT" && openclaw cron list) || true
  echo '```'
  echo
  echo "### announce jobs missing delivery.to (or set to heartbeat)"
  echo
  (cd "$ROOT" && openclaw cron list --json > /tmp/openclaw-cron-list.json) || true
  python3 - <<'PY'
import json, os, sys
p = "/tmp/openclaw-cron-list.json"
if not os.path.exists(p):
  print("(cron list json unavailable)")
  sys.exit(0)

with open(p) as f:
  data = json.load(f)

jobs = data.get("jobs") if isinstance(data, dict) else data
problems = []
for j in jobs or []:
  delivery = j.get("delivery") or {}
  if isinstance(delivery, dict) and delivery.get("mode") == "announce":
    to = delivery.get("to")
    if not to or str(to).lower() == "heartbeat":
      state = j.get("state") or {}
      last = state.get("lastDeliveryError") or state.get("lastError")
      problems.append((j.get("id"), j.get("name"), to, last))

if not problems:
  print("(none)")
else:
  for job_id, name, to, last in problems:
    print(f"- {job_id} | {name} | to={to!r} | last={last}")
PY
} > "$OUT"

echo "$OUT"
