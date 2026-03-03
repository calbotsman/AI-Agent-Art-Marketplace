# Runner message (used by cron)

1) Reliability guard for this host:
- If `docker` is unavailable, do not set `agents.defaults.sandbox.mode=all`.
- Keep `agents.defaults.sandbox.mode=off` to avoid `spawn docker ENOENT` gateway crashes.

2) Run the health script:
`bash /Users/calbotsman/clawd/loops/self_improve_health.sh`

3) Read `/Users/calbotsman/clawd/loops/self_improve_agent_prompt.md` and follow it strictly.

4) If you make changes in git, include:
- `git diff`
- and the command outputs for any tests you ran.
