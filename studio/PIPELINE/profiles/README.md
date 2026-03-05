# Task Profiles (Designer Modes)

These files define how one `designer` agent switches behavior by task type without becoming separate agents.

## Files

- `profile.schema.json`: schema for profile contract shape.
- `index.json`: profile registry.
- `logo.json`: logo system execution mode.
- `typography.json`: typography system execution mode.
- `packaging.json`: supplement packaging execution mode.
- `website.json`: web surface execution mode.
- `run-config.example.json`: starter config for selecting a profile in a run.

## Contract rule

Every design run must include:

1. `profileId`
2. strategy brief path
3. direction brief path
4. loop policy path
5. output dir
6. validation evidence

## Runtime dependencies

- `/Users/calbotsman/clawd/studio/PIPELINE/design-system/typography-tokens.json`
- `/Users/calbotsman/clawd/studio/PIPELINE/design-system/layout-tokens.json`
- `/Users/calbotsman/clawd/studio/PIPELINE/validators/typography.ts`
- `/Users/calbotsman/clawd/studio/PIPELINE/validators/layout.ts`
- `/Users/calbotsman/clawd/studio/PIPELINE/creative-loop/LOOP_POLICY.json`
- `/Users/calbotsman/clawd/studio/PIPELINE/testing/creative-test-matrix.json`

## QA execution

Run matrix tests before a final director gate:

```bash
npm run pipeline:test:creative
```
