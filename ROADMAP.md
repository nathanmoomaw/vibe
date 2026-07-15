# ROADMAP — vibe

## In Progress
- [ ] Enjoyable frequency filtering (harmonic masking of harsh ranges)
- [ ] Astro/divination UI layer (tie into now/moveloose aesthetic)

## Backlog
- [ ] Visual pulsing / animated interface (deeper)
- [ ] Mic input for environment-reactive soundscape
- [ ] Re-expose party/lo mode switch (footer toggle hidden Jul 10 2026, `mode` stays hardcoded to `'party'`; `LoView`/`ModeSwitch` components untouched, just not rendered)
- [ ] Adjustable organic drift amount — a user-facing control for the depth/rate of the frequency drift added Jul 12 2026 (currently a fixed subtle default, not exposed as a setting)
- [ ] Restore a way to manually find planet glyphs on noise channels — the display-drag/knob used to adjust noise frequency (and the glyph-fade logic tracks noise frequency), but as of the Jul 13 2026 color-pairing change the knob morphs color instead and frequency is only set by readings/presets, so that exploratory "search by ear" interaction is gone for noise channels specifically
- [ ] Further mobile CPU/performance options (see Jul 14 2026 DEVLOG entry for the fixes already shipped): consolidate per-chain drift LFOs, audit elemental tones' (wind/water/fire/earth) own internal oscillator/filter counts, adopt the Media Session API so mobile OSes treat the tab as an active playback context

## Completed
- [x] Favicon: circle-viz spectrum ring + flower rosette around the Qian (Heaven) trigram
- [x] Console fully transparent: background gradient + backdrop-filter blur removed entirely
- [x] Presets grid: 💊 footer button → 6 hand-tuned one-tap presets (calming, relaxing, focussing, meditating, dreaming, floating), each with hover blurb
- [x] Info tooltips: reusable hover-popover pattern explaining the energetic quality behind moon phase, tide, binaural intent, decan, and circle-viz planet glyphs
- [x] Acoustomancy integration: Wǔ Yīn 五音 note frequencies in reading presets, 136.1 Hz OM anchor, LFO ombak pulse at binaural beat targets, Schumann resonance (7.83 Hz) for full moon meditation
- [x] Vibe Reading: 🃏 opens modal with moon phase + time + weather → poetic reading + sound preset, apply button loads sounds
- [x] Audio input: ⊃ footer button → paste audio URL, filtered through active noise AND tone BiquadFilters via MediaElementSourceNode
- [x] Anti-Gimmick philosophy modal: 🃏 joker footer button → VibePhilosophy overlay with 6 UX principles
- [x] Nearly transparent console + shimmer glitch animation (22s cycle, diagonal sweep + outward pulse)
- [x] QR share modal: iridescent QR with active sound colors, nameable presets, URL encode/decode
- [x] I Ching elemental section: SVG trigrams + morphing via paired complements + elemental ordering
- [x] Wind softened to pink noise + gentler synthesis
- [x] Water: stream/rain/ocean via circular dual-knob type selector
- [x] Fire sound: candle/campfire/bonfire via circular dual-knob type selector
- [x] Real starfield: geolocation → RA/Dec→Alt/Az projection (default: LA)
- [x] DualKnob tip positioning fixed (outer visible, inner no longer covers values)
- [x] **v0.0.0** — live at vibe.obfusco.us
- [x] Scaffold Vite + React app
- [x] CI/CD: main → vibe.obfusco.us, dev/v0 → vibe-dev.obfusco.us
- [x] Colored noise synthesis: white, pink, blue (with frequency control)
- [x] Ambient tone synthesis: bell, chime, gong (FM), birds, wind, water, earth
- [x] Canvas frequency visualizer
- [x] Physical unit aesthetic: frosted glass floating panel + hardware silhouette
- [x] Fullscreen color ripples from center (audio-energy-driven)
- [x] Party/Lo mode switch (party = visual + animated, lo = ASCII monospace)
- [x] Organic default drift: noise-channel filter frequencies wobble via a slow randomized-rate LFO, bell tone gets subtle per-strike pitch variation
- [x] Brown, violet, and grey noise, paired with pink/white/blue respectively — knob morphs continuously between each pair
- [x] Noise knob color morphs with the audible color blend
- [x] Fixed doubled audio-graph node count from unconditional paired-color synthesis (lazy-build instead) + added background/foreground AudioContext resume handling
