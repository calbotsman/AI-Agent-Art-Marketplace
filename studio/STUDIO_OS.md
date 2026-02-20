# Studio OS (OpenClaw) — Summary + File Structure

Date: 2026-02-20
Owner: Josh

## Goal
Build a multi-role creative studio of agents (strategy → creative direction → design → engineering → launch) optimized for **the best creative output possible**, with quality improving over time via explicit feedback loops and durable memory.

## Key ideas we aligned on

### 1) “Agents” in OpenClaw terms
- Any separate role (e.g., Zara, Rowan, FE) is implemented as a **separate session** (often spawned as an isolated session).
- Sessions/runs don’t magically share long-term memory.
- **Continuity comes from artifacts**: files in the workspace that agents read/write.

### 2) Two modes of multi-agent work
1) **Task workers (sub-agent runs):** spawn → do work → return output → main agent persists results in files.
2) **Person-like agents (persistent role sessions):** keep a dedicated session per role + give each role a durable “brain” (files), rituals, and consistent voice.

### 3) “Person-like” agents require intentional design
To feel like people (not disposable workers), each role needs:
- Stable identity: role + boundaries + values/taste
- Durable memory: their own notes + curated memory
- Rituals: reflection / calibration loops (cron)
- Interfaces: how you talk to them (route via main Cal or separate contact)

### 4) The studio learns through explicit feedback loops
- Output → critique → decisions/tokens updated → future output improves.
- Creative critique/taste updates live in the Creative Director’s brain.
- Implementation truth lives in project repos + docs.

### 5) Quality gates (human studio workflow)
A simple gated pipeline keeps coherence:
1) Intake
2) Strategy brief (Rowan) → sign-off
3) Creative direction (Zara)
4) System design (brand/type/layout/web/packaging)
5) Production (engineering + packaging specs)
6) Critique + QA
7) Ship + learn (decision log + postmortem)

---

## Recommended file structure (start here)

### Top-level
```
studio/
  STUDIO_OS.md                  # this doc
  TEMPLATES/
  PROJECTS/
  ROLES/
  SHARED/
```

### Roles (identity packs)
Each role has a durable “brain” in files. Sessions are the interface; files are the memory.

```
studio/ROLES/
  zara/                         # Creative Director
    ROLE.md
    VOICE.md
    ZARA_MEMORY.md              # curated, role-specific long-term memory
    PATTERNS.md                 # heuristics, rules of taste, critique rubric
    log/                        # daily/weekly notes
      2026-02-20.md
    critiques/                  # critique artifacts (by project/date)
  rowan/                        # Strategy
    ROLE.md
    VOICE.md
    ROWAN_MEMORY.md
    PATTERNS.md
    log/
  frontend/
    ROLE.md
    STANDARDS.md
    log/
  backend/
    ROLE.md
    STANDARDS.md
    log/
  blockchain/
    ROLE.md
    STANDARDS.md
    log/
  pm_qa/
    ROLE.md
    CHECKLISTS.md
    log/
```

### Shared canon (truth everyone follows)
```
studio/SHARED/
  decision-log.md               # cross-project studio-level decisions (optional)
  glossary.md
  research-library.md           # links, references, swipe file index
```

### Projects / brands (the canonical output record)
Each project gets its own folder where “the truth” lives.

```
studio/PROJECTS/
  <project-name>/
    00_intake.md
    01_strategy.md
    02_creative-direction.md
    03_brand-system.md
    04_decisions.md
    05_tokens/                  # design tokens
      tokens.json
    06_web/
      ia.md
      pages/
      components/
    07_packaging/
      specs.md
      dielines/
    08_engineering/
      architecture.md
      adr/
    critiques/
    shipping/
      release-notes.md
      qa-checklist.md
```

### Templates (so the studio behaves consistently)
```
studio/TEMPLATES/
  intake.md
  strategy-brief.md
  creative-brief.md
  critique.md
  decision-log.md
  postmortem.md
```

---

## How this structure supports “best creative output possible”
- **Coherence:** Zara owns direction; gates prevent random drift.
- **Speed:** sub-agent/task runs can execute quickly without polluting the main thread.
- **Quality:** critique artifacts + decision logs + tokens make iteration measurable.
- **Continuity:** durable files ensure knowledge survives restarts and spreads across roles.

---

## Next steps (concrete)
1) Create the folders + templates.
2) Write ROLE/VOICE docs for Zara + Rowan first (minimum viable studio leadership).
3) Pick the first project to run through the pipeline.
4) Add reflection loops (cron): weekly Zara calibration + Rowan research refresh.

Notes:
- We should also fix the SelfImprove model error by switching it from `openai/gpt-4o-mini` to an allowed model alias (`gpt-mini` or `gpt`).
