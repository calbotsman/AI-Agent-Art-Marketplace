# Cyborg Autonomous Type/Layout Workflow

Last updated: 2026-02-21

## Canonical runtime files

* `/Users/calbotsman/clawd/studio/PIPELINE/design-system/typography-tokens.json`
* `/Users/calbotsman/clawd/studio/PIPELINE/design-system/layout-tokens.json`
* `/Users/calbotsman/Documents/github/cyborg/backend/src/shared/utils/rendering/templates/label.ts`
* `/Users/calbotsman/clawd/studio/PIPELINE/validators/typography.ts`
* `/Users/calbotsman/clawd/studio/PIPELINE/validators/layout.ts`

## Responsibility split

* **Designer/strategy direction:** semantic intent only (priority, tone, emphasis, contrast target).
* **Renderer (`label.ts`):** deterministic geometry + typography application from tokens.
* **Validators:** mathematical pass/fail checks.

## Mathematical checks (minimum set)

1. **Type scale progression**
   * Adjacent hierarchy roles should satisfy: `size_next / size_prev >= 1.15`
2. **Minimum text size**
   * `fontSizePx >= 8`
3. **Body line length**
   * `28 <= lineLengthChars <= 58`
4. **Contrast**
   * Body/micro: `contrastRatio >= 4.5`
   * Headlines/display: `contrastRatio >= 3.0`
5. **Canvas and rails**
   * Canvas must be exactly `1650x600`
   * Grid must remain `1fr 300px 1fr`
6. **Content cap**
   * Ingredient rows must be `<= 8`
7. **Layout integrity**
   * Overflow must be `false`
   * Collision count must be `0`

## Autonomous flow

1. Generate concept intent.
2. Compile intent to tokenized values.
3. Render candidate.
4. Run typography validator.
5. Run layout validator.
6. If any fail, regenerate candidate; if all pass, ship artifact.
