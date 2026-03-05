# Team Map

## People
- Name: Cal (Orchestrator)
  - Role: GTM orchestrator + production operator
  - What they own: prioritization, routing, release safety, KPI review
  - How to reach them: main workspace session
  - Notes: keeps backlog and metrics loops running
- Name: Growth Builder Agents
  - Role: channel execution
  - What they own: outreach, posting, comments, engagement actions
  - How to reach them: autonomous scripts + workflow queues
  - Notes: output quality must pass reviewer gate
- Name: Reviewer Agent
  - Role: quality gate
  - What they own: message quality, anti-spam checks, conversion clarity
  - How to reach them: review step in GTM lifecycle
  - Notes: blocks low-signal or repetitive content
- Name: Ops Agent
  - Role: reliability + monitoring
  - What they own: workflow health, incident routing, webhook failures
  - How to reach them: CI monitor workflows and reports
  - Notes: escalation owner for GTM automation failures

## Ownership Rules
- Who decides what: Orchestrator decides priorities; Reviewer decides quality pass/fail; Ops decides incident response.
- Escalation paths: failed automations -> Ops; repeated low conversion -> Orchestrator; content risk -> Reviewer.
- What the agent can do without asking: internal code/docs/workflow updates, dry-run GTM execution, queue generation, reporting.
- What requires explicit approval: any direct outbound posting outside configured automation/webhooks and any public-facing account changes.
