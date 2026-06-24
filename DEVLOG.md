# DEVLOG — vibe

## Jun 23 2026 — Knob tips, display drag, full-card tap

- DualKnob: `outerTip`/`innerTip` props — tooltip fades in on zone hover (vol / freq | rate)
  Made default behavior; SoundSlot passes "vol" + paramLabel automatically
- Circular display: pointer drag now controls all active sounds simultaneously
  ↕ (up/down) = volume, ↔ (left/right) = noise freq / tone rate
  Drag hint label fades in when any sound is active; bezel brightens on drag
- SoundSlot cards: entire card is now the click target (role=button, onClick)
  DualKnob area stops propagation so knob drag doesn't accidentally toggle

## Jun 23 2026 — Polish pass: knobs, vintage design, fixes

- Slowed ripple background: interval 1.8–5s, lifetime 9s (was 0.3–1.4s / 4s)
- Slot pulse animation: 7s cycle (was 2.8s)
- Removed fake rivets/screws from unit UI
- Lo mode: added interactive range sliders for vol + freq/rate per active slot
- Party mode: ported DualKnob from ribbon (outer ring = vol, inner notch = freq/rate)
- Unit redesign from vintage refs (Marpac Dohm + Heathkit tone gen):
  - Warm dark walnut gradient body with amber-gold border hint
  - Circular speaker/meter display inset (layered rings, dark glass)
  - Radial spectrum visualizer in the circular display
  - Metal faceplate panel with warm section labels
  - Nameplate with amber brand treatment

## Jun 23 2026 — Party/Lo modes + physical unit aesthetic

- Background: fullscreen canvas with star field + expanding color ripples from center
- Ripples: audio-energy-driven rate, color matches active sound channels
- Unit: frosted glass morphism panel floating over background (backdrop-filter + shadows)
- Faceplate + screws, body sections, footer strip — hardware device silhouette
- Party mode: full visual + glowing slots + background animation
- Lo mode: ASCII-based monospace UI, minimal — [ON/--] toggles + block progress bars
- ModeSwitch: party · lo toggle in the unit footer

## Jun 23 2026 — v0 app built

- Audio engine: white/pink/blue noise synthesis (pure Web Audio API buffers)
- Ambient tones: bell, chime, gong (FM synthesis) + birds (swept oscillators) + wind/water/earth (filtered noise + LFOs)
- Shared convolver reverb tail for FM tones
- React UI: SoundSlot cards with toggle, volume, freq/rate controls
- Canvas visualizer via AnalyserNode (frequency bars, fades when silent)
- Vibey dark aesthetic: per-color glow, pulse animation on active slots

## Jun 23 2026 — Project scaffold + CI/CD

- Scaffolded Vite + React app (package.json, index.html, src/, vite.config.js)
- Created .github/workflows/deploy.yml: main → vibe.obfusco.us, dev/** → vibe-dev.obfusco.us
- Created dev/v0 branch for active development
- CLAUDE.md: auto-return to dev branch after merges to main

## Jun 22 2026 — Project initialized

- Created GitHub repo: nathanmoomaw/vibe (public)
- Set up local project directory with standard MDs
- Positioned in audness lineage alongside ribbon/puddle
