#!/usr/bin/env bash

set -euo pipefail

TELEGRAM_TARGET="6736310070"
CAL_TARGET_AGENT="cal"
INTERVAL_MINUTES=30
HOURS=10
ALERT_ON_OK=0
STATE_FILE="/Users/calbotsman/clawd/.state/cal_telegram_health.state"
ONCE=0
LOG_FILE="/Users/calbotsman/clawd/logs/cal_telegram_health.log"

usage() {
  cat <<'USAGE'
Usage: watch_cal_and_telegram.sh [--hours HOURS] [--interval MINUTES] [--agent-id ID] [--always-report] [--once] [--log PATH] [--state PATH]

Example:
  ./watch_cal_and_telegram.sh --hours 10 --interval 45 --once
USAGE
}

resolve_agent_alias() {
  local agent="$1"
  if [[ "$agent" == "cal" ]]; then
    echo "main"
  else
    echo "$agent"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hours)
      HOURS="${2:?missing --hours value}"
      shift 2
      ;;
    --interval)
      INTERVAL_MINUTES="${2:?missing --interval value}"
      shift 2
      ;;
    --agent-id)
      CAL_TARGET_AGENT="${2:?missing --agent-id value}"
      shift 2
      ;;
    --always-report)
      ALERT_ON_OK=1
      shift
      ;;
    --once)
      ONCE=1
      shift
      ;;
    --log)
      LOG_FILE="${2:?missing --log value}"
      shift 2
      ;;
    --state)
      STATE_FILE="${2:?missing --state value}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      usage
      exit 1
      ;;
  esac
done

mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$STATE_FILE")"

log_line() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$ts] $*" | tee -a "$LOG_FILE"
}

send_alert() {
  local text="$1"
  openclaw message send --channel telegram --target "$TELEGRAM_TARGET" --message "$text" --json >>"$LOG_FILE" 2>&1 || true
}

check_telegram() {
  openclaw message send --channel telegram --target "$TELEGRAM_TARGET" --message "health check ping" --dry-run --json >/tmp/cal_tel_dryrun.json 2>>"$LOG_FILE" && return 0
  return 1
}

check_agent() {
  local agent="$1"
  if openclaw agent --agent "$agent" --message "health check ping" --json --timeout 20 >/tmp/cal_tel_agent_${agent}.json 2>>"$LOG_FILE"; then
    return 0
  fi
  return 1
}

run_once() {
  local cal_ok=0
  local telegram_ok=0
  local overall="OK"
  local cal_status="missing"
  local tg_status="down"
  local cal_id_label="$CAL_TARGET_AGENT"
  local cal_probe_id

  cal_probe_id="$(resolve_agent_alias "$CAL_TARGET_AGENT")"
  if [[ "$cal_probe_id" != "$CAL_TARGET_AGENT" ]]; then
    cal_id_label="${CAL_TARGET_AGENT}->${cal_probe_id}"
  fi

  if check_telegram; then
    telegram_ok=1
    tg_status="ok"
  else
    overall="FAIL"
  fi

  if check_agent "$cal_probe_id"; then
    cal_ok=1
    cal_status="ok"
  else
    overall="FAIL"
  fi

  local status="cal=${cal_status}(${cal_id_label}) | telegram=${tg_status}"
  local message="Cal Telegram health check: ${overall} | ${status}"

  local last=""
  if [[ -f "$STATE_FILE" ]]; then
    last="$(cat "$STATE_FILE")"
  fi

  if [[ "$overall" != "OK" || "$ALERT_ON_OK" == "1" ]]; then
    log_line "$message"
    if [[ "$overall" == "OK" ]]; then
      if [[ "$ALERT_ON_OK" == "1" && "$last" != "OK" ]]; then
        send_alert "$message"
      fi
    elif [[ "$overall" != "$last" ]]; then
      send_alert "$message"
    fi
  else
    log_line "Cal Telegram health check: OK | ${status}"
  fi

  echo "$overall" > "$STATE_FILE"
}

if [[ "$ONCE" == "1" ]]; then
  run_once
  exit 0
fi

END_TIME=$(( $(date +%s) + HOURS * 3600 ))
while (( $(date +%s) < END_TIME )); do
  run_once
  sleep "${INTERVAL_MINUTES}m"
done
