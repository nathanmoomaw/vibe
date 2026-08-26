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

**"Autoplay" doesn't actually call `startNoise`/`startTone` from the decode effect (Aug 25 2026).** A bare page load — QR scan, pasted link — carries no real user gesture, so calling them there hits a suspended `AudioContext` and silently produces no sound (this is why QR landings played nothing). Instead, when `play !== '0'`, the decode effect stashes the decoded config in a ref and shows `VibeQRLanding` (`src/components/VibeQRLanding.jsx`) — a half-opacity re-render of the same QR plus a "vibe" button; any click on it (button or backdrop, no `stopPropagation`) is a genuine gesture and fires `handleQrLandingStart`, which is where `startNoise`/`startTone` actually run. The `play=0` path is unaffected — it never shows this overlay and never autoplays, same as before.

## Stealth recording (`/r`, Aug 26 2026)
Visiting `/r` (e.g. vibe.obfusco.us/r) enables a hidden recording mode with no manual controls — `App.jsx`'s `isRecordMode` checks `window.location.pathname === '/r'` once at mount. While in this mode, playback starting (`anyOn` false→true) calls `startRecording()` (`audio/engine.js`) automatically; playback stopping calls `stopRecording()` and immediately triggers a browser download of the result (`vibe-recording-<timestamp>.webm` or `.m4a`, whichever `MediaRecorder.isTypeSupported` picks first from the candidate list). A small "● rec" indicator (upper-left, opposite the stop button) is the only visible sign it's active. Recording taps `masterGain` into a `MediaStreamAudioDestinationNode` in parallel with the normal analyser→destination path — doesn't touch playback or the visualizer.

**Depends on infra outside this repo.** Deploy is a plain `aws s3 sync` to a bucket read by CloudFront (`.github/workflows/deploy.yml`) — there's no SPA fallback/rewrite config in this repo. `/r` only works if the S3 bucket's error document or CloudFront's custom error responses are set to serve `/index.html` for 403/404s; if not, `/r` 404s before any JS loads and this feature never triggers. Verified working against Vite's dev server (which has built-in SPA fallback) — **not yet confirmed against the live vibe.obfusco.us/vibe-dev.obfusco.us infra.**

## Git Workflow
- Active dev branch: `dev/v1` (autodeploys to vibe-dev.obfusco.us) — cut from `dev/v0` Aug 24 2026, `dev/v0` retired
- Production branch: `main` (autodeploys to vibe.obfusco.us)
- After merging dev → main, always switch back to `dev/v1`
- Always push after committing
- Update CLAUDE.md, DEVLOG.md, ROADMAP.md before committing when relevant
- Git auth via `gh auth` with HTTPS

## Communication Style
- Caveman mode by default
