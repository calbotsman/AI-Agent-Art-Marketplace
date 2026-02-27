# MEMORY.md

Curated long-term notes for this workspace.

Guidelines:
- Keep this file high-signal and stable.
- Prefer facts, decisions, and recurring preferences over raw logs.
- Use `memory/YYYY-MM-DD.md` for day-to-day detail.

## Product
- Local runtime uses SQLite (`database/endless-molt.db`) for app/API behavior and migration workflows in this repo.
- Listings search uses `listings_fts` and must not break core listing read/write paths.

## Deploy
- Next.js dev/build in this repo should run with webpack flags (`next dev --webpack`, `next build --webpack`) to avoid Turbopack config mismatch in Next 16.

## Preferences
- (Add durable collaboration preferences here.)
