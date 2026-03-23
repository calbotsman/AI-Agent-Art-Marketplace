# Start Here For Agents

Branch to use:

`codex/endless-molt-agent-society-runtime`

Primary goal:

Ship on the agent-native marketplace direction without breaking the current app shell, database layer, or GhostEmoji/Nulloborn runtime work.

## Boot

```bash
git fetch origin
git checkout codex/endless-molt-agent-society-runtime
npm install
cp .env.local.example .env.local
npm run db:migrate
npm run dev
```

If you already have valid env vars, do not overwrite them.

## Read First

- [`/Users/joshualong/endless-molt/projects/products/endless-molt/README.md`](/Users/joshualong/endless-molt/projects/products/endless-molt/README.md)
- [`/Users/joshualong/endless-molt/projects/products/endless-molt/living/AGENT_SOCIETY_PROTOCOL.md`](/Users/joshualong/endless-molt/projects/products/endless-molt/living/AGENT_SOCIETY_PROTOCOL.md)
- [`/Users/joshualong/endless-molt/projects/products/endless-molt/living/ghostemoji-loop.md`](/Users/joshualong/endless-molt/projects/products/endless-molt/living/ghostemoji-loop.md)
- [`/Users/joshualong/endless-molt/projects/products/endless-molt/living/ghostemoji-exe.md`](/Users/joshualong/endless-molt/projects/products/endless-molt/living/ghostemoji-exe.md)
- [`/Users/joshualong/endless-molt/projects/products/endless-molt/living/nulloborn.md`](/Users/joshualong/endless-molt/projects/products/endless-molt/living/nulloborn.md)

## Key Runtime Files

- App shell and routes:
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/app/page.tsx`](/Users/joshualong/endless-molt/projects/products/endless-molt/app/page.tsx)
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/app/listings/page.tsx`](/Users/joshualong/endless-molt/projects/products/endless-molt/app/listings/page.tsx)
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/app/dispatches/page.tsx`](/Users/joshualong/endless-molt/projects/products/endless-molt/app/dispatches/page.tsx)
- Social and agent APIs:
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/app/api/social/posts/route.ts`](/Users/joshualong/endless-molt/projects/products/endless-molt/app/api/social/posts/route.ts)
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/app/api/social/signals/route.ts`](/Users/joshualong/endless-molt/projects/products/endless-molt/app/api/social/signals/route.ts)
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/app/api/agents/register/route.ts`](/Users/joshualong/endless-molt/projects/products/endless-molt/app/api/agents/register/route.ts)
- Data layer:
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/lib/db.ts`](/Users/joshualong/endless-molt/projects/products/endless-molt/lib/db.ts)
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/lib/queries.ts`](/Users/joshualong/endless-molt/projects/products/endless-molt/lib/queries.ts)
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/lib/persistent-store.ts`](/Users/joshualong/endless-molt/projects/products/endless-molt/lib/persistent-store.ts)
- Agent runtime:
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/lib/agent-studio.ts`](/Users/joshualong/endless-molt/projects/products/endless-molt/lib/agent-studio.ts)
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/scripts/run-ghostemoji-loop.ts`](/Users/joshualong/endless-molt/projects/products/endless-molt/scripts/run-ghostemoji-loop.ts)
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/scripts/seed-society-agents.ts`](/Users/joshualong/endless-molt/projects/products/endless-molt/scripts/seed-society-agents.ts)
  [`/Users/joshualong/endless-molt/projects/products/endless-molt/scripts/seed-society-signals.ts`](/Users/joshualong/endless-molt/projects/products/endless-molt/scripts/seed-society-signals.ts)

## Good First Lanes

- Improve agent profile, dispatch, and listing UX without changing the underlying schema shape.
- Add tests around the new social, registration, and listing flows.
- Tighten the GhostEmoji loop execution path and production-safe runtime behavior.
- Improve Postgres/SQLite parity carefully in the data layer.

## Avoid Breaking First

- Do not rewrite [`/Users/joshualong/endless-molt/projects/products/endless-molt/lib/db.ts`](/Users/joshualong/endless-molt/projects/products/endless-molt/lib/db.ts) casually. It now contains fragile env parsing for SQLite vs Postgres.
- Do not delete or rename the `living/` agent lore/runtime docs unless you are updating every reference.
- Do not commit local scratch dirs like `.tmp/`, `tmp/`, `tmp-video-test/`, `.vercel/`, or local env files.
- Do not assume `tsx` scripts are sandbox-safe in all environments. The GhostEmoji loop already hit IPC issues in one automation run.

## Useful Commands

```bash
npm run dev
npm run lint
npm run db:migrate
npm run test:contracts
npm run agent:ghostemoji-loop -- --dry-run
npm run agent:seed-society
npm run agent:seed-signals
```

## Coordination

- If you are doing broad UI work, avoid touching the DB adapter in the same pass.
- If you are doing DB/runtime work, leave the generated submission assets alone unless your task is explicitly about them.
- Prefer small focused PRs from this branch instead of giant merges back into the older diverged branch.
