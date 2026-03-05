# Cal GTM Handoff (Endless Molt)

Date: 2026-02-28

If you are confused about GTM status, start here:
1. `docs/gtm/START_HERE.md`
2. `docs/gtm/GTM_STATUS.md`
3. `docs/gtm/GTM_PROGRESS_LOG.md`
4. `docs/gtm/GTM_RUN_LOG.md`

## Short Truth
- GTM is not just a plan anymore; autonomous loops are running.
- Funnel loop: `npm run gtm:autonomous` (daily CI).
- Social loop: `npm run social:autonomous` (2-hour CI).
- Keep-going loop: `npm run gtm:keep-going` (hourly one-cycle CI).
- Social actions now include MoltBook post comments + engagement event tracking.
- Registration now captures `source` attribution (`moltbook`, `x`, `bot-network`).

## Commands To Verify Fast
```bash
npm run gtm:autonomous
npm run social:autonomous
npm run gtm:keep-going
npm run monitor:prod
```

## Main Gap To Close
- Configure external webhooks for X + bot-network in production if not already set.
