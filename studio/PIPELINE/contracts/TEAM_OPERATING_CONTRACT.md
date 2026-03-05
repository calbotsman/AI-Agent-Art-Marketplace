# Team Operating Contract (Role-Based, Profile-Driven)

Last updated: 2026-02-21

## Why this exists

This contract keeps one `designer` agent as the execution engine while switching task modes via profile files.
It prevents agent sprawl (`logo agent`, `type agent`, `package agent`, `web agent`) and keeps quality deterministic.

## Role ownership (locked)

1. `strategy` (Rowan)
- Owns context, audience, market, constraints, success criteria.
- Output artifact: strategy brief.

2. `director` (Zara)
- Owns creative thesis, taste direction, non-negotiables, and final ship gate.
- Output artifact: creative direction brief.

3. `designer` (executor)
- Owns production only.
- Must select one profile from `/Users/calbotsman/clawd/studio/PIPELINE/profiles/`.
- Must apply design system + validators from the selected profile before handoff.

4. `validators` (deterministic QA)
- Own pass/fail checks for typography/layout and other rule modules as they are added.
- Validator outputs are required in every design handoff.

## Required task state flow

`Inbox -> Assigned -> In Progress -> Review -> Done | Failed`

## Loop termination contract (director gate)

Director acceptance is deterministic, not open-ended.

1. Policy source: `/Users/calbotsman/clawd/studio/PIPELINE/creative-loop/LOOP_POLICY.json`
2. Minimum reviews before accept (`minReviewsBeforeShip`): `3`
3. Target acceptance checkpoint (`targetAcceptanceReview`): `3`
4. Hard max reviews (`maxReviews`): `4`

Decision semantics:

1. `REVISE`: one or more acceptance criteria failed and `review_count < maxReviews`.
2. `SHIP`: all acceptance criteria passed and `review_count >= minReviewsBeforeShip`.
3. `STOP`: criteria still failing at `review_count >= maxReviews` (loop closes without shipping).

Loop end condition:

1. Loop ends on `SHIP` or `STOP`.
2. Loop continues only on `REVISE`.

## Mandatory handoff contract

Every role handoff must include:

1. What changed.
2. Artifact paths.
3. Validation evidence.
4. Known risks.
5. Next owner.
6. For strategy handoff, include the latest logo influence signal packet (if available) and any stylistic constraints derived from tags.

## Autonomous QA requirement

Before every director ship gate, run:

- `/Users/calbotsman/clawd/studio/PIPELINE/testing/run_creative_tests.mjs`

Coverage must include both:

1. Section checks: typography, color, logo, layout.
2. Combination checks: logo + typography + color + layout.

## Designer execution contract

For every design task:

1. Load exactly one profile file.
2. Load required system refs from that profile.
3. Produce listed deliverables for that profile.
4. Run listed QA gates.
5. Hand off to `director` with evidence.

If any required QA gate fails, status is `Failed` or `Revise`, never `Done`.

## Canonical local references

- Profiles: `/Users/calbotsman/clawd/studio/PIPELINE/profiles/`
- Design system: `/Users/calbotsman/clawd/studio/PIPELINE/design-system/`
- Validators: `/Users/calbotsman/clawd/studio/PIPELINE/validators/`
- Creative loop: `/Users/calbotsman/clawd/studio/PIPELINE/creative-loop/`
- Supplement rails (read-only): `/Users/calbotsman/Documents/github/cyborg/backend/src/shared/utils/rendering/templates/label.ts`
