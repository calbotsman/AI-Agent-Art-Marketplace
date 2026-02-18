#!/usr/bin/env bash
set -euo pipefail

CFG="$HOME/.openclaw/openclaw.json"
SESS="$HOME/.openclaw/agents/main/sessions/sessions.json"
IDENTITY="$HOME/.openclaw/agents/main/agent/IDENTITY.md"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [[ ! -f "$CFG" ]]; then
  echo "Missing config: $CFG"
  exit 1
fi

cp "$CFG" "$CFG.bak-$STAMP"
python3 - <<'PY'
import json, pathlib
cfg = pathlib.Path.home()/".openclaw"/"openclaw.json"
d = json.loads(cfg.read_text())

def ensure(obj,key,default):
    if key not in obj or obj[key] is None:
        obj[key]=default
    return obj[key]

agents=ensure(d,"agents",{})
defs=ensure(agents,"defaults",{})
defs["contextTokens"] = 60000

pr=ensure(defs,"contextPruning",{})
pr["mode"]="cache-ttl"
pr["ttl"]="90s"
pr["keepLastAssistants"] = 0
soft=ensure(pr,"softTrim",{})
soft["maxChars"] = 4500
soft["headChars"] = 1000
soft["tailChars"] = 2800

comp=ensure(defs,"compaction",{})
comp["mode"] = "safeguard"

models=ensure(defs,"models",{})
for name,max_t in {
  "anthropic/claude-sonnet-4-20250514":1024,
  "anthropic/claude-sonnet-4":1024,
  "anthropic/claude-opus-4-20250514":1536,
  "anthropic/claude-opus-4":1536,
  "anthropic/claude-3-5-haiku-latest":1024,
  "google/gemini-flash-latest":768,
  "openai/gpt-4o-mini":768,
  "openai/gpt-4o":768,
  "openrouter/deepseek/deepseek-chat":768,
}.items():
    e=ensure(models,name,{})
    p=ensure(e,"params",{})
    p["max_tokens"] = max_t

model=ensure(defs,"model",{})
fallbacks=model.get("fallbacks") or []
ordered=[
    "google/gemini-flash-latest",
    "anthropic/claude-opus-4",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openrouter/deepseek/deepseek-chat",
]
out=[]
for m in ordered + fallbacks:
    if m not in out:
        out.append(m)
model["fallbacks"] = out[:5]

cfg.write_text(json.dumps(d,indent=2)+"\n")
print("Patched config budgets/fallbacks")
PY

if [[ -f "$IDENTITY" ]]; then
  if ! rg -q "Truth contract:" "$IDENTITY"; then
    cat >> "$IDENTITY" <<'EOF'

## Truth Contract
- Never claim completion without direct evidence from this run.
- If not verified, say "I can't verify yet" and give one concrete next check.
- Label status as: planned, running, blocked, or done.
EOF
  fi
fi

if [[ -f "$SESS" ]]; then
  cp "$SESS" "$SESS.bak-$STAMP"
  echo '{}' > "$SESS"
  echo "Reset session store to apply new context caps"
fi

openclaw gateway restart >/tmp/openclaw-gateway-restart.log 2>&1 || true
sleep 1
openclaw gateway health --url ws://127.0.0.1:19001 >/tmp/openclaw-gateway-health.log 2>&1 || true

echo "Done. Backup: $CFG.bak-$STAMP"
