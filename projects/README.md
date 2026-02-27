# projects/

This is where we build.

## Structure
- `games/` - prototypes and shipped games
- `products/` - apps/tools/services
- `labs/` - experiments, spikes, throwaways
- `templates/` - reusable scaffolds
- `design-exercises/` - structured round-based design iteration with feedback logging

## Workflow (fast)
1. Idea -> 5-sentence spec
2. Constraints + success metric
3. First playable/usable prototype in <2 hours
4. Iterate

## Design Exercise Loop
Use `design-exercises/` when a project needs explicit round-by-round critique.

```bash
cd /Users/calbotsman/clawd
npm run design:exercise -- init --brand "Sun Daughter" --exercise "Nocturne Label Iteration"
```
