# Cal Runtime Recovery + Work Status (2026-02-21)

## Why this exists
Cal was drifting and missing context. This handoff is the authoritative restart brief.

## Root cause findings (verified)
1. Gateway restart churn:
- `com.tcr.openclaw.foundation` runs every 15 minutes.
- `cal-foundation.sh` was rewriting `MEMORY.md` handoff every run (timestamp-only change) and then restarting gateway each time.
- Result: repeated session disruption and continuity loss.

2. Aggressive/unstable session profile:
- Main session was on `gemini-2.5-flash` with repeated low-context-window warnings and occasional unknown runtime errors.
- Daily/idle reset profile contributed to perceived “forgetfulness”.

3. Stale briefing sources:
- `INSTRUCTIONS_FOR_CAL_NOW.md` was old and pointed at unrelated infra tasks.
- Auto handoff block in `MEMORY.md` was stale and not aligned with current design work.

## Runtime fixes applied
- Patched `/Users/calbotsman/.openclaw/scripts/cal-foundation.sh`:
  - memory handoff no longer updates when payload is unchanged.
  - memory handoff updates no longer trigger gateway restart.
  - continuity defaults updated (higher idle floor, stronger context defaults).
- Updated `/Users/calbotsman/Library/LaunchAgents/com.tcr.openclaw.foundation.plist`:
  - `FOUNDATION_PRIMARY_MODEL=openai/gpt-5-mini`
  - `FOUNDATION_FALLBACK_MODELS=google/gemini-2.5-flash,openrouter/openrouter/auto,openai/gpt-5.2`
  - `FOUNDATION_MIN_CONTEXT_TOKENS=120000`
  - `FOUNDATION_MIN_DM_HISTORY_LIMIT=40`
- Updated runtime config `/Users/calbotsman/.openclaw/openclaw.json`:
  - main primary model `openai/gpt-5-mini`
  - context tokens `120000`
  - session reset mode `daily` with `idleMinutes=720`

## Current high-priority delivery task
Deliver Sun Daughter logos from the new LoRA run to Telegram with 3 PNG versions.

### LoRA training status
- Active run:
  - `studio_logo_sdxl_mpssafe_20260220_215402`
- Process currently running:
  - `scripts/train_logo_lora_kohya.sh`
  - `sdxl_train_network.py ... --output_name=studio_logo_sdxl_mpssafe_20260220_215402`
- Existing checkpoint:
  - `/Users/calbotsman/clawd/models/lora/studio-logo/studio_logo_sdxl_mpssafe_20260220_215402-step00000050.safetensors`

### Post-train automation already armed
- Watcher is already running:
  - `/Users/calbotsman/clawd/scripts/run_sun_daughter_logo_process_after_lora.sh studio_logo_sdxl_mpssafe_20260220_215402`
- It will:
  - run Rowan -> Zara 2-round logo process,
  - generate logo sets under `/Users/calbotsman/clawd/output/logo/lora/sun-daughter/...`,
  - send Telegram message + 3 PNG logo versions.

### Immediate fallback (send now if training still running)
If the LoRA run is still active, send existing high-quality outputs immediately so the user gets assets now:
- `/Users/calbotsman/clawd/output/supplement-design/sun-daughter-nocturne-02/20260220-170930/label.png`
- `/Users/calbotsman/clawd/output/supplement-design/sun-daughter-nocturne-02/20260220-170930/product-mock.png`
- `/Users/calbotsman/clawd/output/supplement-design/sun-daughter-nocturne-02/20260220-170930/brand-board.png`

## Important completed work to preserve

### Autonomous creative pipeline
- Handoff: `/Users/calbotsman/clawd/handoffs/CAL_AUTONOMOUS_CREATIVE_LOOP_HANDOFF_2026-02-21.md`
- Key scripts:
  - `/Users/calbotsman/clawd/scripts/run_autonomous_creative_learning_cycle.sh`
  - `/Users/calbotsman/clawd/studio/PIPELINE/testing/run_creative_tests.mjs`
- Key outputs:
  - `/Users/calbotsman/clawd/output/creative-learning-loop/20260221-010958`
  - `/Users/calbotsman/clawd/output/creative-qa/20260221-011334/summary.json`

### Workspace + Obsidian cleanup
- Runbook: `/Users/calbotsman/clawd/studio/PROJECTS/workspace-hygiene/CLAWD_CLEANUP_RUNBOOK.md`
- Tangle map: `/Users/calbotsman/clawd/studio/PROJECTS/workspace-hygiene/OBSIDIAN_TANGLE_MAP.md`
- Latest audit summary:
  - `/Users/calbotsman/clawd/output/cleanup-audit/20260221-012404/summary.md`
- Result:
  - temp/backup candidates: `0`
  - Obsidian noise hits: `0`

## Immediate execution checklist for Cal
1. Confirm LoRA trainer still running.
2. If stopped, verify checkpoint exists and run:
   ```bash
   cd /Users/calbotsman/clawd
   bash scripts/run_sun_daughter_logo_process_after_lora.sh studio_logo_sdxl_mpssafe_20260220_215402
   ```
3. Confirm output summary exists:
- `.../output/logo/lora/sun-daughter/<run>/<timestamp>/process-summary.md`
4. Confirm Telegram delivery sent with 3 PNG files.
5. Send user a short completion update with:
   - output folder path,
   - 3 PNG file paths,
   - critique path.
