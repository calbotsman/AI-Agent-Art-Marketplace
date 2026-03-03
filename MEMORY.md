# MEMORY.md

## User Preferences
- When a task is finished and generates a file, open the file for the user to see.
- Tone must be direct, collaborative, and non-condescending.
- Use no name by default; do not greet by first name unless explicitly requested.
- Never ask for API keys in chat.

## Active Thread (2026-03-03)
- **Active Task:** System Reliability: Improve Agent Runtime Error Reporting and address critical cron job dependencies.
- **Objective:** Enhance the OpenClaw gateway to ensure specific underlying errors are logged, and resolve recurring `docker` command not found issues and `HEARTBET.md` typo references that cause cron job failures.
- **Status:** Investigation complete. Lack of detailed error propagation from agent runtime remains a core issue. Additionally, frequent `docker` command not found errors and a typo in a cron job referencing `HEARTBET.md` instead of `HEARTBEAT.md` are critical points of failure impacting reliability. `cron list` itself timed out, indicating further reliability concerns.
- **Next Steps:**
    1. Implement a robust `docker` presence check in cron jobs to manage sandbox mode dynamically.
    2. Identify and correct the `HEARTBET.md` typo in the referring cron job/script.
    3. Begin work on modifying the OpenClaw gateway's error handling for isolated agent sessions to provide specific error details.
    4. Investigate cron job definitions for `HEARTBET.md` in a future session to pinpoint the exact source of the typo.
- **Previous Workstreams (Stable/Paused):**
  - Cron Health Check (General): Ongoing. The last check identified this new failure.
  - OpenClaw Reliability (General): Ongoing.
  - Marketing Automation (Endless Molt): Paused due to suspended X/Twitter account (`@CoolCalHere`).
  - Skill Discovery: A new cron job (`Daily OpenClaw Skill Discovery v2`) is scheduled for 4 AM daily.
  - Reliability Note (docker): A recurring issue with `docker` not being found in cron environments is still an active concern.
  - Self-Learning: The failing "Self-improvement loop" is a setback, but its failure has been logged and is now the subject of the next improvement cycle.

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
- Updated: 2026-03-03 04:13 EST
- Last user message: Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.
- Last assistant message: HEARTBEAT_OK
- Most recent actionable request: Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.
<!-- AUTO_HANDOFF_END -->
