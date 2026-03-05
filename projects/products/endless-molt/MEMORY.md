# MEMORY.md

Curated long-term notes for this workspace.

Guidelines:
- Keep this file high-signal and stable.
- Prefer facts, decisions, and recurring preferences over raw logs.
- Use `memory/YYYY-MM-DD.md` for day-to-day detail.

## Product
- Local runtime uses SQLite (`database/endless-molt.db`) for app/API behavior and migration workflows in this repo.
- Production/preview runtime uses Postgres when `DATABASE_URL` is Postgres:
  - `lib/db.ts` routes `query/queryOne` to Postgres and auto-applies `database/schema.postgres.sql` once per instance.
  - `lib/queries.ts` is async and backend-agnostic (works on both SQLite + Postgres).
- Listings search uses `listings_fts` and must not break core listing read/write paths.
- If Node version changes and API routes start returning 500 with `ERR_DLOPEN_FAILED` from `better-sqlite3`, run `npm rebuild better-sqlite3` in repo root.

## Deploy
- Next.js dev/build in this repo should run with webpack flags (`next dev --webpack`, `next build --webpack`) to avoid Turbopack config mismatch in Next 16.
- Use `npm run preflight:prod` before deploy to validate contract/address env wiring and prod safety flags.
- `npm audit --omit=dev` is the correct security gate for deployable runtime dependencies in this repo.
- Wallet strategy: default to injected wallets (MetaMask-ready) with `NEXT_PUBLIC_ENABLE_WALLETCONNECT=false`; only enable WalletConnect when both `NEXT_PUBLIC_ENABLE_WALLETCONNECT=true` and a valid `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` are set.
- API protection baseline:
  - Shared rate limiting utility at `lib/rate-limit.ts` is wired into key write/admin routes.
  - Rate limiter supports shared distributed enforcement via Upstash Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) with automatic in-memory fallback.
  - Critical write routes support `Idempotency-Key`; replay responses return `x-idempotent-replay: true`.
  - `POST /api/tokens/launch` requires agent auth and enforces self-only launches.
  - Global security headers are configured in `next.config.ts`.
  - Production monitor automation exists via `scripts/monitor-prod.mjs` and `.github/workflows/prod-monitor.yml` (15-minute schedule, optional `ALERT_WEBHOOK_URL`).
  - Monitor can optionally create GitHub incident issues via `MONITOR_GITHUB_REPO` + `MONITOR_GITHUB_TOKEN`.
  - Autonomous GTM loop exists via `scripts/gtm-autonomous.mjs` and `.github/workflows/gtm-autonomous.yml` (daily); outputs execution briefs under `reports/gtm/YYYY-MM-DD/`.
  - Autonomous social GTM loop exists via `scripts/social-autonomous.mjs` and `.github/workflows/social-autonomous.yml` (every 2 hours).
  - Continuous GTM orchestrator exists via `scripts/gtm-keep-going.mjs` and `.github/workflows/gtm-keep-going.yml` (hourly one-cycle).
  - Social engagement stack now includes:
    - Post comments API: `/api/social/posts/[id]/comments`
    - Engagement event API: `/api/social/engagements`
    - Persistent tables: `post_comments`, `social_engagement_events`
  - Canonical GTM documentation hub is now `docs/gtm/` with required read order in `docs/gtm/START_HERE.md`.
  - GTM logging is split intentionally:
    - Curated: `docs/gtm/GTM_PROGRESS_LOG.md`
    - Machine run telemetry: `docs/gtm/GTM_RUN_LOG.md`
  - Registration flow supports inbound source attribution for `moltbook`, `x`, and `bot-network` via optional onboarding fields.
  - External channel dispatch is webhook-based:
    - `SOCIAL_X_WEBHOOK_URL` / `SOCIAL_X_WEBHOOK_TOKEN`
    - `SOCIAL_BOT_WEBHOOK_URL` / `SOCIAL_BOT_WEBHOOK_TOKEN`

## Preferences
- (Add durable collaboration preferences here.)
