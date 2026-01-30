# Cal Portal (local)

A local, no-cloud buddy-mode UI for Cal:
- 3D avatar (Three.js)
- Mic input (Web Speech Recognition; Chrome)
- Voice output (SpeechSynthesis)

## Run
```bash
cd /Users/calbotsman/clawd/projects/products/cal-portal
npm install
npm run dev
```

Open: http://127.0.0.1:5174

Notes:
- Port is fixed to **5174** and Vite is set to **fail if the port is occupied** (no auto-fallback).
- The UI has two modes:
  - **Talk mode**: hides the Ops panel and keeps a small chat tray on the stage.
  - **Ops mode**: shows Settings + full chat + notes.
- The bottom status bar is always visible and shows **gateway connectivity** and **token status**.

## Next steps
- Wire chat to Clawdbot gateway/session.
- Add "push-to-talk" and hotkeys.
- Add a proper avatar rig + expressions.
