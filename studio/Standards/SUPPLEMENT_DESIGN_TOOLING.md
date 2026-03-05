# Supplement Design Tooling (Cyborg-Aligned)

Last updated: 2026-02-20 (Recraft V4 workflow locked)

## Source Rules Confirmed

### 1) Locked label rendering rails (must not drift)
Source of truth:
- `/Users/calbotsman/Documents/github/cyborg/backend/src/shared/utils/rendering/templates/label.ts`
- `/Users/calbotsman/clawd/Cyborg_Label_Spec.md`

Hard constraints encoded by the Cyborg template:
- Canvas: `1650 x 600` px
- 3-panel grid: `1fr 300px 1fr`
- Center panel fixed at `300px` (Supplement Facts)
- Left/center/right panel paddings: `32px`, `24px 20px`, `32px`
- Ingredient rows implicitly capped to `<= 8` for layout integrity
- Supplement Facts hierarchy (header, serving rule, table lines, footer disclaimers)

### 1b) Autonomous typography/layout references (canonical)
These paths are the runtime contract for deterministic type/layout quality:
- `/Users/calbotsman/clawd/studio/PIPELINE/design-system/typography-tokens.json`
- `/Users/calbotsman/clawd/studio/PIPELINE/design-system/layout-tokens.json`
- `/Users/calbotsman/clawd/studio/PIPELINE/validators/typography.ts`
- `/Users/calbotsman/clawd/studio/PIPELINE/validators/layout.ts`
- `/Users/calbotsman/clawd/Cyborg_Autonomous_Type_Layout_Workflow.md`

Execution rule:
- Designer (or Zara/Rowan briefs) outputs intent only.
- `label.ts` renders from tokenized values.
- Validators gate pass/fail before artifact delivery.

### 2) Studio design standards for quality
Primary standards:
- `/Users/calbotsman/clawd/studio/Standards/Learning-Loops/Graphic-Design-Standards/STANDARDS.md`
- `/Users/calbotsman/clawd/studio/Standards/Learning-Loops/Graphic-Design-Standards/CHECKLIST.md`

Key guidance:
- One dominant hierarchy move
- Two font families max
- Consistent spacing scale
- Role-based palette and high contrast
- Production checks on export sizes and sharpness

### 3) Zara heuristics and packaging tone
References:
- `/Users/calbotsman/clawd/agents/zara/20 - Heuristics/Graphic Design Standards — Studio.md`
- `/Users/calbotsman/clawd/handoffs/ZARA_DESIGN_REFINEMENTS.md`

Key guidance:
- Systems over vibes
- Restraint over decorative noise
- Tight hierarchy and spacing discipline

## Pipeline Command

Strict Recraft V4 run (default):

```bash
node /Users/calbotsman/clawd/studio/tools/generate_supplement_design_set_recraft_v4.mjs \
  --config /Users/calbotsman/clawd/studio/TEMPLATES/supplement-concept.example.json
```

Via npm alias:

```bash
cd /Users/calbotsman/clawd
npm run design:supplement -- --config /Users/calbotsman/clawd/studio/TEMPLATES/supplement-concept.example.json
```

Optional output root:

```bash
node /Users/calbotsman/clawd/studio/tools/generate_supplement_design_set_recraft_v4.mjs \
  --config /path/to/concept.json \
  --out-dir /Users/calbotsman/clawd/output/supplement-design
```

Emergency fallback mode only:

```bash
node /Users/calbotsman/clawd/studio/tools/generate_supplement_design_set_recraft_v4.mjs \
  --config /path/to/concept.json \
  --allow-fallback-html
```

## Required Input Format

Use a JSON file with:
- `brandName`, `productName`
- `palette` (primary/background/text/border/secondary/accent)
- `fonts`
- `brandLogo` (optional): place a resolved image in the brand slot. Supported keys:
  - `source`: absolute or relative image path (to the JSON file), or remote/http(s)/data URI.
  - `alt`: optional alt text.
  - `maxWidthPx`: optional max width in px (default `360`).
  - `maxHeightPx`: optional max height in px (default `84`).
  - `fit`: optional object-fit for the brand image (`contain`/`cover`/`fill`/`scale-down`/`none`; default `contain`).
- `label` copy + ingredients (max 8)
- `board` narrative fields (positioning, mood, voice, proof)
- optional `render` settings for Recraft V4:
  - `render.recraftModel` (default `recraft/recraft-v4`)
  - `render.recraftStyle` (`vivid` or `natural`, default `vivid`)
  - `render.recraftImageSize` (default `1024x1024`)
  - `render.recraft.scenePrompt`
  - `render.recraft.moodPrompt`

Starter template:
- `/Users/calbotsman/clawd/studio/TEMPLATES/supplement-concept.example.json`

## Outputs Per Concept

Each run writes to:
- `/Users/calbotsman/clawd/output/supplement-design/<concept-id>/<timestamp>/`

Artifacts:
1. `label.html`, `label.png`, `label.pdf`
2. `product-mock.html`, `product-mock.png`
3. `brand-board.html`, `brand-board.png`
4. `recraft-scene.png`, `recraft-mood.png` (strict runs)
5. `manifest.json` (input + output traceability)
6. `workflow-summary.json` (quick status + paths)

## Notes

- Label output is deterministic and spec-locked to Cyborg template constraints.
- Product mock and brand board are generated from the same concept input for cross-surface coherence.
- If ingredient count exceeds 8, generation fails intentionally to protect layout integrity.


## Recraft V4 Validation Gates

Mandatory checks for strict runs:
- `VERCEL_AI_GATEWAY_KEY` (or `AI_GATEWAY_API_KEY`) is loaded in environment.
- Gateway model list includes `recraft/recraft-v4` (and optionally `recraft/recraft-v4-pro` when enabled on the account).
- `manifest.json` contains:
  - `pipeline.imageEngineRequested = "recraft-v4"`
  - `pipeline.imageEngineUsed = "recraft-v4"`
  - `checks.recraftV4Used = true`
- `recraft-scene.png` and `recraft-mood.png` exist in run directory.

If any gate fails, the pipeline hard-fails unless `--allow-fallback-html` is explicitly passed.
