---
name: self-improving-agent
description: Log corrections/errors/feature-requests into workspace files so the agent improves over time (OpenClaw-first).
metadata: {"openclaw":{"emoji":"🧠","requires":{"env":[],"bins":[]}}}
---

# Self-Improving Agent

Use this skill when something goes wrong or we learn something worth keeping.

## Write-Ahead Rules

- If it matters later, write it now (don’t rely on chat history).
- Never write secrets (tokens, keys, passwords) into learnings.

## Where To Log

- Corrections / better approach / preference: `.learnings/LEARNINGS.md`
- Command/tool failure: `.learnings/ERRORS.md`
- Missing capability the human asked for: `.learnings/FEATURE_REQUESTS.md`

## Minimal Entry Format

- Timestamp
- One-line summary
- What happened (concrete)
- What to do next time (actionable)
- Relevant files/commands (no secrets)

## Optional Hook

This skill includes an OpenClaw hook (in `hooks/openclaw/`) that injects a short reminder at bootstrap.
Enable hooks only if you’ve reviewed the code.

## References

- Full upstream content: `references/ORIGINAL_SKILL.md`
- Hook setup details: `references/openclaw-integration.md`
