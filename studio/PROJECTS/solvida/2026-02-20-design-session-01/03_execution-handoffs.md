# Execution Handoffs (Orchestrator)

## Task lifecycle
Inbox -> Assigned -> In Progress -> Review -> Done | Failed

Orchestrator owns all state changes.

## Shared acceptance rules
- Every artifact must name which checklist items it passes.
- Every handoff must include: what changed, file paths, verification, risks, and next action.
- All outputs land in this session folder.

## Assignments

### Designer (build)
- Task: Produce 2-3 visual variants for selected direction, then consolidate to one recommended system.
- Output path: `/Users/calbotsman/clawd/studio/PROJECTS/solvida/2026-02-20-design-session-01/artifacts/designer/`
- Required files:
  - `variant-a.md`
  - `variant-b.md`
  - `variant-c.md` (optional)
  - `recommended-system.md`
- Must include:
  - Type scale, grid, spacing scale, palette roles.
  - 6-surface mapping (IG post, IG story, landing hero, email header, product label, pitch slide).

### Copy (build)
- Task: Generate constrained copy set that supports hierarchy and proof language.
- Output path: `/Users/calbotsman/clawd/studio/PROJECTS/solvida/2026-02-20-design-session-01/artifacts/copy/`
- Required files:
  - `taglines.md` (5 options, each with one-line rationale)
  - `benefit-lines.md` (10 options)
  - `microcopy.md` (CTA + support text)
- Constraint: No abstract wellness cliches; each line must map to a message pillar.

### Producer (review + packaging)
- Task: QA deliverables for completeness and production readiness.
- Output path: `/Users/calbotsman/clawd/studio/PROJECTS/solvida/2026-02-20-design-session-01/artifacts/producer/`
- Required files:
  - `delivery-checklist.md`
  - `risks-and-blockers.md`
  - `handoff-summary.md`
- Must validate:
  - Naming consistency
  - Missing specs
  - Print and digital constraints

## Review gate (Zara)
- Review file: `04_critique-gate-round-1.md`
- Decision options: SHIP / REVISE / HOLD
- If REVISE: add 3 concrete changes and 1 repeat-prevention test.
