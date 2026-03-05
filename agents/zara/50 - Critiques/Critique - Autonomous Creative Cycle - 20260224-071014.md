# Autonomous Creative Self-Learning Input

- Generated: 2026-02-24T12:13:27.607Z
- Review decision: SHIP
- Round: 41
- Profile: packaging
- QA total cases: 16
- QA pass: 6
- QA fail: 10

## Keep
- Preserve section and combination cases passing with no expectation mismatch.
- Keep profile-linked direction structure when HAS_PROFILE_LINK and HAS_REQUIRED_SECTIONS are both yes.

## Kill
- Kill repeated low-contrast text pairings and accent overuse patterns.
- Kill logo systems that fail variant count or monochrome readiness.

## Change
- Prioritize fixing failing combination cases before isolated section failures.
- Promote any repeated pass pattern into stable profile constraints.

## Top QA Violations
- [typo-fail-too-small] [body] fontSizePx 7 < 8
- [typo-fail-low-contrast] [body] contrastRatio 3.2 < 4.5
- [color-fail-text-contrast] text/background contrast 2.30 < 4.50
- [color-fail-text-contrast] primary/background contrast 2.10 < 3.00
- [color-fail-accent-overuse] accent/background contrast 2.29 < 3.00
- [color-fail-accent-overuse] accentUsageRatio 0.42 > 0.2 (one accent at a time rule)
- [logo-fail-variants] variantCount 2 < 3
- [logo-fail-family-sprawl] familyCount 3 > 2
- [layout-fail-grid] gridTemplateColumns "1fr 280px 1fr" must be "1fr 300px 1fr"
- [layout-fail-overflow-rows] ingredientRows 10 > 8
- [layout-fail-overflow-rows] overflowDetected true while allowOverflow is false
- [combo-fail-type-color] [typography] [body] fontSizePx 7 < 8
- [combo-fail-type-color] [typography] [body] lineLengthChars 64 outside 28-58
- [combo-fail-logo-layout] [logo] variantCount 2 < 3
- [combo-fail-logo-layout] [logo] familyCount 3 > 2

## Sources
- QA summary: `/Users/calbotsman/clawd/output/creative-learning-loop/20260224-071014/tests/20260224-071327/summary.json`
- Review artifact: `/Users/calbotsman/clawd/studio/PIPELINE/creative-loop/ARTIFACTS/review/LATEST.md`