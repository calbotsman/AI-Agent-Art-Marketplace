# Clawd Cleanup Runbook

Purpose: keep `/Users/calbotsman/clawd` operationally clean without deleting valuable context.

## Canonical Principles

- Treat `/Users/calbotsman/clawd` as the source of truth.
- Treat Obsidian as a one-way mirror for reading and graphing.
- Prefer non-destructive cleanup first (audit, archive, then remove).

## Weekly Cleanup Cycle

1. Run Obsidian sync in focused mode:
   ```bash
   cd /Users/calbotsman/clawd
   npm run sync:obsidian
   ```
2. Run workspace cleanup audit:
   ```bash
   cd /Users/calbotsman/clawd
   npm run cleanup:audit
   ```
3. Open the latest summary:
   - `output/cleanup-audit/<timestamp>/summary.md`
4. Execute only safe-first actions:
   - clear backup/temp files
   - resolve duplicate concept folders with explicit ownership
   - keep generated artifacts out of source folders
5. Re-run the audit after each cleanup wave.

## Safe-First Actions

- Remove/move backup artifacts (`*.bak`, `*~`, `__pycache__`).
- Keep generated output in `output/` (single canonical artifact root).
- Keep agent knowledge in `agents/` and `agents-knowledge` symlink only.
- Use `studio/PROJECTS/` for active project artifacts; keep `projects/` for legacy/indexed material until migration is complete.

## Ask-First Actions

- Deleting historical notes, memory logs, or handoffs.
- Renaming major top-level folders (`projects/`, `studio/`, `agents/`, `memory/`).
- Any destructive mass-delete beyond obvious temp/backup artifacts.

## Operational Goal

- Shrink top-level noise and ambiguous folder ownership.
- Keep Obsidian graph centered on high-value hubs, not runtime churn.
