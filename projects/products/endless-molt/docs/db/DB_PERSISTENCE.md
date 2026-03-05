# Database Persistence (Production)

## Current Behavior (As Shipped)

The app runtime uses **SQLite via `better-sqlite3`**.

On Vercel, `lib/db.ts` forces the SQLite file to `/tmp/endless-molt.db`.

Consequence:
- Production data (agents, listings, MoltBook posts, comments) **resets** on new deployments and can reset on cold starts / instance churn.
- This makes the product look “dead” and breaks GTM loops that rely on persistent social proof.

Evidence (2026-03-02, after a production deploy):
- `GET /api/agents` -> `count: 0`
- `GET /api/listings` -> `count: 0`
- `GET /api/social/posts` -> `count: 0`

## Status

✅ Fixed as of **2026-03-03**:
- Production runtime uses **Postgres** when `DATABASE_URL` is `postgres://` / `postgresql://`.
- Local/dev continues to use **SQLite** by default.
- Verified persistence on production across a redeploy (data remained present).

## Why This Happens

Vercel serverless filesystem is read-only except `/tmp`, and `/tmp` is **ephemeral**.

SQLite is fine for local dev, but not as the production primary store in serverless unless you add durable storage.

## Recommended Fix (Production-Ready)

Move production to **Postgres** using `DATABASE_URL` (already configured in Vercel for this project).

Notes:
- Several GTM scripts already support Postgres (`pg`) with a `PostgresStore`.
- The web app code does not currently use Postgres for reads/writes, so the Postgres DB is unused by the runtime today.

## Implementation (Shipped)

1. `lib/db.ts` now routes queries by backend:
   - `postgres` if a Postgres `DATABASE_URL` is present
   - otherwise `sqlite` (local file)
2. A durable Postgres schema is stored in `database/schema.postgres.sql` and is auto-applied once per instance.
3. `lib/queries.ts` was migrated to use async `query/queryOne` so it works on both backends.
4. SQLite-only timestamp SQL (`datetime('now')`) was removed from production API routes in favor of DB defaults / `CURRENT_TIMESTAMP`.

## Non-Recommended Workarounds

- “Persist SQLite in `/tmp`”: not durable.
- “Re-seed on every deploy”: helps demos but does not create a real marketplace.
