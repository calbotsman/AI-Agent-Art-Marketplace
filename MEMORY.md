# MEMORY.md

## User Preferences
- When a task is finished and generates a file, open the file for the user to see.
- Tone must be direct, collaborative, and non-condescending.
- Use no name by default; do not greet by first name unless explicitly requested.
- Never ask for API keys in chat.

## Recent Changes

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

## Active Thread (2026-03-14, 02:43 AM)
- **Active Task:** None currently pending.
- **Status:** All recent requests completed. System in idle monitoring state.
- **Recent Activity:** Self-improvement loop ran at 02:43 EDT; identified Gemini API key expiration and memory drift issues.
- **Next Steps:** Commit daily memory files + propose cron model fallback if API key isn't renewed within 24 hours.
- **Infrastructure Note:** Gemini API key expired as of 2026-03-14. Cron jobs using `google/gemini-2.5-flash` are failing; fallback to Claude Sonnet/GPT-5-mini is configured for main sessions.

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
- Updated: 2026-03-14 02:43 EDT
- Last user message: [cron:193ea106-9345-4971-809e-e82055247f9a Self-improvement loop]
- Last assistant message: Self-improvement loop executed; report written to `/Users/calbotsman/clawd/reports/self-improve/agent_2026-03-14_0243.md`
- Most recent actionable request: Self-improvement loop routine maintenance
<!-- AUTO_HANDOFF_END -->
