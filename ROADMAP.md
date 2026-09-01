# ROADMAP — vibe

## In Progress
- [ ] Enjoyable frequency filtering (harmonic masking of harsh ranges)
- [ ] Astro/divination UI layer (tie into now/moveloose aesthetic)

## Backlog
- [ ] Visual pulsing / animated interface (deeper) — Sep 1 2026: decided to fold this into the Chladni/cymatics visualizer below rather than build a separate intermediate step; see that item, this one closes once it lands
- [ ] Mic input for environment-reactive soundscape
- [ ] Re-expose party/lo mode switch (footer toggle hidden Jul 10 2026, `mode` stays hardcoded to `'party'`; `LoView`/`ModeSwitch` components untouched, just not rendered)
- [ ] Adjustable organic drift amount — a user-facing control for the depth/rate of the frequency drift added Jul 12 2026 (currently a fixed subtle default, not exposed as a setting)
- [ ] Restore a way to manually find planet glyphs on noise channels — the display-drag/knob used to adjust noise frequency (and the glyph-fade logic tracks noise frequency), but as of the Jul 13 2026 color-pairing change the knob morphs color instead and frequency is only set by readings/presets, so that exploratory "search by ear" interaction is gone for noise channels specifically
- [ ] Re-expose audio input (⊃ footer button hidden Aug 17 2026, needs fine-tuning; `showInput`/`playInputUrl`/`stopInput`/`unit__input-panel` untouched, just not reachable)
- [ ] Further preset refinement pass — Aug 17 2026 pass fixed calming's exact knob settings, cut pulsing (global LFO depth + focussing's own rate), and added non-repeating drift wobble to wind/water/fire/earth; still worth a dedicated round on the remaining 5 presets' volumes/rates specifically
- [ ] When a shared/linked vibe URL is opened from obfusco.us's portal, the settings decode but nothing actually starts playing — needs a call-to-action prompting the visitor to activate playback
- [ ] Hexagram divination mode — a new footer icon draws two I Ching trigrams line-by-line (yarrow-stick/coin-toss style, requiring a user click per line) instead of the app's usual continuous mutation between paired trigrams. First trigram drawn activates its frequency; if changing lines are tossed, a second (resulting) hexagram is drawn and both are shown side by side in the circle viz, switchable by click, each independently playing its own 2 trigrams' worth of elemental frequencies (this state needs all 8 trigrams available as separate, non-mutating elements — 2 rows of 4 dials — rather than today's single row of paired-morphing elements). Lines render inside the circle viz as they're drawn, positioned so the bottom hexagram row maps to the bottom trigram and the top row to the top trigram. Substantial enough to need its own dedicated design pass before implementation
- [ ] True stereo binaural beats — the LFO ombak pulse (`setNoisePulse`) is amplitude modulation (isochronic-style), not the frequency-difference-between-ears technique the tone-science memory means by "binaural" (needs a `ChannelMergerNode` routing a slightly-detuned oscillator pair to separate L/R channels per active tone). Only benefits headphone listeners, so needs its own toggle/detection rather than replacing the current speaker-safe pulse
- [ ] Cymatics/Chladni-pattern visualizer — tone-science memory has a full GLSL formula (`cos(m·π·x)·cos(n·π·y) − cos(n·π·x)·cos(m·π·y)`, m/n driven by `AnalyserNode` FFT bins) for standing-wave visuals; VIBE's current circle-viz/celestial-globe doesn't do this. Would be a new visual mode, not a replacement
- [ ] φ (golden ratio, 1.618 Hz) as an available pulse rate — tone-science memory frames it as reducing neural habituation for deep sessions (never phase-locks with integer harmonics). Not wired in anywhere yet; deliberately left the existing moon-phase→Hz `PULSE_HZ` mapping in `reading.js` untouched during the Aug 29 audit rather than swap in an untested value over presets that got multiple dedicated tuning passes (Aug 17 2026 DEVLOG) — would want its own slot (new preset or explicit option) rather than replacing a tuned one
- [ ] Fire's amplitude-flicker LFOs (candle/campfire/bonfire: 0.6–1.4 Hz) and bonfire's sub-oscillator (52 Hz) sit well outside tone-science memory's literal "3–15 Hz flicker, 20–40 Hz sub" guidance — almost certainly the same deliberate calming-over-realistic tradeoff already made for wind ("too harsh, simulate more relaxing" per Jun 23 2026 DEVLOG), not a bug, but flagged from the Aug 29 audit in case a more textured/realistic fire option is ever wanted

## Completed
- [x] Spectral-ecology band separation pass: Water's bandpass centers (900→600, 2000→1300 stream; 2800→1450 rain) and ocean's lowpass (650→500), Fire campfire's lowpass ceiling (2200→1400) — all pulled toward Krause's Low-mid band for Water/Fire instead of creeping into Wind/Chimes' register (LFO depths scaled proportionally to match each new, lower center)
- [x] Mobile CPU: consolidated per-chain drift LFOs in noise.js — primary and paired color chains now share one drift oscillator per noise slot (each still gets its own depth-scaled driftGain sized to its own center frequency), halving the oscillator count whenever a paired chain is built. Audited water/fire's always-on 3-way crossfade node count too — that one's load-bearing for the smooth type-morph UX and wasn't touched
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
- [x] Background-playback keep-alive (silent looping audio element + Media Session registration) so backgrounded mobile tabs don't freeze the setTimeout-scheduled bell/chime/gong/birds triggers
- [x] Randomize (tap-to-jitter + first-tap curated preset) now biased by present moon/tide/weather conditions instead of pure Math.random()
