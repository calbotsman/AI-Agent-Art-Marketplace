# Creative Loop Pipeline

Canonical loop:
1. Research
2. Strategy
3. Creative Direction
4. Review
5. If review == REVISE -> loop to Research
6. If review == SHIP -> stop (accepted)
7. If review == STOP -> stop (max-review termination)

This pipeline runs via isolated OpenClaw agents and writes artifacts to this folder.

## Role contract and task profiles

Before design execution starts:

1. Load `/Users/calbotsman/clawd/studio/PIPELINE/contracts/TEAM_OPERATING_CONTRACT.md`
2. Select one profile from `/Users/calbotsman/clawd/studio/PIPELINE/profiles/index.json`
3. Use `/Users/calbotsman/clawd/studio/PIPELINE/profiles/run-config.example.json` shape for run inputs

Designer behavior is profile-driven, not agent-sprawl-driven:
- One `designer` agent
- Multiple profile modes (`logo`, `typography`, `packaging`, `website`)
- Deterministic validator evidence before director ship gate

## Director acceptance timing

Source of truth:
- `/Users/calbotsman/clawd/studio/PIPELINE/creative-loop/LOOP_POLICY.json`

Default governance:
1. Minimum reviews before acceptance: `3`
2. Target acceptance checkpoint: `3`
3. Hard max reviews: `4`

Decision rule:
1. `REVISE` if criteria fail and under max.
2. `SHIP` if criteria pass and minimum review count is met.
3. `STOP` if still not ready at max reviews.

## Autonomous execution

No-human-in-loop cycle runner:
- `/Users/calbotsman/clawd/scripts/run_autonomous_creative_learning_cycle.sh`

Creative QA matrix:
- `/Users/calbotsman/clawd/studio/PIPELINE/testing/creative-test-matrix.json`
- `/Users/calbotsman/clawd/studio/PIPELINE/testing/run_creative_tests.mjs`

Commands:

```bash
npm run pipeline:test:creative
```

```bash
npm run pipeline:cycle:autonomous
```
