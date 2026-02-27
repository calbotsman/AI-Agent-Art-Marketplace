# Cyborg Label Render Constraints (LOCKED)

These constraints are defined in `backend/src/shared/utils/rendering/templates/label.ts` and represent the locked render system. Brand aesthetics can be chosen within these rails without breaking the underlying structure.

## Autonomous System References (Typography + Layout)

Use these as the canonical paths for no-human-loop rendering quality:

*   **Typography tokens:** `/Users/calbotsman/clawd/studio/PIPELINE/design-system/typography-tokens.json`
*   **Layout tokens:** `/Users/calbotsman/clawd/studio/PIPELINE/design-system/layout-tokens.json`
*   **Typography validator:** `/Users/calbotsman/clawd/studio/PIPELINE/validators/typography.ts`
*   **Layout validator:** `/Users/calbotsman/clawd/studio/PIPELINE/validators/layout.ts`
*   **Renderer template:** `/Users/calbotsman/Documents/github/cyborg/backend/src/shared/utils/rendering/templates/label.ts`
*   **Workflow explainer:** `/Users/calbotsman/clawd/Cyborg_Autonomous_Type_Layout_Workflow.md`

Workflow contract:
*   Designer outputs semantic intent (hierarchy/emphasis), not pixel placement.
*   Renderer computes deterministic values from tokens.
*   Validators gate pass/fail for overflow, collisions, type size, line-length, and contrast.

## Canvas + Container
*   **Render size:** 1650 × 600 px
*   **Outer border:** 3px solid `var(--border)`
*   **Overflow:** hidden (nothing should bleed outside)

## Layout: CSS Grid 3-Panel Structure
*   **Columns:** `grid-template-columns: 1fr 300px 1fr`
*   **Left panel:** flexible
*   **Center panel:** fixed 300px (Supplement Facts)
*   **Right panel:** flexible
*   **Panel dividers:** left|center and center|right both have `border-right: 2px solid var(--border)`
*   **Gap:** 0

## Spacing (Hard-ish Layout Rhythm)
*   **Left panel padding:** 32px
*   **Center panel padding:** 24px 20px
*   **Right panel padding:** 32px
*   **Right panel vertical rhythm:** `gap: 20px`

## Type + Hierarchy Constraints (As-Coded)

### Brand Mark (Top-Left)
*   `.brand-logo`
*   `font-family: var(--logo-font)`
*   `font-size: ${logoSize}%` (default 140%)
*   `font-weight: ${logoWeight}` (default 700)
*   `letter-spacing: ${logoLetterSpacing}` (default 0.08em)
*   `text-transform: ${logoTransform}` (default uppercase)
*   `color: var(--primary)`
*   `margin-bottom: 16px`

### Product Block (Left Panel)
*   **Product name:**
    *   `font-size: 42px`, `font-weight: 700`, `line-height: 1.1`
    *   `headline font`
*   **Description:**
    *   `font-size: 14px`, `line-height: 1.5`, `opacity: 0.85`
    *   `max-width: 400px`

### Serving Info (Left Bottom)
*   Has a top separator: `border-top: 1px solid rgba(0,0,0,0.1)`
*   **Serving count text:**
    *   `font-size: 16px`, `font-weight: 600`
    *   `letter-spacing: 0.05em`
    *   `color: var(--primary)`

### Supplement Facts (Center Panel, Fixed Width)
*   **Header “Supplement Facts”:**
    *   `font-size: 20px`, `font-weight: 800`
    *   `uppercase`
    *   `thick rule: border-bottom: 8px solid var(--text)`
*   **Serving size info:**
    *   `font-size: 12px`
    *   `bottom rule: border-bottom: 1px solid var(--text)`
*   **Facts table:**
    *   `base font-size: 11px`
    *   `header bottom rule: 1px solid var(--text)`
    *   `row rules: 1px solid rgba(0,0,0,0.15)`
    *   Right column is right-aligned and `font-weight: 500`
*   **Footer note:**
    *   `font-size: 9px`, `opacity: 0.7`, `line-height: 1.4`
    *   Pinned to bottom via `margin-top: auto` in a flex column

### Use + Warnings (Right Panel)
*   **Section title:**
    *   `font-size: 11px`, `font-weight: 700`
    *   `uppercase`, `letter-spacing: 0.1em`
    *   `color: var(--primary)`
*   **Suggested use body:**
    *   `font-size: 11px`, `line-height: 1.5`
*   **Warnings:**
    *   `font-size: 9px`, `line-height: 1.5`, `opacity: 0.8`
*   **Footer:**
    *   `font-size: 9px`, `opacity: 0.6`
    *   Pinned to bottom with `margin-top: auto`

## Content Limits
*   **Ingredients list:** capped at 8 rows (`parseIngredients(...).slice(0, 8)`), so the template is implicitly designed for <= 8 rows.
*   **Fonts:** Expected via Google Fonts (headline/body/logo families), but these are brand decisions that can change without breaking structural constraints.
