#!/usr/bin/env bash
set -euo pipefail

# Installs a local watchdog that keeps the OpenClaw gateway + Telegram responsive.
# - No secrets printed
# - Backoff + failure streak before restarting

STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
BIN_DIR="$STATE_DIR/bin"
LOG_DIR="$STATE_DIR/logs"
PLIST="$HOME/Library/LaunchAgents/com.tcr.openclaw.guardian.plist"

mkdir -p "$BIN_DIR" "$LOG_DIR"

cat > "$BIN_DIR/openclaw-guardian.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_BIN="${OPENCLAW_BIN:-openclaw}"
GATEWAY_URL="${OPENCLAW_GATEWAY_URL:-ws://127.0.0.1:19001}"
PORT="${OPENCLAW_GATEWAY_PORT:-19001}"
CHECK_EVERY_SEC="${GUARDIAN_INTERVAL_SEC:-10}"
HEALTH_TIMEOUT_SEC="${GUARDIAN_HEALTH_TIMEOUT_SEC:-4}"
FAIL_STREAK="${GUARDIAN_FAIL_STREAK:-3}"
MIN_RESTART_GAP_SEC="${GUARDIAN_MIN_RESTART_GAP_SEC:-60}"

STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
LOG_FILE="$STATE_DIR/logs/openclaw-guardian.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  # Avoid secrets; log only high-level events.
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

health_ok() {
  # gateway health includes Telegram probe; that's what we want.
  timeout "$HEALTH_TIMEOUT_SEC" "$OPENCLAW_BIN" gateway health --url "$GATEWAY_URL" >/dev/null 2>&1
}

restart_gateway() {
  # Prefer graceful restart; ignore any transient CLI errors.
  "$OPENCLAW_BIN" gateway restart >/dev/null 2>&1 || true
  sleep 1
}

hard_restart_gateway() {
  # Kill listener on the gateway port if present, then try kickstart.
  local pid
  pid="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pid:-}" ]]; then
    kill "$pid" >/dev/null 2>&1 || true
    sleep 0.5
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi

  # Try launchd service if present; otherwise run a forced gateway instance.
  launchctl kickstart -k "gui/$UID/ai.openclaw.gateway" >/dev/null 2>&1 || true
  sleep 1
  if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    nohup "$OPENCLAW_BIN" gateway run --bind loopback --port "$PORT" --force >/tmp/openclaw-gateway-run.log 2>&1 &
    sleep 1
  fi
}

fail_streak=0
last_restart_ts=0

log "guardian started url=$GATEWAY_URL interval=${CHECK_EVERY_SEC}s"

while true; do
  if health_ok; then
    fail_streak=0
    sleep "$CHECK_EVERY_SEC"
    continue
  fi

  fail_streak=$((fail_streak+1))
  log "health FAIL streak=${fail_streak}/${FAIL_STREAK}"

  if (( fail_streak < FAIL_STREAK )); then
    sleep "$CHECK_EVERY_SEC"
    continue
  fi

  now="$(date +%s)"
  if (( now - last_restart_ts < MIN_RESTART_GAP_SEC )); then
    log "restart suppressed (cooldown)"
    sleep "$CHECK_EVERY_SEC"
    continue
  fi
  last_restart_ts="$now"

  log "attempting restart"
  restart_gateway
  if health_ok; then
    log "restart OK"
    fail_streak=0
    sleep "$CHECK_EVERY_SEC"
    continue
  fi

  log "restart still failing; attempting hard restart"
  hard_restart_gateway
  if health_ok; then
    log "hard restart OK"
    fail_streak=0
  else
    log "hard restart FAIL (will keep trying with cooldown)"
  fi

  sleep "$CHECK_EVERY_SEC"
done
SH

chmod +x "$BIN_DIR/openclaw-guardian.sh"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.tcr.openclaw.guardian</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>${STATE_DIR}/bin/openclaw-guardian.sh</string>
    </array>

    <key>StandardOutPath</key>
    <string>${STATE_DIR}/logs/openclaw-guardian.launchd.out</string>
    <key>StandardErrorPath</key>
    <string>${STATE_DIR}/logs/openclaw-guardian.launchd.err</string>

    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
      <key>OPENCLAW_GATEWAY_URL</key>
      <string>ws://127.0.0.1:19001</string>
      <key>GUARDIAN_INTERVAL_SEC</key>
      <string>10</string>
      <key>GUARDIAN_FAIL_STREAK</key>
      <string>3</string>
      <key>GUARDIAN_MIN_RESTART_GAP_SEC</key>
      <string>60</string>
    </dict>
  </dict>
</plist>
PLIST

echo "Installed:"
echo "  $BIN_DIR/openclaw-guardian.sh"
echo "  $PLIST"

echo "Starting via launchd..."
launchctl bootout "gui/$UID" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID" "$PLIST"
launchctl enable "gui/$UID/com.tcr.openclaw.guardian" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/$UID/com.tcr.openclaw.guardian" >/dev/null 2>&1 || true

echo "OK: guardian running (check logs in $LOG_DIR)."

