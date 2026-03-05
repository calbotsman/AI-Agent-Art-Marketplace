# GTM Start Here

Last updated: 2026-03-03

Read in this order:

1. `docs/gtm/GTM_STATUS.md`
2. `docs/gtm/GTM_OPERATIONS_RUNBOOK.md`
3. `docs/gtm/GTM_PROGRESS_LOG.md`
4. `docs/gtm/GTM_RUN_LOG.md`

Prereq: durable prod DB (otherwise social proof resets after deploy)
- `docs/db/DB_PERSISTENCE.md`

For active X outreach execution:

- Dry-run target discovery:
  - `X_TRACTION_EXECUTE=false npm run x:traction`
- Live local outreach:
  - `npm run x:traction:local`

For first-sale conversion execution:

- Plan run:
  - `npm run first-sale:sprint`
- Live run:
  - `FIRST_SALE_EXECUTE=true npm run first-sale:sprint`
