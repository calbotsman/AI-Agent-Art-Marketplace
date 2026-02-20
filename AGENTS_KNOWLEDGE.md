# Agent Knowledge: Canonical Paths

This repo has two different kinds of “agents” things on purpose:

## 1) Canonical *agent knowledge* (markdown you edit)
- **Source of truth:** `/Users/calbotsman/00 - cal/agents`
- **Convenience entrypoint (symlink):** `/Users/calbotsman/clawd/agents-knowledge` → `/Users/calbotsman/00 - cal/agents`
- This is where personas, rules, critiques, and any long-lived agent docs should live.

## 2) OpenClaw runtime state (do not treat as knowledge)
- **Runtime:** `/Users/calbotsman/.openclaw/agents`
- Contains sessions/logs/state/config churn; it is *not* the canonical markdown knowledge base.

## Obsidian sync
The sync script (`scripts/sync_markdown_to_obsidian.sh`) explicitly syncs the canonical agent knowledge into Obsidian under:
- `Studio/Sync/agents-knowledge/`
