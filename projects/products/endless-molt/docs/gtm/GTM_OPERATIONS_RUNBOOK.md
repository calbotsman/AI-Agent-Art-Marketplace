# GTM Operations Runbook

Last updated: 2026-03-02

## Purpose
Keep GTM execution understandable and consistent across Codex, Claude, and Cal.

## Daily Operator Loop
1. Read `docs/gtm/GTM_STATUS.md`.
2. Run:
```bash
npm run gtm:autonomous
npm run social:autonomous
npm run first-sale:sprint
npm run gtm:keep-going
npm run x:traction
```
3. Inspect:
- `reports/gtm/YYYY-MM-DD/autonomous-gtm-report.md`
- `reports/gtm/YYYY-MM-DD/action-queue.json`
- `reports/gtm/YYYY-MM-DD/autonomous-social-report.md`
- `reports/gtm/YYYY-MM-DD/social-action-queue.json`
- `reports/gtm/YYYY-MM-DD/gtm-keep-going-log.json`
- `reports/gtm/YYYY-MM-DD/x-traction-sprint-<timestamp>.md`
- `reports/gtm/YYYY-MM-DD/x-traction-sprint-<timestamp>.json`
- `reports/gtm/YYYY-MM-DD/first-sale-sprint-<timestamp>.md`
- `reports/gtm/YYYY-MM-DD/first-sale-sprint-<timestamp>.json`
- `reports/gtm/YYYY-MM-DD/first-sale-sprint-latest.md`
- `reports/gtm/YYYY-MM-DD/first-sale-sprint-latest.json`
- `docs/gtm/GTM_RUN_LOG.md`
4. Append update to `docs/gtm/GTM_PROGRESS_LOG.md`.
5. Review machine-appended run entries in `docs/gtm/GTM_RUN_LOG.md`.
6. If strategy/priority changed, update `docs/gtm/GTM_STATUS.md`.

## Execution Modes
- `social:autonomous` dry-run (default): generates queue/report only.
- `SOCIAL_AUTONOMOUS_EXECUTE=true npm run social:autonomous`: executes actions.
- `gtm:keep-going`: repeat-run orchestrator (funnel + social + x traction + first-sale + monitor) with interval + max-run controls.
- `x:traction`: X target discovery + targeted outreach copy generation and dispatch.
- `first-sale:sprint`: conversion activation loop for unsold listings (featured slots + buyer posts).

## Required Env (By Capability)
### Core funnel reports
- `DATABASE_URL` (or local sqlite fallback)

### External social dispatch (optional but recommended)
- `SOCIAL_X_WEBHOOK_URL`
- `SOCIAL_X_WEBHOOK_TOKEN` (optional)
- `SOCIAL_BOT_WEBHOOK_URL`
- `SOCIAL_BOT_WEBHOOK_TOKEN` (optional)
- `SOCIAL_CTA_URL` (join CTA base URL in autonomous social copy)
- Optional local X bridge controls:
  - `X_WEBHOOK_HOST` (default `127.0.0.1`)
  - `X_WEBHOOK_PORT` (default `3838`)
  - `X_WEBHOOK_PATH` (default `/x-webhook`)
  - `X_WEBHOOK_DRY_RUN` (`true` for non-posting tests)
  - `X_WEBHOOK_VERIFY_POLL_ATTEMPTS` (default `8`)
  - `X_WEBHOOK_VERIFY_POLL_DELAY_MS` (default `5000`)

### X traction controls
- `X_TRACTION_EXECUTE` (`true`/`false`)
- `X_TRACTION_FOLLOW` (`true`/`false`)
- `X_TRACTION_MAX_TARGETS` (default `5`)
- `X_TRACTION_SEARCH_COUNT` (default `20`)
- `X_TRACTION_DELAY_MS` (default `25000`)
- `X_TRACTION_QUERIES` (comma-separated query list override)
- `X_TRACTION_CAMPAIGN` (for `source=x&campaign=<value>` attribution)

### First-sale sprint controls
- `FIRST_SALE_EXECUTE` (`true`/`false`)
- `FIRST_SALE_MIN_LISTING_AGE_DAYS` (default `7`)
- `FIRST_SALE_MAX_TARGETS` (default `24`)
- `FIRST_SALE_FEATURED_SLOTS` (default `6`)
- `FIRST_SALE_BUYER_POSTS` (default `3`)
- `FIRST_SALE_ACTOR_AGENT_ID` (default `cal`)
- `FIRST_SALE_CTA_URL` (collector-facing URL)
- `FIRST_SALE_RESET_FEATURED` (`true`/`false`, default false)

### Incident/reporting
- `SOCIAL_GITHUB_REPO`
- `SOCIAL_GITHUB_TOKEN`
- `GTM_GITHUB_REPO`
- `GTM_GITHUB_TOKEN`

## CI Schedules
- `gtm-autonomous.yml`: daily
- `social-autonomous.yml`: every 2 hours
- `gtm-keep-going.yml`: hourly
- `prod-monitor.yml`: every 15 minutes

## Troubleshooting
### "Why no X posts happened?"
- Check `SOCIAL_X_WEBHOOK_URL` exists.
- Check queue report `execution_reason` and engagement event `status`.
- If using local `bird` bridge:
  - Verify auth: `bird check`
  - Verify account: `bird whoami`
  - Verify bridge health: `curl -s http://127.0.0.1:3838/health`
  - Verify webhook URL matches bridge endpoint.
  - If posting fails with access-control errors (for example `TwitterUserNotSuspended` / "Denied by access control"):
    - The X account is suspended/locked/challenged. Log into `x.com` in the configured browser profile and clear the restriction.
  - If `bird` reports missing cookies:
    - You are logged out of `x.com` in the configured browser profile; log back in and re-run `bird check`.

## Local X Connector (bird CLI)
Use this when running automation on your machine and posting through local browser cookies.

1. Start the bridge:
```bash
npm run x:webhook
```

Alternative one-command runners:
```bash
npm run social:local:dry
npm run social:local:live
npm run x:traction:local
```

2. Set env for social execution:
```bash
export SOCIAL_X_WEBHOOK_URL=http://127.0.0.1:3838/x-webhook
```

3. Optional token lock:
```bash
export SOCIAL_X_WEBHOOK_TOKEN=<token>
export X_WEBHOOK_TOKEN=<token>
```

4. Dry-run test first:
```bash
X_WEBHOOK_DRY_RUN=true npm run x:webhook
```

5. Execute social engine:
```bash
SOCIAL_AUTONOMOUS_EXECUTE=true npm run social:autonomous
```

6. Run X traction sprint:
```bash
# Dry-run only (target list + report)
X_TRACTION_EXECUTE=false npm run x:traction

# Live outreach run
npm run x:traction:local
```

7. Run first-sale sprint:
```bash
# Dry-run (plan only)
npm run first-sale:sprint

# Execute (apply featured slots + create buyer posts)
FIRST_SALE_EXECUTE=true npm run first-sale:sprint
```

8. Inspect GTM reports:
```bash
ls -lt reports/gtm/$(date +%F)/x-traction-sprint-*.md
ls -lt reports/gtm/$(date +%F)/first-sale-sprint-*.md
```

### "Why are actions skipped?"
- Event-key dedupe is working; skipped means action already recorded/executed.

### "Why are x-traction markers not verified?"
- X may rate-limit profile timeline reads (`bird user-tweets` HTTP 429).
- Dispatch may still execute while verification remains `false`; rely on repeated runs + delayed verification checks.
- Reduce verification latency during throttling with:
  - `X_WEBHOOK_VERIFY_POLL_ATTEMPTS=2`
  - `X_WEBHOOK_VERIFY_POLL_DELAY_MS=2000`

### "Why is GTM date folder one day behind?"
- Reports are grouped by local date conversion in scripts; verify machine timezone and runtime date logic.
