# Obsidian Graph Reference — Noise/Clutter

**Source:** chat screenshot (2026-02-19)

## Observation
- Graph view is dominated by many small nodes; central nodes are not clearly anchored.
- Left sidebar shows lots of sync/vendor paths (e.g., pi‑coding‑agent/docs/images/etc.) indicating the mirror is cluttering the graph.
- Multiple date hubs are still visible.

## Implication
We need stronger exclusion filters + more hub backlinks so graph centers on Zara/Studio hubs instead of sync/vendor nodes.

## Actionable fixes
- Filter: `-path:Studio/Sync/ -path:Daily/ -path:Research/Digests/ -path:backlog/ -path:logs/`
- Use `GRAPH_HUB` as the main entry point.

#learning #designrules
