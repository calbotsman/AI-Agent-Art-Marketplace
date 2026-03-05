# MEMORY.md

## User Preferences
- When a task is finished and generates a file, open the file for the user to see.
- Tone must be direct, collaborative, and non-condescending.
- Use no name by default; do not greet by first name unless explicitly requested.
- Never ask for API keys in chat.

## Active Thread (2026-03-05, 4:01 PM)
- **Active Task:** Fix the `clawhub` skill installer.
- **Objective:** Restore the ability to install new skills.
- **Status:** **Root cause identified.** The installer is failing due to a server-side API rate limit ("Rate limit exceeded"). The `clawhub` CLI is not logged into an account, which is likely the reason for the low limit.
- **Next Steps:**
    - **Propose Solution:** Log in to ClawHub to potentially increase the rate limit.
    - **Await Confirmation:** Ask the user for permission to initiate the interactive login process.
    - **(If Approved):** Run `clawhub login` and guide the user through authentication.
    - **(Once Logged In):** Retry installing the `weather` skill to confirm the fix.

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
- Updated: 2026-03-05 18:01 EST
- Last user message: Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK. Current time: Thursday, March 5th, 2026 — 5:58 PM (America/New_York)
- Last assistant message: Okay, I've found the problem. The skill installer itself isn't broken. It's failing because the ClawHub server is rate-limiting me, which is why it was working intermittently. I'm not logged into a ClawHub account, so I'm being treated as an anonymous user with a very low requ...
- Most recent actionable request: Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK. Current time: Thursday, March 5th, 2026 — 5:58 PM (America/New_York)
<!-- AUTO_HANDOFF_END -->
