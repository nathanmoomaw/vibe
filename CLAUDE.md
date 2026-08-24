# vibe

## Project Overview
VIBE — ambient noise synthesizer. Part of the audness lineage (ribbon, puddle). Colored sounds (blue, white, pink noise) with frequency control, plus synthesized ambient tones evoking bells, chimes, gongs, birds, wind, water, earth. No samples — pure synthesis.

GitHub: nathanmoomaw/vibe (public)
Domain: vibe.obfusco.us (main) / vibe-dev.obfusco.us (dev/v1)

## Stack
- Vite + React
- @audness/core (audio engine)
- Web Audio API

## Design Direction
- Futuristic, vibey, colorful, pulsing
- References vintage sound devices (white noise machines, tone generators)
- Subtle astro/numerical/divination UI concepts (think: now, moveloose)
- Frequency ranges always kept "enjoyable" — filtering out harsh harmonics

## Intent / Mood Concepts
VIBE is for: **calming, relaxing, focussing, meditating, dreaming, floating**
These six states are the core use cases. Every design and synthesis decision should serve at least one of them. New features should be evaluated against this list — does it help the user enter or deepen one of these states?

## Lineage
- Extends audness engine: new colored noise synthesis + ambient tone generation
- See LIFE/LINEAGE.md for full family tree

## Settings URL (`?v=`, `src/App.jsx`'s mount-time decode effect + `src/utils/settings.js`)
Landing with `?v=<encoded>` decodes and applies noise/tone settings on load, **autoplaying any channel that's on by default** — this is load-bearing for this app's own native QR-share feature (`VibeQR`, same `encodeSettings`/`decodeSettings` round-trip). An additive `play=0` param (Aug 19 2026, for obfusco.us's VibePill handoff — a separate deployed repo, `~/Sites/obfusco.us`) opts OUT of that default: settings still decode and apply (volume/freq/typeAngle/rate all preserved), but every channel's `on` is forced `false` and `startNoise`/`startTone` are skipped, landing paused instead of forcing playback a linking site didn't actually have active. Deliberately backward-compatible — no `play` param, or any value other than exactly `'0'`, preserves the original always-autoplay behavior, so this app's own QR feature (and any previously-shared `?v=` links) are unaffected. If `encodeSettings`/`decodeSettings`'s shape ever changes, obfusco.us's `audio/mixer.js`'s `encodeForVibeUrl()` (which builds this same format for its own handoff) needs to be updated to match manually — no shared package between the two repos.

## Git Workflow
- Active dev branch: `dev/v1` (autodeploys to vibe-dev.obfusco.us) — cut from `dev/v0` Aug 24 2026, `dev/v0` retired
- Production branch: `main` (autodeploys to vibe.obfusco.us)
- After merging dev → main, always switch back to `dev/v1`
- Always push after committing
- Update CLAUDE.md, DEVLOG.md, ROADMAP.md before committing when relevant
- Git auth via `gh auth` with HTTPS

## Communication Style
- Caveman mode by default
