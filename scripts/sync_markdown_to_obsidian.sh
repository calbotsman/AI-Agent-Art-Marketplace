#!/usr/bin/env bash
set -euo pipefail
VAULT="/Users/calbotsman/Library/Mobile Documents/iCloud~md~obsidian/Documents/taste/TCR-Studio/Studio/Sync"
mkdir -p "$VAULT"

sync_one() {
  local SRC="$1"; local NAME="$2"; local DEST="$VAULT/$NAME";
  mkdir -p "$DEST"
  rsync -a --delete --delete-excluded \
    --include='*/' \
    --include='*.md' \
    --exclude='*' \
    --exclude='node_modules/' \
    --exclude='**/node_modules/**' \
    --exclude='**/docs/**' \
    --exclude='**/hooks/**' \
    --exclude='**/dist/**' \
    --exclude='**/tmp-skill-installs/**' \
    --exclude='.git/' \
    --exclude='.clawvault/' \
    --exclude='.openclaw/' \
    "$SRC/" "$DEST/"
}

sync_into() {
  local SRC="$1"; local DEST="$2";
  mkdir -p "$DEST"
  rsync -a --delete \
    --include='*/' \
    --include='*.md' \
    --exclude='*' \
    "$SRC/" "$DEST/"
}

sync_one "/Users/calbotsman/.openclaw" "openclaw-md"
sync_one "/Users/calbotsman/clawd" "clawd-md"
# Canonical agent knowledge lives outside the runtime folders.
# Sync it explicitly so it shows up cleanly in Obsidian.
sync_one "/Users/calbotsman/00 - cal/agents" "agents-knowledge"

# Keep clawd-md/memory aligned with the real OpenClaw workspace memory files,
# so Obsidian doesn't show blank placeholder notes.
sync_into "/Users/calbotsman/.openclaw/workspace/memory" "$VAULT/clawd-md/memory"

echo "Markdown sync complete: $VAULT"
