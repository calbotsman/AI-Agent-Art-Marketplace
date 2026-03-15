#!/bin/bash
# Batch skill cleanup decision helper
# Usage: bash loops/skill_cleanup_decision.sh [commit|ignore|discard]

ACTION="${1:-}"
SKILLS=(
  "skills/clawsec"
  "skills/clawd-cursor"
  "skills/proxy"
  "skills/team-tasks"
  "skills/moltron"
)

if [[ "$ACTION" == "commit" ]]; then
  git add "${SKILLS[@]}"
  echo "✓ Staged ${#SKILLS[@]} skills for commit. Review with 'git status' and commit manually."
elif [[ "$ACTION" == "ignore" ]]; then
  for skill in "${SKILLS[@]}"; do
    echo "$skill/" >> .gitignore
  done
  echo "✓ Added ${#SKILLS[@]} skills to .gitignore."
elif [[ "$ACTION" == "discard" ]]; then
  echo "⚠️  About to delete ${#SKILLS[@]} skills (52M total):"
  du -sh "${SKILLS[@]}" 2>/dev/null
  echo "Type 'DELETE' to confirm:"
  read -r confirm
  if [[ "$confirm" == "DELETE" ]]; then
    rm -rf "${SKILLS[@]}"
    echo "✓ Deleted ${#SKILLS[@]} skills."
  else
    echo "✗ Aborted."
  fi
else
  echo "Usage: bash loops/skill_cleanup_decision.sh [commit|ignore|discard]"
  echo ""
  echo "Current untracked skills (52M total):"
  du -sh "${SKILLS[@]}" 2>/dev/null
  exit 1
fi
