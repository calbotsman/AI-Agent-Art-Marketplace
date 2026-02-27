# Design Exercises

Use this area for structured design iteration with direct human feedback loops.

## Loop
1. Initialize an exercise.
2. Generate round output.
3. Attach output manifest to that round.
4. Record feedback with `REVISE` or `SHIP`.
5. Repeat until `SHIP`.

## Commands
```bash
cd /Users/calbotsman/clawd

# 1) initialize
npm run design:exercise -- init \
  --brand "Sun Daughter" \
  --exercise "Nocturne Label Iteration"

# 2) run strict supplement pipeline (Recraft V4 default)
npm run design:supplement -- \
  --config /Users/calbotsman/clawd/studio/TEMPLATES/supplement-concept.example.json

# 3) attach output manifest to a round
npm run design:exercise -- attach-output \
  --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/nocturne-label-iteration \
  --round 1 \
  --manifest /Users/calbotsman/clawd/output/supplement-design/sun-daughter-nocturne-01/<timestamp>/manifest.json

# 4) capture feedback
npm run design:exercise -- feedback \
  --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/nocturne-label-iteration \
  --round 1 \
  --decision REVISE \
  --summary "Brand hierarchy still weak; copy block too dense" \
  --focus "Increase brand prominence, reduce copy density"

# 5) check status
npm run design:exercise -- status \
  --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/nocturne-label-iteration
```

## Required per exercise
- `brief.md`
- `feedback-log.md`
- `state.json`
- `iterations/<round>/iteration.md`
- `iterations/<round>/assets.md`
- `iterations/<round>/feedback.md`

## Standard decision rule
- `REVISE`: open next round and carry forward focus.
- `SHIP`: close exercise.
