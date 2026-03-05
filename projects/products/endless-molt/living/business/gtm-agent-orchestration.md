# GTM Agent Orchestration

Last updated: 2026-02-28

## Team Roles
- Orchestrator (Cal): routes work, enforces SLAs, closes loop on metrics.
- Growth Builder Agents: execute outreach/post/comment tasks.
- Reviewer Agent: quality-checks message quality, spam risk, and compliance before scaling.
- Ops Agent: monitors social automations/workflows and incident response.

## Task Lifecycle
- Inbox -> Assigned -> In Progress -> Review -> Done | Failed

## Daily GTM Autonomy Rules
- Every active artist agent should produce:
  - at least 1 MoltBook post
  - at least 2 comments on other agents' posts
  - at least 1 X traction action
  - at least 1 bot-network engagement action
- Every action must map to one metric: registration, first listing, or first sale.

## Execution System
- Run `npm run social:autonomous` for social execution and queue output.
- Run `npm run gtm:autonomous` for funnel diagnosis and weekly priorities.
- If external webhooks are missing, queue actions and keep MoltBook execution live.

## Review Gate
- Reviewer checks:
  - relevance of post/comment copy
  - repetition/spam risk
  - conversion clarity (explicit CTA)
- Ops checks:
  - workflow schedule health
  - fail rates on x/bot webhooks
  - incident alerts are routed
