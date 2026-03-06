# Secret Rotation Checklist (Post-Incident)

Last updated: 2026-03-05

## Why This Exists

If any secrets were ever committed to a public git repository (even briefly), assume compromise.
History rewrites reduce exposure but do not guarantee the secrets were not copied.

This checklist is a fast, repeatable rotation playbook for Endless Molt.

## Rotate Immediately (P0)

### Database (Postgres)
- Rotate the Postgres user/password used by production and CI.
- Update all consumers:
  - Vercel/production env `DATABASE_URL`
  - GitHub Actions repo secret `GTM_DATABASE_URL` (used as `DATABASE_URL` in workflows)
  - Local `.env.local` (if you keep prod DB creds locally)
- Disable or delete the old DB user/credential.

### Auth (NextAuth)
- Rotate `NEXTAUTH_SECRET`.
- Expect side effect: existing sessions/tokens become invalid (users will need to sign in again).

### Web3 / Wallet Keys
- If any private key was ever exposed (deployer, minting, treasury), assume funds are at risk.
- Move funds to a new wallet and rotate:
  - private key
  - any related RPC allowlists, automation configs, and server env vars

### Payments (Stripe)
- Rotate Stripe secret keys if they were ever exposed.
- Confirm webhook signing secret rotation (if webhooks are used).

### Infrastructure / Hosting
- Rotate any hosting/deploy tokens (Vercel tokens, service account keys, etc.) if they were exposed.
- Revoke old tokens.

### External Providers
- Rotate any third-party API keys:
  - RPC provider (Alchemy/Infura/QuickNode/etc.)
  - Upstash tokens
  - analytics keys (if secret)
  - any internal webhooks that trust a bearer token

## Validate After Rotation

### CI (GitHub Actions)
- Confirm these workflows can still connect and run:
  - `Autonomous GTM`
  - `Autonomous Social GTM`
  - `GTM Keep Going`
  - `Production Monitor`

### Production
- Confirm app boots and core endpoints succeed:
  - `/`
  - `/listings`
  - `/moltbook`
  - `/api/listings`
  - `/api/search?q=health`

## Guardrails (Prevent Repeat)

### Repo hygiene
- Keep `.openclaw/`, `ledger/raw/`, `ledger/observations/`, and any auth profile dumps untracked/ignored.
- Avoid committing `.env*` files.

### Detection
- Use GitHub push protection and secret scanning (already helpful).
- Add an optional local preflight step before pushes:
  - run a secret scanner (ex: gitleaks) or at minimum `git diff` review for `DATABASE_URL`, `PRIVATE_KEY`, `NEXTAUTH_SECRET`, etc.

