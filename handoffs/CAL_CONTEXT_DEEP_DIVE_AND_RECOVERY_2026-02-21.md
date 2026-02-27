# Cal Context Deep Dive + Recovery (2026-02-21)

## Incident
User reported Cal losing context and failing to deliver requested folders + PNGs.

## Root Causes (verified)

1. Provider/auth instability during responses
- Evidence: `/Users/calbotsman/.openclaw/logs/gateway.err.log`
- Observed at `2026-02-21T06:33:38Z` and `06:36:06Z`:
  - `FailoverError: You exceeded your current quota...`
  - `No available auth profile for openai`
- Impact: first-pass reply attempt fails, then failover behavior becomes inconsistent.

2. Large per-turn prompt/token overhead
- Evidence: `/Users/calbotsman/.openclaw/agents/main/sessions/sessions.json` (`agent:main:main.systemPromptReport`)
- Current report shows:
  - system prompt ~`42799` chars
  - input tokens on live turns ~`19k+` before normal work
- Impact: context budget gets consumed fast, increasing pruning/rotation pressure.

3. Historical gateway restart churn from foundation loop (already fixed)
- Evidence: `/Users/calbotsman/.openclaw/logs/foundation.log`
- Earlier pattern repeatedly showed:
  - `memory handoff updated ... restarting gateway`
  - frequent session disruptions every ~15 minutes
- Current state after patch: `config/session check ok` entries without memory-triggered restart.

4. Ambiguous task mapping for “LoRA folders”
- Evidence: `/Users/calbotsman/.openclaw/agents/main/sessions/9712dbc2-5535-4e42-b8a4-bcf07e29003a.jsonl`
- Cal answered with supplement output folders only, not the model training/checkpoint paths.
- Impact: user sees “clueless” behavior despite partial correctness.

5. Non-deterministic send behavior
- Evidence: `/Users/calbotsman/.openclaw/logs/gateway.err.log`
- Observed errors:
  - `message failed: Action send requires a target.`
- Impact: asset delivery silently fails if target is omitted.

## Recovery Actions Applied

1. Delivery hardening
- Added deterministic sender script:
  - `/Users/calbotsman/clawd/scripts/send_latest_sun_daughter_assets.sh`
- Added npm alias:
  - `npm run sun-daughter:send-assets`
- Behavior:
  - prefers latest logo-lora `round-02` `logo-*.png`
  - fallback to supplement design `label/product-mock/brand-board`
  - always sends folder + 3 PNG files to Telegram target `6736310070`

2. Runtime fallback tuning
- Updated fallback order to reduce OpenAI-quota thrash delays:
  - `/Users/calbotsman/.openclaw/openclaw.json`
  - `/Users/calbotsman/.openclaw/scripts/cal-foundation.sh`
  - `/Users/calbotsman/Library/LaunchAgents/com.tcr.openclaw.foundation.plist`
- New order starts with `google/gemini-2.5-flash`, then `openrouter/openrouter/auto`, then `openai/gpt-5.2`.

3. Cal briefing refresh
- Replaced `/Users/calbotsman/clawd/INSTRUCTIONS_FOR_CAL_NOW.md` with context-locked, path-specific instructions.
- Added mandatory reply format and mandatory sender command.

4. Immediate user delivery executed
- Sent folder + 3 PNGs to Telegram target `6736310070`.
- Delivery confirmations:
  - message IDs: `6429`, `6430`, `6431`, `6432`

## Current State
- LoRA training still running:
  - `studio_logo_sdxl_mpssafe_20260220_215402`
- Watcher process armed:
  - `/Users/calbotsman/clawd/scripts/run_sun_daughter_logo_process_after_lora.sh studio_logo_sdxl_mpssafe_20260220_215402`
- User flagged prior supplement PNGs as old (`message_id: 6433`); clarification with canonical LoRA folders and run status sent (`message_id: 6435`).

## Operational Rule
When user asks for assets: do not reason first, run sender first.
