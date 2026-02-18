#!/usr/bin/env bash
set -euo pipefail

echo "== Gateway =="
openclaw gateway health --url ws://127.0.0.1:19001 || true

echo
echo "== Channels =="
openclaw channels status || true

echo
echo "== Session Count =="
TMP_JSON="$(mktemp)"
openclaw sessions --json > "$TMP_JSON" 2>/dev/null || true
python3 - "$TMP_JSON" <<'PY'
import json, sys, pathlib
p = pathlib.Path(sys.argv[1])
raw = p.read_text(errors="ignore")
# openclaw may prepend banner lines; keep JSON object suffix.
start = raw.find("{")
if start < 0:
    print("sessions: unknown")
    raise SystemExit(0)
try:
    j = json.loads(raw[start:])
    print("sessions:", j.get("count"))
except Exception:
    print("sessions: unknown")
PY
rm -f "$TMP_JSON"

echo
echo "== Portal =="
if curl -sS -m 3 http://127.0.0.1:5174/ops/status >/dev/null 2>&1; then
  echo "cal-portal: up (http://127.0.0.1:5174)"
else
  echo "cal-portal: down"
fi
