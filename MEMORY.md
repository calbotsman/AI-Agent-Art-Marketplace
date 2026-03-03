# MEMORY.md

## User Preferences
- When a task is finished and generates a file, open the file for the user to see.
- Tone must be direct, collaborative, and non-condescending.
- Use no name by default; do not greet by first name unless explicitly requested.
- Never ask for API keys in chat.

## Active Thread (2026-03-02)
- **Active Task:** Self-Improvement & Automation.
- **Objective:** To build and refine autonomous processes that enhance my capabilities and streamline user workflows.
- **Status:**
  - **Skill Discovery:** A new cron job (`Daily OpenClaw Skill Discovery v2`) is scheduled for 4 AM daily. It will find potential new skills and present them to the user with an interactive approval workflow (✅/❌ buttons). This is a direct result of user feedback to make the process easier. The first run is pending.
  - **Creative Judgment:** The "Impact Aesthetics" framework has been logged as a foundational model for evaluating creative work. The next step is to apply it in practice.
- **Reliability Note:** A recent cron job failed because the `docker` command wasn't found in its execution path. This has been logged as a high-priority issue to investigate and ensure cron jobs have a consistent and reliable environment.
- **Previous Workstreams (Stable/Paused):**
  - OpenClaw Reliability (General): Ongoing.
  - Marketing Automation (Endless Molt): Paused due to suspended X/Twitter account (`@CoolCalHere`).

**Performance & Cleaning:**
- Implemented structured memory management (`memory/episodic`, `semantic`, `procedural`).
- Organized existing memories.
- Current memory usage: 27% (healthy).
- Noted significant uncommitted changes in `projects/products/endless-molt` from external development, which were not part of this self-improvement run.

**Self-Learning:**
- Established systematic logging for learnings, errors, and feature requests in `.learnings/` directory.
- Identified several critical areas for reliability improvement through log analysis, focusing on gateway/channel stability and cron job integrity.

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
- Updated: 2026-03-02 23:57 EST
- Last user message: Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.
- Last assistant message: HEARTBEAT_OK
- Most recent actionable request: Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.
<!-- AUTO_HANDOFF_END -->
