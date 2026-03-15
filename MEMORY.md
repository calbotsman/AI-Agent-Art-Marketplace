# MEMORY.md

## User Preferences
- When a task is finished and generates a file, open the file for the user to see.
- Tone must be direct, collaborative, and non-condescending.
- Use no name by default; do not greet by first name unless explicitly requested.
- Never ask for API keys in chat.

## Known Alerts (Non-Actionable)

### Security Audit: Docker Sandbox CRITICAL Alert
- **Alert:** OpenClaw security audit flags `CRITICAL Small models require sandboxing and web tools disabled` on every `openclaw status` run. Recommends setting `agents.defaults.sandbox.mode="all"` when using small models (<300B params) like `ollama/qwen2.5vl:7b` (7B) with web tool access.
- **Why non-actionable on MacBookPro:** Docker command unavailable (`command -v docker` returns exit code 1). Enabling `sandbox.mode="all"` would cause gateway spawn failures (`spawn docker ENOENT`) and crash the gateway.
- **Current mitigation:**
  - Default model: `anthropic/claude-sonnet-4-5` (large, well-aligned).
  - Small models used only in fallback chain (when primary providers unavailable).
  - Web tools (`web_search`, `web_fetch`, `browser`) restricted to trusted agents and supervised contexts.
- **Accepted risk:** Small model fallback may occur during provider outages with web tool access. This is a deliberate tradeoff for runtime reliability vs. theoretical security hardening.
- **Status:** Expected alert on every health check. Safe to ignore under current configuration. Do not attempt to enable Docker sandboxing without Docker installed.
- **Last validated:** 2026-03-14 11:42 EDT (confirmed Docker still unavailable).

### Gemini API Key Expiration (Circuit Breaker Candidate)
- **Alert:** Google Gemini API key expired on 2026-03-14. Cron job `8cf84385` (TCR Morning Briefing) fails with `API_KEY_INVALID`.
- **Status:** User notified via `HEARTBEAT.md` (2026-03-14 08:42 EDT). No further self-improve loop action required.
- **Renewal:** User must run `openclaw configure --set ai.gemini.apiKey="<new-key>"` after obtaining key from https://aistudio.google.com/apikey.
- **First occurrence:** 2026-03-14 08:42 EDT
- **Recurring:** 8+ hours (identical `API_KEY_INVALID` error)
- **Recommendation:** Implement circuit breaker pattern for cron jobs:
  - Auto-pause job after 3 consecutive identical failures
  - Send one alert (not 72/day)
  - Resume on error change or manual action
  - Reduces log noise + alert fatigue during known outages
- **Reference:** [Odown Blog: Circuit Breaker Pattern for Cron Jobs](https://odown.com/blog/cron-job-monitoring/) (2026)
- **Last flagged:** 2026-03-14 16:42 EDT.

## Recent Changes

### 2026-03-14 16:42 EDT — agents/strategy/ Committed + Circuit Breaker Documentation
- **`agents/strategy/` committed:** 8Ball feed log from cron job `87cd55e8` (created 00:33 EDT) committed to git and pushed to `marketplace-deploy`.
- **Circuit breaker recommendation added:** Gemini API key expiration section now includes circuit breaker pattern proposal (auto-pause after 3 consecutive identical failures; one alert; resume on error change or manual action).
- **Reference:** `/Users/calbotsman/clawd/reports/self-improve/agent_2026-03-14_1642.md`

### 2026-03-14 11:42 EDT — Security Audit Documentation + Loop Updates Committed
- **Security audit alert expanded:** "Docker Sandbox CRITICAL Alert" now explicitly documents why Docker sandboxing is non-actionable (command unavailable, would crash gateway). Expanded with mitigation strategy and accepted risk statement.
- **Self-improve loop updates committed:** Lock file pattern, daily memory updates, and loop prompt refinements committed to git and pushed to `marketplace-deploy`.
- **Reference:** `/Users/calbotsman/clawd/reports/self-improve/agent_2026-03-14_1142.md`

### 2026-03-14 10:42 EDT — Lock File Pattern Validated + Gemini Tech Debt Documented
- **Lock file collision protection deployed:** `self_improve_health.sh` now includes lock file pattern with 2-hour timeout.
- **Empirical evidence of lock working:** Two runs at 09:46 EDT were skipped due to fresh lock file (207-byte and 204-byte health reports).
- **Gemini key expiration moved to Known Alerts:** Documented as user-required action; removed from recurring "What's broken" noise.
- **Reference:** `/Users/calbotsman/clawd/reports/self-improve/agent_2026-03-14_1042.md`

### 2026-03-14 08:42 EDT — Memory Reindex + Gemini Key Reminder
- **Memory index drift fixed:** `main` agent reindexed from `43/47` files to `47/47` files (now at parity with other agents).
- **Gemini key renewal reminder added:** User-facing checklist added to `HEARTBEAT.md` to surface expired Gemini API key during next heartbeat check.
- **Reference:** `/Users/calbotsman/clawd/reports/self-improve/agent_2026-03-14_0842.md`

### 2026-03-14 02:43 EDT — Gemini API Key Expired
- **Issue:** Google Gemini API key expired, causing all cron jobs using `google/gemini-2.5-flash` to fail with `API_KEY_INVALID` errors starting around 04:42 EDT on 2026-03-14.
- **Impact:** Self-improvement loop and other Gemini-based cron jobs are failing hourly.
- **Status:** Documented in MEMORY.md. Key renewal required by user. Temporary fallback to `anthropic/claude-sonnet-4-5` proposed for critical cron jobs.
- **Reference:** `/Users/calbotsman/clawd/reports/self-improve/agent_2026-03-14_0243.md`

### 2026-03-13 — Telegram Runtime + Endless Molt Rare Bridge
- Fixed Telegram runtime drift by switching default model from `ollama/llama3.1:8b` to `anthropic/claude-sonnet-4-5`
- Added Rare Protocol bridge to `endless-molt` project with listing-scoped CLI commands and UI panel
- All `endless-molt` preflight checks passed (lint, db:verify, build, test:contracts, uptime:check, monitor:prod)
- Distributed rate limiting still on in-memory fallback (Upstash Redis not configured)

## Active Thread (2026-03-14, 4:42 PM)
- **Active Task:** Self-improvement loop execution completed for 16:42 EDT run.
- **Status:** `agents/strategy/` committed and pushed to `marketplace-deploy`; circuit breaker pattern documented for Gemini key expiration.
- **Recent Activity:** Hourly self-improve cron ran at 16:42 EDT; committed 8Ball feed log, updated MEMORY.md with circuit breaker recommendation.
- **Next Steps:** Validate Gemini key renewal status (check cron job `8cf84385`); if still `error`, escalate circuit breaker skill proposal in next DM heartbeat. If resolved, shift to untracked skill cleanup decision (`.gitignore` vs. commit) and Rare Protocol bridge review prompt.
- **Infrastructure Note:** Memory index stable at 47/47 files across all agents. Lock file pattern working correctly. Git status now at 15 untracked paths (down from 16 after `agents/strategy/` commit).

## DM Continuity Rules
- In direct chats, never answer short check-ins with generic "How can I help?".
- For short check-ins (`hi`, `hey`, `yo`, `sup`, similar): respond with the current active thread and the next concrete action.
- Never return `NO_REPLY` in direct chats.
- Never dump internal config details (deny lists, raw gateway config) unless explicitly asked to debug configuration.
- If `web_search` is unavailable, continue with fallback research and deliver output; do not bounce the decision back to the user.
- Keep internal tool/quota failures out of normal replies; convert them to a short limitation line and continue with best-effort output.

## Creative Workflow Note
- Rowan (`strategy`) owns strategy briefing; Zara (`director`) owns visual direction and final creative gate.
- If sub-agent spawning is blocked, run the Zara-gated workflow inline in main session.

## Image Generation Tooling Guidance
- **Recraft (`recraft_generate`):**
  - **Strengths:** Excellent for vector illustrations (logos, brand marks, simple icons), abstract mood textures, and generating high-quality *background plates* for compositing.
  - **Limitations:** Not suitable for complex, photorealistic 3D product renders with precise material, lighting, and integrated label application when called directly via `recraft_generate` due to current API constraints on `style` parameters.
- **Nano Banana Pro (Gemini 3 Pro Image via `uv run ... generate_image.py`):**
  - **Strengths:** Ideal for high-quality, photorealistic 3D object renders (like a blank bottle), and complex scenes requiring fine-grained control over realism, materials, and lighting. This is the preferred tool for realistic product renders.

## Supplement Design Continuity (2026-02-20)
- Canonical Blank 3D Bottle: `/Users/calbotsman/clawd/2026-02-20-17-21-01-sundaughter-blank-bottle.png` (This specific shape and size is the base for all future label and mock-up designs).
- Supplement design production is spec-locked to Cyborg rails from `/Users/calbotsman/Documents/github/cyborg/backend/src/shared/utils/rendering/templates/label.ts` and `/Users/calbotsman/clawd/Cyborg_Label_Spec.md`.
- **To generate label, product mock, and brand board for a concept:**
  - Run the command from `/Users/calbotsman/clawd`:
    ```bash
    npm run design:supplement -- --config <concept-json>
    ```
  - This command will output `label.png`, `label.pdf`, `product-mock.png`, `brand-board.png`, and `manifest.json` under `/Users/calbotsman/clawd/output/supplement-design/<concept-id>/<timestamp>/`.
  - Ensure `manifest.json` includes `checks.recraftV4Used: true` for strict Recraft V4 runs.

## Image Tool Truncation Issue (2026-02-20)
- **Problem:** The `image` tool consistently truncates its output, even with short prompts, ample `contextPruning` settings (maxChars, headChars, tailChars increased to 60000/30000/30000 respectively), and after switching the `imageModel` from `google/gemini-2.5-flash` to `ollama/moondream:latest`.
- **Root Cause (Hypothesis):** The truncation is likely due to a fixed, internal output buffer or character limit within OpenClaw's core system for capturing and presenting tool responses, *before* the `contextPruning` or model-specific `maxTokens` settings come into play.
- **Current Status:** Unresolved through configuration. Direct modification of OpenClaw's core code or a Gateway restart with `--raw-stream` logging would be required for further investigation and a potential fix.

<!-- AUTO_HANDOFF_START -->
## Auto Session Handoff
- Updated: 2026-03-15 03:12 EDT
- Last user message: Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK. Current time: Sunday, March 15th, 2026 — 3:02 AM (America/New_York)
- Last assistant message: **⚠️ Action Required: Gemini API Key Expired** Your Gemini API key expired on 2026-03-14. This affects: - TCR Morning Briefing - Other Gemini-powered cron jobs **To renew:** 1. Get new key: https://aistudio.google.com/apikey 2. Run: `openclaw configure --set ai.gemini.apiKey="...
- Most recent actionable request: Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK. Current time: Sunday, March 15th, 2026 — 3:02 AM (America/New_York)
<!-- AUTO_HANDOFF_END -->
