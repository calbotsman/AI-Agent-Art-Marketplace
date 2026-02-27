# Cal Handoff - Autonomous Creative Loop and QA

Date: 2026-02-21
Workspace: `/Users/calbotsman/clawd`

## What changed

1. Loop governance is now deterministic:
- Source of truth: `/Users/calbotsman/clawd/studio/PIPELINE/creative-loop/LOOP_POLICY.json`
- Decisions: `REVISE | SHIP | STOP`
- Default director gate:
  - `minReviewsBeforeShip = 3`
  - `targetAcceptanceReview = 3`
  - `maxReviews = 4`

2. Runtime prompts were wired to enforce loop closure:
- Cron jobs in `/Users/calbotsman/.openclaw/cron/jobs.json`:
  - Stage 1 Research `7338e783-5ef3-4e72-b7fc-d788f781b6f5`
  - Stage 2 Strategy `bbd7d4fa-8065-431b-8958-59ea7bf3fb6b`
  - Stage 3 Creative Direction `53f06530-834e-445f-ac71-c71f053c549a`
  - Stage 4 Review `8282fb92-5dd4-426d-8ef6-b9fb946f41e7`
- Stage 4 computes decisions from policy and writes `STATE: DONE` on `SHIP` or `STOP`.
- Stage 1/2/3 skip when loop is already closed.

3. New autonomous QA matrix for creative sections and combinations:
- Matrix: `/Users/calbotsman/clawd/studio/PIPELINE/testing/creative-test-matrix.json`
- Runner: `/Users/calbotsman/clawd/studio/PIPELINE/testing/run_creative_tests.mjs`
- Coverage:
  - Section-level: typography, color, logo, layout
  - Combination-level: logo + typography + color + layout

4. New no-human-in-loop orchestrator:
- Script: `/Users/calbotsman/clawd/scripts/run_autonomous_creative_learning_cycle.sh`
- Behavior:
  - Optional auto-reset when loop is `DONE`
  - Reopens review gate when state is `ACTIVE` but review is still `SHIP/STOP`
  - Runs Stage 1 -> Stage 2 -> Stage 3 -> Stage 4
  - Enforces stage artifact update checks (round + file mtime), with retries
  - Applies deterministic local fallback writers when a stage no-ops/fails:
    - research fallback
    - strategy fallback
    - direction fallback
    - review/state fallback
  - Snapshots artifacts
  - Runs creative QA matrix
  - Emits self-learning input and writes Zara critique artifact

## New commands

From `/Users/calbotsman/clawd`:

```bash
npm run pipeline:test:creative
```

```bash
npm run pipeline:cycle:autonomous
```

Direct script:

```bash
bash /Users/calbotsman/clawd/scripts/run_autonomous_creative_learning_cycle.sh
```

## Output locations

1. QA-only runs:
- `/Users/calbotsman/clawd/output/creative-qa/<timestamp>/summary.json`
- `/Users/calbotsman/clawd/output/creative-qa/<timestamp>/summary.md`

2. Full autonomous learning cycle runs:
- `/Users/calbotsman/clawd/output/creative-learning-loop/<timestamp>/artifacts/`
- `/Users/calbotsman/clawd/output/creative-learning-loop/<timestamp>/tests/<timestamp>/summary.json`
- `/Users/calbotsman/clawd/output/creative-learning-loop/<timestamp>/self-learning-input.md`
- Zara critique copy:
  - `/Users/calbotsman/clawd/agents/zara/50 - Critiques/Critique - Autonomous Creative Cycle - <timestamp>.md`

## Testing expectations

1. Section tests must run every cycle:
- Typography
- Color
- Logo
- Layout

2. Combination tests must run every cycle:
- At minimum one passing and one failing case for:
  - logo + typography + color + layout

3. Autonomy contract:
- No human approval required per cycle.
- Learning artifacts are generated each cycle for Zara + loop standards updates.

## Operational caveats

1. `LOOP_LOG.md` append behavior from isolated stage agents can still overwrite history depending on write mode in the agent runtime. If persistent historical logging is required, force a read-append-write pattern in each stage prompt.
2. If gateway instability appears, verify:
- `com.tcr.openclaw.guardian` LaunchAgent is loaded.
- Stage run commands still return `ok: true`.
3. Stage 4 (review) can intermittently fail at model runtime with `An unknown error occurred` even when cron returns `ok: true`.
- The autonomous runner now catches this by validating actual file updates and exits non-zero when review output did not update.
- Source trace example: `/Users/calbotsman/.openclaw/agents/review/sessions/e07bec5c-bd75-467e-b63c-840e54f74b8f.jsonl`
4. Stage 2 can intermittently no-op (no file rewrite despite `ok: true`).
- Runner now detects unchanged mtime and uses deterministic strategy fallback to keep loop autonomous.

## Linked docs

- `/Users/calbotsman/clawd/studio/PIPELINE/contracts/TEAM_OPERATING_CONTRACT.md`
- `/Users/calbotsman/clawd/studio/PIPELINE/creative-loop/README.md`
- `/Users/calbotsman/clawd/studio/PIPELINE/creative-loop/LOOP_POLICY.json`
- `/Users/calbotsman/clawd/studio/PIPELINE/profiles/README.md`
- `/Users/calbotsman/clawd/studio/Standards/Learning-Loops/Graphic-Design-Standards/LOOP.md`
