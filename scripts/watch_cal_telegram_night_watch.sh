#!/usr/bin/env bash

set -uo pipefail

INTERVAL_MINUTES=30
HOURS=10
START_TS="$(date +%s)"
END_TS=$(( START_TS + HOURS * 3600 ))
SLEEP_SECONDS=$(( INTERVAL_MINUTES * 60 ))

while :; do
  NOW=$(date +%s)
  if (( NOW >= END_TS )); then
    break
  fi

  /Users/calbotsman/clawd/scripts/watch_cal_and_telegram.sh --once --interval 1 --log /Users/calbotsman/clawd/logs/cal_telegram_health.log --state /Users/calbotsman/clawd/.state/cal_telegram_health.state || true

  NOW=$(date +%s)
  if (( NOW >= END_TS )); then
    break
  fi
  sleep "$SLEEP_SECONDS"
done
