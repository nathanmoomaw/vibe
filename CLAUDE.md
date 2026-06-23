# vibe

## Project Overview
VIBE — ambient noise synthesizer. Part of the audness lineage (ribbon, puddle). Colored sounds (blue, white, pink noise) with frequency control, plus synthesized ambient tones evoking bells, chimes, gongs, birds, wind, water, earth. No samples — pure synthesis.

GitHub: nathanmoomaw/vibe (public)
Domain: vibe.obfusco.us (main) / vibe-dev.obfusco.us (dev/v0)

## Stack
- Vite + React
- @audness/core (audio engine)
- Web Audio API

## Design Direction
- Futuristic, vibey, colorful, pulsing
- References vintage sound devices (white noise machines, tone generators)
- Subtle astro/numerical/divination UI concepts (think: now, moveloose)
- Frequency ranges always kept "enjoyable" — filtering out harsh harmonics

## Lineage
- Extends audness engine: new colored noise synthesis + ambient tone generation
- See LIFE/LINEAGE.md for full family tree

## Git Workflow
- Active dev branch: `dev/v0` (autodeploys to vibe-dev.obfusco.us)
- Production branch: `main` (autodeploys to vibe.obfusco.us)
- After merging dev → main, always switch back to `dev/v0`
- Always push after committing
- Update CLAUDE.md, DEVLOG.md, ROADMAP.md before committing when relevant
- Git auth via `gh auth` with HTTPS

## Communication Style
- Caveman mode by default
