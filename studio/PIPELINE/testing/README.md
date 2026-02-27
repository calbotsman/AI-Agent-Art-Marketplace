# Creative QA Matrix

This folder defines deterministic tests for autonomous creative production.

## Files

- `creative-test-matrix.json`: section-level and combination-level test cases.
- `run_creative_tests.mjs`: executes matrix against current pipeline design rules.

## Coverage

- Section tests:
  - typography
  - color
  - logo
  - layout
- Combination tests:
  - logo + typography + color + layout

## Run

```bash
node /Users/calbotsman/clawd/studio/PIPELINE/testing/run_creative_tests.mjs
```

Optional:

```bash
node /Users/calbotsman/clawd/studio/PIPELINE/testing/run_creative_tests.mjs \
  --matrix /Users/calbotsman/clawd/studio/PIPELINE/testing/creative-test-matrix.json \
  --out /Users/calbotsman/clawd/output/creative-qa
```

The command prints the output `summary.json` path and writes:

- `summary.json`
- `summary.md`
- `failing-case-ids.txt`
- `creative-test-matrix.snapshot.json`
