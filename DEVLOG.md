# DEVLOG — vibe

## Jun 24 2026 — I Ching elemental section with morphing trigrams

- Separated "element" section (fire/wind/water/earth) from "tone" section (bell/chime/gong/birds)
- Elemental sounds ordered per Fu Xi sequence: Li (fire 3) → Xun (wind 5) → Kan (water 6) → Kun (earth 8)
- Each elemental slot shows an SVG trigram (3 horizontal bars, yang=solid / yin=broken) replacing the dot indicator
- Trigram morphs continuously toward its I Ching complement as inner knob rotates:
  - fire Li ☲ ↔ water Kan ☵ | wind Xun ☴ ↔ thunder Zhen ☳ | water Kan ☵ ↔ fire Li ☲ | earth Kun ☷ ↔ heaven Qian ☰
- At 0°=base trigram, 180°=complement, 360°=back — cosine interpolation; each line's gap closes smoothly
- Wind quality knob: breeze→gale→squall (Xun→Zhen) adjusts BPF frequency + LFO sweep depth live
- Earth quality knob: loam→stone→crystal (Kun→Qian) adjusts LPF cutoff + sub oscillator mix live

## Jun 24 2026 — wind softened, water/fire types, real starfield, tip fixes

- Wind: switched to pink noise (Voss-McCartney), added HPF+LPF chain, slower+narrower LFO → much more relaxing
- Water: 3 synthesis engines (stream / rain / ocean) crossfade via circular inner knob (0°→120°→240°→360°)
- Fire: new sound — 3 engines (candle / campfire / bonfire) with same circular type-selector paradigm
- Both water+fire use `setTargetAtTime` crossfade (50ms tau) for seamless blend between types
- DualKnob: `innerCircular` prop — inner notch rotates full 360°, drag wraps without clamping
- Starfield: replaced random star positions with real sky using RA/Dec→Alt/Az computation; 60 named stars + 120 faint; geolocation API (default: LA 34.05°N 118.24°W); updates every 60s
- Tips fix: outer tip (was clipped by `overflow:hidden`) and inner tip (was covering value labels) both now positioned inside `vk__body` — outer at bottom of outer ring, inner centered on inner circle

## Jun 23 2026 — v0.0.0 released to vibe.obfusco.us

- Merged dev/v0 → main, tagged v0.0.0
- Deployed to vibe.obfusco.us via GitHub Actions

## Jun 23 2026 — Tap display to randomize

- Tapping the circular display (vs dragging) detects via cumulative movement threshold (<6px)
- On tap with sounds active: randomizes all active sounds' vol ±25% and freq/rate ±25% of range
- Display ring flashes an expanding amber halo animation to confirm the tap
- Drag logic unchanged; movement threshold gates drag from triggering on short taps

## Jun 23 2026 — Larger knobs + varied pulse shapes

- DualKnob size increased 50%: 46→69px; slot knob-wrap max-height updated
- Background pulse shapes now vary by sound type:
  - white/bell/wind/earth → halo (3-layer concentric rings, thick outer glow)
  - pink/gong/water → flower (rose curve, 4/6/5 petals, rotates as it expands)
  - blue/chime/birds → star (polygon, 6/5/8 points, rotates as it expands)
- All shapes include a soft inner glow shell behind the main outline
- Halos are now 3-layer with 22/10/3px strokes; flowers/stars add a blurred circle halo
- Each ripple gets a random starting rotation + speed, reversed direction randomly
- Shape type tracked per ripple; activeSounds now passed as {id, glow} objects

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
