# RLM Evaluation For Cal

## What It Is
`rlm` (Recursive Language Models) is a recursive inference framework that can process very long context by letting the model run code and sub-calls.

## Decision
Do **not** wire RLM into Cal's always-on production path right now.

## Why
- Default RLM execution can run Python code (`exec`) in-process unless isolated environments are configured.
- Cal's immediate reliability issues are context budgeting + grounding, which we can solve with lower risk via:
  - strict context caps
  - aggressive pruning/compaction
  - session reset/rotation
  - stronger truth contract prompts
- Introducing RLM now increases ops/security complexity for a live Telegram bot.

## Safe Path If Needed Later
- Use only isolated sandbox environment (Modal/Prime), never local `exec`.
- Add explicit allowlist of tasks where RLM is permitted.
- Keep a hard timeout and cost cap per recursive run.
- Keep manual opt-in (feature flag), not default.
