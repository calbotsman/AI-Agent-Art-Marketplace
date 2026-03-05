# Sun Daughter - Logo Iteration with Wordmark

## Objective
Run iterative design exploration with structured feedback loops.

## Workflow
1. Run an iteration render.
2. Attach output manifest to the round.
3. Capture human feedback with decision (REVISE or SHIP).
4. If REVISE, next round is auto-created.

## Commands
```bash
# attach generated outputs to round 1
node /Users/calbotsman/clawd/studio/tools/design_exercise_loop.mjs attach-output \
  --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/logo-iteration-with-wordmark \
  --round 1 \
  --manifest /absolute/path/to/manifest.json

# capture feedback and auto-open next round if needed
node /Users/calbotsman/clawd/studio/tools/design_exercise_loop.mjs feedback \
  --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/logo-iteration-with-wordmark \
  --round 1 \
  --decision REVISE \
  --summary "Your concise critique" \
  --focus "What to change next"
```

## Structure
- `brief.md`
- `feedback-log.md`
- `state.json`
- `iterations/01..NN/`
