#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/calbotsman/clawd"
DURATION_HOURS="${AUTONOMOUS_DURATION_HOURS:-8}"
INTERVAL_MINUTES="${AUTONOMOUS_INTERVAL_MINUTES:-45}"
LOG_PATH="${AUTONOMOUS_CYCLER_LOG:-${ROOT}/logs/creative-loop-nightly.log}"
START_TS="$(date +%s)"
END_TS=$(( START_TS + DURATION_HOURS * 3600 ))
SLEEP_SECONDS=$(( INTERVAL_MINUTES * 60 ))

mkdir -p "$(dirname "$LOG_PATH")"

run_cycle() {
  local ts
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "[$ts] cycle start" | tee -a "$LOG_PATH"
  if /Users/calbotsman/clawd/scripts/run_autonomous_creative_learning_cycle.sh 2>&1 | tee -a "$LOG_PATH"; then
    echo "[$ts] cycle complete" | tee -a "$LOG_PATH"
  else
    echo "[$ts] cycle failed" | tee -a "$LOG_PATH"
  fi
}

while :; do
  if (( $(date +%s) >= END_TS )); then
    echo "[nightly] completed duration at $(date -u '+%Y-%m-%dT%H:%M:%SZ')" | tee -a "$LOG_PATH"
    break
  fi

  run_cycle

  if (( $(date +%s) >= END_TS )); then
    break
  fi
  sleep "$SLEEP_SECONDS"
done
