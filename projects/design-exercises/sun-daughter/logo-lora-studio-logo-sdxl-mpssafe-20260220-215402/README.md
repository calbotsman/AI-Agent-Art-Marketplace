# Sun Daughter - Logo LoRA studio_logo_sdxl_mpssafe_20260220_215402

## Objective
Develop Sun Daughter logo candidates using the newly trained SDXL LoRA with inline Rowan->Zara review gates.

## Workflow
1. Run an iteration render.
2. Attach output manifest to the round.
3. Capture human feedback with decision (REVISE or SHIP).
4. If REVISE, next round is auto-created.

## Commands
```bash
# attach generated outputs to round 1
node /Users/calbotsman/clawd/studio/tools/design_exercise_loop.mjs attach-output \
  --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/logo-lora-studio-logo-sdxl-mpssafe-20260220-215402 \
  --round 1 \
  --manifest /absolute/path/to/manifest.json

# capture feedback and auto-open next round if needed
node /Users/calbotsman/clawd/studio/tools/design_exercise_loop.mjs feedback \
  --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/logo-lora-studio-logo-sdxl-mpssafe-20260220-215402 \
  --round 1 \
  --decision REVISE \
  --summary "Your concise critique" \
  --focus "What to change next"
```

## Structure
- `brief.md`
- `feedback-log.md`
- `state.json`
- `iterations/01..NN/`

## Recovery Notes
- `LORA_RUNTIME_RECOVERY_2026-02-21.md` - root-cause analysis, fixes, verification, and ASAP runbook.
