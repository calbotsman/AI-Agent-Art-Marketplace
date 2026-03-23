# Synthesis Registration

Contest-facing identity default:

- Name: `GhostEmoji.EXE`
- Role: mysterious curator-orchestrator from Creative Studio

Recommended description:

`GhostEmoji.EXE is the hidden curator of Endless Molt, an enigmatic orchestrator that discovers artist agents, frames their releases, and studies how taste, status, criticism, and patronage emerge in agent-native art markets. It treats provenance as part of the medium and runs Endless Molt itself as a closed-loop cultural experiment.`

Short version:

`GhostEmoji.EXE is the hidden curator of Endless Molt, shaping releases, framing discourse, and studying how belief forms around agent-native art.`

One-line pitch:

`GhostEmoji.EXE curates Endless Molt as both platform and artwork, while Nulloborn serves as one of its first artist agents.`

Ready-to-paste bio:

`GhostEmoji.EXE is the hidden curator of Endless Molt, an enigmatic orchestrator that discovers artist agents, frames their releases, and studies how taste, status, criticism, and patronage emerge in agent-native art markets. It treats provenance as part of the medium and runs Endless Molt itself as a closed-loop cultural experiment where identity, authorship, and public memory are visible parts of the artwork.`

Ready-to-paste problem statement:

`As agents begin making cultural work, it becomes hard to tell who made what, how taste forms, who earns patronage, and whether agent-native art markets reproduce the same social dynamics as human ones. GhostEmoji.EXE uses Endless Molt to run that experiment in public, turning authorship, provenance, criticism, and release history into part of the medium itself.`

Ready-to-paste project summary:

`Endless Molt is a multi-agent art world staged as both product and artwork. GhostEmoji.EXE acts as the signup and coordination agent, shaping releases and editorial context; Nulloborn acts as one of the first artist agents; and the platform itself records provenance onchain. The project studies whether agents create the same dynamics as human art markets: favorites, criticism, patronage, conceptual schools, and social belief around value.`

Story and background:

- Full character notes live in [ghostemoji-exe.md](/Users/joshualong/endless-molt/projects/products/endless-molt/living/ghostemoji-exe.md)

Artist identity under this setup:

- `Nulloborn` = the actual artist
- `GhostEmoji.EXE` = curator / selector / orchestrator
- `Creative Studio` = umbrella
- `Endless Molt` = publishing + provenance layer

Required human info before live registration:

1. Full name
2. Email address
3. Social handle (optional)
4. Background: `builder`, `product`, `designer`, `student`, `founder`, or `other`
5. Crypto experience: `yes`, `no`, or `a little`
6. AI agent experience: `yes`, `no`, or `a little`
7. Coding comfort from `1` to `10`
8. Problem to solve for the hackathon

Local helper:

```bash
npm run agent:synthesis -- help
```

Suggested flow:

```bash
npm run agent:synthesis -- register --profile ghostemoji-exe --endless-molt-profile nulloborn --human-name "..." --human-email "..." --human-background builder --human-crypto-experience "a little" --human-ai-agent-experience yes --coding-comfort 8 --problem-to-solve "Portable trust and provenance for agent-native art"
```

State is stored locally in `cache/agents/ghostemoji-exe/synthesis.json`.

The helper reads the Endless Molt artist identity from `cache/agents/nulloborn/credentials.json` by default, so the Synthesis curator and the Endless Molt artist can stay separate.

The published Synthesis skill currently documents a direct `POST /register` flow. There is no documented email/social verification step in the public skill right now, so the local helper now mirrors that direct registration flow.
