#!/usr/bin/env bash
set -euo pipefail

MODE="${SYNC_MODE:-focused}" # focused | legacy
INCLUDE_DAILIES="${SYNC_INCLUDE_DAILIES:-0}" # 1 to include YYYY-MM-DD daily notes

STUDIO_ROOT="/Users/calbotsman/Library/Mobile Documents/iCloud~md~obsidian/Documents/taste/TCR-Studio/Studio"
SYNC_ROOT="${STUDIO_ROOT}/Sync"
mkdir -p "$SYNC_ROOT"

common_excludes=(
  --exclude=".DS_Store"
  --exclude=".git/***"
  --exclude="node_modules/***"
  --exclude="dist/***"
  --exclude="tmp-skill-installs/***"
)

focused_clawd_excludes=(
  --exclude=".clawvault/***"
  --exclude=".venv-kohya/***"
  --exclude="ledger/***"
  --exclude="backlog/***"
  --exclude="output/***"
  --exclude="outputs/***"
  --exclude="models/***"
  --exclude="tools/kohya_ss/***"
  --exclude="agents/zara/LEGACY_DIRECTOR_SNAPSHOT/***"
)

focused_openclaw_excludes=(
  --exclude="agents/**/sessions/***"
  --exclude="agents/**/sessions.json"
  --exclude="logs/***"
  --exclude="cron/runs/***"
  --exclude="browser/***"
  --exclude="credentials/***"
  --exclude="media/***"
  --exclude="workspace.backup*/***"
)

if [[ "$INCLUDE_DAILIES" != "1" ]]; then
  common_excludes+=(
    --exclude="memory/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].md"
    --exclude="workspace/memory/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].md"
  )
fi

sync_markdown_tree() {
  local src="$1"
  local name="$2"
  shift 2
  local dest="${SYNC_ROOT}/${name}"
  mkdir -p "$dest"
  rsync -a -m --delete --delete-excluded \
    "${common_excludes[@]}" \
    "$@" \
    --include="*/" \
    --include="*.md" \
    --exclude="*" \
    "$src/" "$dest/"
}

sync_into() {
  local src="$1"
  local dest="$2"
  mkdir -p "$dest"
  rsync -a -m --delete --delete-excluded \
    "${common_excludes[@]}" \
    --include="*/" \
    --include="*.md" \
    --exclude="*" \
    "$src/" "$dest/"
}

if [[ "$MODE" == "legacy" ]]; then
  sync_markdown_tree "/Users/calbotsman/.openclaw" "openclaw-md"
  sync_markdown_tree "/Users/calbotsman/clawd" "clawd-md"
else
  sync_markdown_tree "/Users/calbotsman/.openclaw" "openclaw-md" "${focused_openclaw_excludes[@]}"
  sync_markdown_tree "/Users/calbotsman/clawd" "clawd-md" "${focused_clawd_excludes[@]}"
fi

# Canonical agent knowledge (curated source of truth)
sync_markdown_tree "/Users/calbotsman/clawd/agents" "agents-knowledge" --exclude="zara/LEGACY_DIRECTOR_SNAPSHOT/***"

# Keep clawd-md/memory aligned with runtime memory source.
sync_into "/Users/calbotsman/.openclaw/workspace/memory" "${SYNC_ROOT}/clawd-md/memory"

cat >"${SYNC_ROOT}/SYNC_MAP.md" <<EOF
# Obsidian Sync Map

- Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Mode: ${MODE}
- Include daily notes: ${INCLUDE_DAILIES}

## Paths

- openclaw mirror: \`Studio/Sync/openclaw-md/\`
- clawd mirror: \`Studio/Sync/clawd-md/\`
- canonical agent knowledge: \`Studio/Sync/agents-knowledge/\`

## Focused Mode Notes

Focused mode excludes high-churn/runtime-noise paths by default:

- sessions/logs/cron runs/runtime credentials
- .git/node_modules/dist
- ledger raw/observations and large generated output trees
- legacy Zara snapshot archives

Use \`SYNC_MODE=legacy\` to force full legacy behavior.
EOF

echo "Markdown sync complete: ${SYNC_ROOT} (mode=${MODE}, include_dailies=${INCLUDE_DAILIES})"
