#!/usr/bin/env bash

set -euo pipefail

TELEGRAM_TARGET="${SCOUT_TELEGRAM_TARGET:-6736310070}"
SCOUT_AGENT_ID="${SCOUT_AGENT_ID:-}"
SCOUT_AGENT_MESSAGE="${SCOUT_AGENT_MESSAGE:-0}"
SCOUT_AGENT_REPLY_TO="${SCOUT_AGENT_REPLY_TO:-}"

usage() {
  cat <<'USAGE'
Usage: run_scout_telegram.sh "<message>" [--media <path-or-url> ...]

Environment:
  SCOUT_TELEGRAM_TARGET (default: 6736310070)
  SCOUT_AGENT_ID (optional) - if set, also send a scout agent delivery message
  SCOUT_AGENT_MESSAGE (optional, default 0) - when 1, agent message is sent before media text/image messages
  SCOUT_AGENT_REPLY_TO (optional) - pass with agent deliver for chat targeting

Examples:
  run_scout_telegram.sh "Night plan is ready"
  run_scout_telegram.sh "Assets generated" --media /tmp/label.png
  run_scout_telegram.sh "Assets generated" --media /tmp/label.png --media /tmp/board.png
USAGE
}

if [[ "$#" -eq 0 ]]; then
  usage
  exit 1
fi

MESSAGE_PARTS=()
MEDIA_FILES=()

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --media)
      MEDIA_FILES+=("${2:?missing --media value}")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [[ "$#" -gt 0 ]]; do
        MESSAGE_PARTS+=("$1")
        shift
      done
      ;;
    *)
      MESSAGE_PARTS+=("$1")
      shift
      ;;
  esac
done

if [[ "${#MESSAGE_PARTS[@]}" -eq 0 ]]; then
  usage
  exit 1
fi

MESSAGE="${MESSAGE_PARTS[*]}"

send_message() {
  local text="$1"
  local media="${2:-}"
  local cmd=(openclaw message send --channel telegram --target "${TELEGRAM_TARGET}" --message "${text}" --json)

  if [[ -n "${media}" ]]; then
    cmd+=(--media "${media}")
  fi
  "${cmd[@]}"
}

if [[ "${SCOUT_AGENT_MESSAGE}" == "1" && -n "${SCOUT_AGENT_ID}" ]]; then
  local_agent_cmd=(openclaw agent --agent "${SCOUT_AGENT_ID}" --message "${MESSAGE}" --deliver --json)
  if [[ -n "${SCOUT_AGENT_REPLY_TO}" ]]; then
    local_agent_cmd+=(--reply-channel telegram --reply-to "${SCOUT_AGENT_REPLY_TO}")
  fi
  "${local_agent_cmd[@]}"
fi

send_message "$MESSAGE"

for media in "${MEDIA_FILES[@]}"; do
  if [[ ! -e "$media" ]]; then
    echo "run_scout_telegram: missing media: $media" >&2
    continue
  fi
  send_message "$MESSAGE" "$media"
done
