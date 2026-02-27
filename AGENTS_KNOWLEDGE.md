# Agent Knowledge: Canonical Paths

This repo has two different kinds of “agents” things on purpose:

## 1) Canonical *agent knowledge* (markdown you edit)
- **Source of truth:** `/Users/calbotsman/clawd/agents`
- **Convenience entrypoint (symlink):** `/Users/calbotsman/clawd/agents-knowledge` → `/Users/calbotsman/clawd/agents`
- This is where personas, rules, critiques, and any long-lived agent docs should live.

## 2) OpenClaw runtime state (do not treat as knowledge)
- **Runtime:** `/Users/calbotsman/.openclaw/agents`
- Contains sessions/logs/state/config churn; it is *not* the canonical markdown knowledge base.

## Obsidian sync
The sync script (`scripts/sync_markdown_to_obsidian.sh`) explicitly syncs the canonical agent knowledge into Obsidian under:
- `Studio/Sync/agents-knowledge/`
- Default mode is `focused` (high-churn/runtime paths excluded).
- Output map is written to `Studio/Sync/SYNC_MAP.md` on each run.
- Workspace hygiene docs:
  - `/Users/calbotsman/clawd/studio/PROJECTS/workspace-hygiene/CLAWD_CLEANUP_RUNBOOK.md`
  - `/Users/calbotsman/clawd/studio/PROJECTS/workspace-hygiene/OBSIDIAN_TANGLE_MAP.md`

## 3) Supplement Design Canonical Workflow
- **Workspace path:** `/Users/calbotsman/clawd` only.
- **Locked spec sources:**
  - `/Users/calbotsman/Documents/github/cyborg/backend/src/shared/utils/rendering/templates/label.ts`
  - `/Users/calbotsman/clawd/Cyborg_Label_Spec.md`
- **Command hook:** `npm run design:supplement -- --config <concept-json>` (strict Recraft V4 wrapper)
- **Required env:** `VERCEL_AI_GATEWAY_KEY` (or `AI_GATEWAY_API_KEY`)
- **Required outputs per concept:** `label.png`/`label.pdf`, `product-mock.png`, `brand-board.png`, `manifest.json`
- **Recraft evidence artifacts:** `recraft-scene.png`, `recraft-mood.png`, `workflow-summary.json`
- **Iteration workspace:** `/Users/calbotsman/clawd/projects/design-exercises/<brand>/<exercise>/`
- **Guardrails:** fail the run if ingredient rows exceed `8` or if Recraft V4 is unavailable (unless `--allow-fallback-html` is explicitly passed).
