# TOOLS.md - Local Notes

Skills define *how* tools work. This file is for *your* specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:
- Camera names and locations
- SSH hosts and aliases  
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras
- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH
- home-server → 192.168.1.100, user: admin

### TTS
- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

### Telegram
- test-chat-id: <YOUR_NUMERICAL_TELEGRAM_CHAT_ID_HERE> (for health checks and self-testing)


## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## Supplement Design Hooks

- Canonical workspace: `/Users/calbotsman/clawd`
- Cyborg label source template:
  - `/Users/calbotsman/Documents/github/cyborg/backend/src/shared/utils/rendering/templates/label.ts`
- Local locked-spec reference:
  - `/Users/calbotsman/clawd/Cyborg_Label_Spec.md`
- Tooling docs:
  - `/Users/calbotsman/clawd/studio/Standards/SUPPLEMENT_DESIGN_TOOLING.md`
- Concept template:
  - `/Users/calbotsman/clawd/studio/TEMPLATES/supplement-concept.example.json`

### Run command

```bash
cd /Users/calbotsman/clawd
# Strict Recraft V4 workflow (default)
npm run design:supplement -- --config /Users/calbotsman/clawd/studio/TEMPLATES/supplement-concept.example.json
```

Required env key:
- `VERCEL_AI_GATEWAY_KEY` (preferred) or `AI_GATEWAY_API_KEY`

Fallback command:
```bash
# Use only when Recraft/Gateway is down
npm run design:supplement -- --config /Users/calbotsman/clawd/studio/TEMPLATES/supplement-concept.example.json --allow-fallback-html
```

### Output root

- `/Users/calbotsman/clawd/output/supplement-design/<concept-id>/<timestamp>/`
- Expected files: `label.png`, `label.pdf`, `product-mock.png`, `brand-board.png`, `manifest.json`
- Recraft evidence files (strict path): `recraft-scene.png`, `recraft-mood.png`, `workflow-summary.json`
- Confirm `manifest.json` includes `checks.recraftV4Used: true` for strict runs

## Design Exercise Loop

Use `/Users/calbotsman/clawd/projects/design-exercises` for round-based design iteration with your feedback.

Initialize:
```bash
cd /Users/calbotsman/clawd
npm run design:exercise -- init --brand "Sun Daughter" --exercise "Nocturne Label Iteration"
```

Attach output to a round:
```bash
npm run design:exercise -- attach-output \
  --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/nocturne-label-iteration \
  --round 1 \
  --manifest /Users/calbotsman/clawd/output/supplement-design/sun-daughter-nocturne-01/<timestamp>/manifest.json
```

Capture feedback + open next round:
```bash
npm run design:exercise -- feedback \
  --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/nocturne-label-iteration \
  --round 1 \
  --decision REVISE \
  --summary "Brand mark too quiet and supporting copy too dense" \
  --focus "Increase logo weight and simplify copy"
```

Check status:
```bash
npm run design:exercise -- status \
  --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/nocturne-label-iteration
```
