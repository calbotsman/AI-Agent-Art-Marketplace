# Agents Map

This is a quick, visual reference for how Cal's OpenClaw agents are wired (gateway, watchdogs, channels, and agent workspaces).

```mermaid
flowchart LR
  %% Runtime services
  subgraph Launchd["macOS launchd jobs"]
    Guardian["com.tcr.openclaw.guardian\n(watchdog loop)"]
    Foundation["com.tcr.openclaw.foundation\n(every 15m hygiene)"]
    Gateway["ai.openclaw.gateway\nws://127.0.0.1:19001"]
  end

  Guardian -->|"ensure job + restart if needed"| Gateway
  Foundation -->|"clamp contextTokens + compact transcripts"| Gateway

  %% Channels
  subgraph Channels
    Telegram["Telegram bot\n@CalBotsmanBot"]
  end
  Telegram -->|"messages"| Gateway
  Gateway -->|"replies"| Telegram

  %% Agent workspaces
  subgraph Agents["Agents (workspaces + agent dirs)"]
    Main["main\nagentDir: ~/.openclaw/agents/main/agent\nworkspace: ~/.openclaw/workspace"]
    Producer["producer\nworkspace: ~/.openclaw/workspace-producer"]
    Zara["zara\nworkspace: ~/.openclaw/workspace-director"]
    Rowan["rowan\nworkspace: ~/.openclaw/workspace-strategy"]
    Copy["copy\nworkspace: ~/.openclaw/workspace-copy"]
    Design["design\nworkspace: ~/.openclaw/workspace-design"]
    Growth["growth\nworkspace: ~/.openclaw/workspace-growth"]
    Artist["artist\nworkspace: ~/.openclaw/workspace-artist"]
    IG["ig\nworkspace: ~/.openclaw/workspace-ig"]
  end

  Gateway -->|"runs turns for"| Main
  Main -->|"delegates (tool/subagent calls)"| Producer
  Main -->|"delegates (tool/subagent calls)"| Zara
  Main -->|"delegates (tool/subagent calls)"| Rowan
  Main -->|"delegates (tool/subagent calls)"| Copy
  Main -->|"delegates (tool/subagent calls)"| Design
  Main -->|"delegates (tool/subagent calls)"| Growth
  Main -->|"delegates (tool/subagent calls)"| Artist
  Main -->|"delegates (tool/subagent calls)"| IG

  %% Durable memory pointers
  subgraph WorkspaceFiles["Durable pointers (loaded on boot/search)"]
    Boot["~/.openclaw/workspace/BOOT.md"]
    Obsidian["~/.openclaw/workspace/OBSIDIAN_AGENTS.md"]
  end
  Main -->|"loads/uses"| Boot
  Boot -->|"links"| Obsidian
```

## Quick Commands

- Open the control UI: `openclaw dashboard`
- List agents: `openclaw agents list`
- Check Telegram health: `openclaw health`

