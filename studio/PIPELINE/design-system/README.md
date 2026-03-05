# Design System Tokens (Clawd Supplement Pipeline)

Canonical, machine-readable rules for autonomous supplement typography/layout in this workspace.

## Files
- `typography-tokens.json`: role-based typography rules and QA limits.
- `layout-tokens.json`: geometry/grid/spacing constraints and QA limits.

## Runtime integration points
- Renderer source of truth:
  - `/Users/calbotsman/Documents/github/cyborg/backend/src/shared/utils/rendering/templates/label.ts`
  - Read-only reference; do not write from this workspace update flow.
- Clawd-side validators:
  - `/Users/calbotsman/clawd/studio/PIPELINE/validators/typography.ts`
  - `/Users/calbotsman/clawd/studio/PIPELINE/validators/layout.ts`

## Workflow contract
- Designer/strategy outputs intent only (hierarchy, emphasis, tone).
- Renderer applies deterministic rules from tokens.
- Validators pass/fail each candidate before delivery.
