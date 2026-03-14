# Runner message (used by cron)

1) Reliability guard for this host:
- Check Docker availability using `command -v docker` (NOT `docker info`).
  - If `docker` is unavailable, do not run any `docker …` commands (avoid noisy `command not found: docker` tool errors).
  - Do not set `agents.defaults.sandbox.mode=all`.
- Keep `agents.defaults.sandbox.mode=off` to avoid `spawn docker ENOENT` gateway crashes.
- Current Docker status will be logged in the agent report.

2) Run the health script:
`bash /Users/calbotsman/clawd/loops/self_improve_health.sh`

3) Read `/Users/calbotsman/clawd/loops/self_improve_agent_prompt.md` and follow it strictly.

4) If you make changes in git, include:
- `git diff`
- and the command outputs for any tests you ran.
- **Crucially, include the `manifest.json` path from supplement design outputs. Confirm `checks.recraftV4Used: true` for strict Recraft V4 runs.**