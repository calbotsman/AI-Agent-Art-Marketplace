# Obsidian Tangle Map

Purpose: keep graph links meaningful by centering a few canonical hubs.

## Mirror Rules

- Source of truth is `/Users/calbotsman/clawd`.
- Obsidian mirror root is `Studio/Sync/`.
- Sync command:
  ```bash
  cd /Users/calbotsman/clawd
  npm run sync:obsidian
  ```

## Canonical Hubs

- Workspace state:
  - `/Users/calbotsman/clawd/CURRENT_PROJECT.md`
  - `/Users/calbotsman/clawd/PROJECTS.md`
  - `/Users/calbotsman/clawd/MEMORY.md`
- Agent knowledge:
  - `/Users/calbotsman/clawd/AGENTS_KNOWLEDGE.md`
  - `/Users/calbotsman/clawd/agents/zara/00 - Zara Dashboard.md`
- Studio system:
  - `/Users/calbotsman/clawd/studio/STUDIO_OS.md`
  - `/Users/calbotsman/clawd/studio/Standards/Learning-Loops/Graphic-Design-Standards/STANDARDS.md`
- Active cleanup:
  - `/Users/calbotsman/clawd/studio/PROJECTS/workspace-hygiene/CLAWD_CLEANUP_RUNBOOK.md`

## Anti-Noise Rules

- Exclude runtime churn from mirror (`logs`, `cron`, `credentials`, `media`, vendor dirs).
- Exclude heavy/generated paths (`output`, `outputs`, model artifacts, legacy snapshots).
- Prefer linking to hub notes above instead of deep random nodes.

## Health Check

After sync, confirm `Studio/Sync/SYNC_MAP.md` exists and noise remains low.
