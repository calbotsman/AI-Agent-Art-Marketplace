#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/Users/calbotsman/clawd}"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
OUT_DIR="${ROOT}/output/cleanup-audit/${TIMESTAMP}"
SYNC_ROOT="/Users/calbotsman/Library/Mobile Documents/iCloud~md~obsidian/Documents/taste/TCR-Studio/Studio/Sync"

if [[ ! -d "$ROOT" ]]; then
  echo "Root path not found: $ROOT" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

TOP_LEVEL_SIZES="$OUT_DIR/top_level_sizes.txt"
LARGEST_PATHS="$OUT_DIR/largest_paths_depth3.txt"
ROOT_FILES="$OUT_DIR/root_files.txt"
TEMP_BACKUP_CANDIDATES="$OUT_DIR/temp_backup_candidates.txt"
DUPLICATE_CONCEPTS="$OUT_DIR/duplicate_concepts.txt"
OBSIDIAN_DIRS="$OUT_DIR/obsidian_dirs.txt"
OBSIDIAN_NOISE_HITS="$OUT_DIR/obsidian_noise_hits.txt"
SUMMARY="$OUT_DIR/summary.md"

# Top-level footprint and largest paths.
du -sh "$ROOT"/* "$ROOT"/.[!.]* 2>/dev/null | sort -hr > "$TOP_LEVEL_SIZES" || true
du -h -d 3 "$ROOT" 2>/dev/null | sort -hr | head -n 250 > "$LARGEST_PATHS"

# Root-level files are usually where clutter starts.
find "$ROOT" -maxdepth 1 -type f | sort > "$ROOT_FILES"

# Backup/temp artifacts that are generally safe to move or delete after review.
find "$ROOT" \
  \( -path "$ROOT/.git" -o -path "$ROOT/.git/*" -o -path "$ROOT/node_modules" -o -path "$ROOT/node_modules/*" -o -path "$ROOT/.venv-kohya" -o -path "$ROOT/.venv-kohya/*" -o -path "$ROOT/tools/kohya_ss" -o -path "$ROOT/tools/kohya_ss/*" \) -prune -o \
  \( -type f \( -name "*~" -o -name "*.bak" -o -name "*.bak.*" -o -name "*.tmp" -o -name "*.temp" -o -name "*.orig" -o -name ".DS_Store" \) -print \
     -o -type d \( -name "__pycache__" -o -name ".pytest_cache" \) -print \) \
  | sort > "$TEMP_BACKUP_CANDIDATES"

# Known duplicate/conflated concepts.
{
  echo "# Duplicate/Conflated Concepts"
  echo ""

  pairs=(
    "output|outputs"
    "workspace-director|agents/workspace-director"
    "agents|agents-knowledge"
    "design|studio/PROJECTS"
    "projects|studio/PROJECTS"
  )

  for pair in "${pairs[@]}"; do
    left="${pair%%|*}"
    right="${pair##*|}"
    left_path="$ROOT/$left"
    right_path="$ROOT/$right"

    left_state="missing"
    right_state="missing"

    if [[ -e "$left_path" ]]; then
      left_state="present"
    fi
    if [[ -e "$right_path" ]]; then
      right_state="present"
    fi

    printf '%s <-> %s :: %s / %s\n' "$left" "$right" "$left_state" "$right_state"

    if [[ "$left" == "agents" && "$right" == "agents-knowledge" && -L "$right_path" ]]; then
      target="$(readlink "$right_path")"
      printf '  - note: %s is a symlink to %s (expected)\n' "$right" "$target"
    fi

    if [[ "$left" == "workspace-director" && "$right" == "agents/workspace-director" && -L "$left_path" ]]; then
      target="$(readlink "$left_path")"
      printf '  - note: %s is a symlink to %s (expected alias)\n' "$left" "$target"
    fi

    if [[ "$left" == "design" && "$right" == "studio/PROJECTS" && "$left_state" == "present" && "$right_state" == "present" ]]; then
      printf '  - note: design/studio-legacy overlap; authoritative active work currently in studio/PROJECTS\n'
    fi

    if [[ "$left" == "projects" && "$right" == "studio/PROJECTS" && "$left_state" == "present" && "$right_state" == "present" ]]; then
      printf '  - note: projects/legacy index retained; active runbooks and generators in studio/PROJECTS\n'
    fi

    if [[ "$left" == "output" && "$right" == "outputs" && "$left_state" == "present" && "$right_state" == "missing" ]]; then
      printf '  - note: outputs/ legacy folder is fully consolidated into output/\n'
    fi
  done
} > "$DUPLICATE_CONCEPTS"

# Obsidian mirror noise checks.
if [[ -d "$SYNC_ROOT" ]]; then
  find "$SYNC_ROOT" -type d | sort > "$OBSIDIAN_DIRS"
  {
    rg -n '/(\.git|node_modules|dist|cron|credentials|media|browser)(/|$)' "$OBSIDIAN_DIRS" || true
    rg -n '/ledger/(raw|observations)(/|$)' "$OBSIDIAN_DIRS" || true
    rg -n '/LEGACY_DIRECTOR_SNAPSHOT(/|$)' "$OBSIDIAN_DIRS" || true
  } > "$OBSIDIAN_NOISE_HITS"
else
  : > "$OBSIDIAN_DIRS"
  : > "$OBSIDIAN_NOISE_HITS"
fi

total_size="$(du -sh "$ROOT" | awk '{print $1}')"
root_file_count="$(wc -l < "$ROOT_FILES" | tr -d ' ')"
temp_count="$(wc -l < "$TEMP_BACKUP_CANDIDATES" | tr -d ' ')"
obsidian_noise_count="$(wc -l < "$OBSIDIAN_NOISE_HITS" | tr -d ' ')"
change_count="0"
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  change_count="$(git -C "$ROOT" status --porcelain | wc -l | tr -d ' ')"
fi

# Fill summary links in a simple deterministic way.
{
  echo "# Clawd Cleanup Audit"
  echo
  echo "- Timestamp: ${TIMESTAMP}"
  echo "- Root: \`${ROOT}\`"
  echo "- Total size: ${total_size}"
  echo "- Root-level loose files: ${root_file_count}"
  echo "- Temp/backup candidates: ${temp_count}"
  echo "- Git working tree changes (tracked + untracked): ${change_count}"
  echo "- Obsidian mirror noise hits: ${obsidian_noise_count}"
  echo
  echo "## Reports"
  echo
  echo "- Top-level sizes: \`${TOP_LEVEL_SIZES}\`"
  echo "- Largest paths (depth 3): \`${LARGEST_PATHS}\`"
  echo "- Root-level files: \`${ROOT_FILES}\`"
  echo "- Temp/backup candidates: \`${TEMP_BACKUP_CANDIDATES}\`"
  echo "- Duplicate concepts: \`${DUPLICATE_CONCEPTS}\`"
  echo "- Obsidian directories snapshot: \`${OBSIDIAN_DIRS}\`"
  echo "- Obsidian noise hits: \`${OBSIDIAN_NOISE_HITS}\`"
  echo
  echo "## Safe-First Action Queue"
  echo
  echo "1. Clear temp/backup candidates (move to trash or archive after quick review)."
  echo "2. Consolidate duplicate concepts (for example \`output/\` vs \`outputs/\`; \`projects/\` vs \`studio/PROJECTS/\`) with explicit ownership rules."
  echo "3. Keep Obsidian mirror in \`focused\` mode and rerun sync after structural moves."
  echo "4. Re-run this audit after each cleanup wave to confirm drift is decreasing."
} > "$SUMMARY"

echo "Cleanup audit complete: $OUT_DIR"
echo "Summary: $SUMMARY"
