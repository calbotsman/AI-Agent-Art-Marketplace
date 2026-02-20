#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$(date +"%Y-%m-%d_%H%M%S")"
OUTDIR="$ROOT/reports/self-improve"
OUT="$OUTDIR/health_$TS.md"

mkdir -p "$OUTDIR"

{
  echo "# Self-improve health run"
  echo
  echo "- timestamp: $(date)"
  echo "- host: $(hostname)"
  echo "- root: $ROOT"
  echo
  echo "## 1) openclaw status"
  echo
  echo '```'
  (cd "$ROOT" && openclaw status) || true
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
  echo "## 4) failing cron snapshot"
  echo
  echo "Run: cron list (via OpenClaw tool) — this shell script can’t access it directly."
} > "$OUT"

echo "$OUT"
