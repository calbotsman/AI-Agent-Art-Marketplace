#!/usr/bin/env bash
set -euo pipefail

echo "== OpenClaw Health =="
echo "time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo

echo "-- gateway --"
openclaw gateway health --url ws://127.0.0.1:19001
echo

echo "-- channels --"
openclaw channels status
echo

echo "-- providers --"
# Do not print tokens; list only provider names/state.
set +e
providers_output="$(openclaw channels list 2>&1)"
providers_rc=$?
set -e
echo "$providers_output" | sed -E 's/\(token\)/\(configured\)/g'
if [[ $providers_rc -ne 0 ]]; then
  echo
  echo "[warn] Provider listing returned non-zero (rc=${providers_rc}); gateway/channel health above is authoritative."
fi
