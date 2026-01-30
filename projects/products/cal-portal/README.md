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

## Quick commands (local-first)
In the chat box you can run commands without the gateway:
- `/help` (or Cmd/Ctrl + `/`) — show command list
- `/task <title>` — add task
- `/done <query|id>` — mark first matching task done
- `/run <title> | <notes>` — add a run
- `/ref <url> | <title> | <notes>` — add a library ref
- `/note <text>` — append to Studio notes
- `/export` — export hub JSON
- `/ops` — switch to Ops mode
- `/talk` — switch to Talk mode
- `/clear` — clear chat + draft

Notes:
- Port is fixed to **5174** and Vite is set to **fail if the port is occupied** (no auto-fallback).
- The UI has two modes:
  - **Talk mode**: hides the Ops panel and keeps a small chat tray on the stage.
  - **Ops mode**: shows Settings + full chat + notes.
- The bottom status bar is always visible and shows **gateway connectivity** and **token status**.

## Next steps
- Add **image/vision** to the gateway call (right now we only attach image *names*).
- Add a lightweight **agent selector** (x-clawdbot-agent-id) + “clear conversation” UX.
- Polish the **hub import/export** UX (merge/preview vs replace; better error messages).
- Avatar: add **expressions / visemes** + blink and subtle idle motion.
