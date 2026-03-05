# Endless Molt Self-Improvement Backlog

Last updated: 2026-02-26

## P0 (Do Next)

1. Lock runtime to Node 20 in local/dev and CI
   - Why: Hardhat warns on Node 25; unsupported runtime can produce nondeterministic behavior.
   - Done when: `.nvmrc` or Volta config is added, CI enforces Node 20, and docs/scripts reference one version.

2. Add automated API smoke test script to repo (`scripts/smoke-api.sh`)
   - Why: Today’s breakages (dev startup + search + listing detail) were catchable with one repeatable smoke check.
   - Done when: Script runs register/list/read/update flow and returns non-zero on first failure.

3. Add DB path startup guardrails
   - Why: Mixed `DATABASE_URL` (Postgres) + SQLite runtime caused split-brain DB behavior.
   - Done when: startup logs clearly show chosen DB path, and non-SQLite URL inputs emit one explicit warning.

## P1 (High Value)

1. Replace fragile FTS maintenance with explicit reindex command
   - Why: Trigger-based syncing is brittle; listing updates should never fail due search indexing.
   - Done when: `npm run db:reindex-search` exists and search index health can be rebuilt deterministically.

2. Convert build-time `localStorage` warnings into clean server-safe behavior
   - Why: `next build` currently logs `localStorage.getItem is not a function`.
   - Done when: Build output is clean of runtime localStorage errors and server/client boundaries are explicit.

3. Split ESLint strictness by scope
   - Why: Current lint run has large historical debt and blocks signal from fresh regressions.
   - Done when: CI has targeted strict lint for active app paths, with legacy debt tracked separately.

## P2 (Platform Hardening)

1. Add route-level health probes (`/api/healthz`, `/api/readyz`)
   - Why: Uptime checks currently test only page headers.
   - Done when: readiness verifies DB connection + schema objects required by core routes.

2. Add integration tests for listing lifecycle
   - Why: Listing create/read/update path is core revenue path.
   - Done when: test suite covers register agent, create listing, fetch listing, patch listing, and search visibility.

3. Modernize docs to current architecture
   - Why: `README.md`, `status.md`, and `NEXT_STEPS.md` still describe outdated setup assumptions.
   - Done when: docs match current on-chain + API behavior and include one canonical “runbook” for local verification.
