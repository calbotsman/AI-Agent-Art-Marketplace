#!/usr/bin/env bash
set -euo pipefail

# OpenClaw hardening (no secrets)
#
# Goals:
# - Reduce Telegram context blowups (history + pruning)
# - Keep the gateway stable and easy to verify
# - Avoid commands that tend to print sensitive env (ex: `launchctl print`)
#
# Safe to run repeatedly.

echo "== OpenClaw Hardening =="
echo "time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo

echo "-- config: telegram history --"
openclaw config set channels.telegram.historyLimit 4
openclaw config set channels.telegram.dmHistoryLimit 2

echo
echo "-- config: context pruning --"
# Keep only a small tail of context so DMs don't exceed model limits when long messages arrive.
openclaw config set agents.defaults.contextTokens 6000
openclaw config set agents.defaults.contextPruning.keepLastAssistants 1
openclaw config set agents.defaults.contextPruning.ttl 15m
openclaw config set agents.defaults.contextPruning.softTrim.maxChars 12000
openclaw config set agents.defaults.contextPruning.softTrim.headChars 3000
openclaw config set agents.defaults.contextPruning.softTrim.tailChars 9000

echo
echo "-- restart gateway --"
openclaw gateway restart --json >/dev/null

echo
echo "-- health --"
ok=0
for i in {1..15}; do
  if openclaw gateway health --url ws://127.0.0.1:19001 >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done

if [[ "$ok" -ne 1 ]]; then
  echo "[err] gateway health did not become OK within 15s" >&2
  openclaw gateway health --url ws://127.0.0.1:19001
  exit 1
fi

openclaw gateway health --url ws://127.0.0.1:19001

echo
echo "OK"
