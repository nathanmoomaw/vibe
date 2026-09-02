# ROADMAP — vibe

## In Progress
- [ ] Enjoyable frequency filtering (harmonic masking of harsh ranges)
- [ ] Astro/divination UI layer (tie into now/moveloose aesthetic)

## Backlog
- [ ] Mic input for environment-reactive soundscape
- [ ] Re-expose party/lo mode switch (footer toggle hidden Jul 10 2026, `mode` stays hardcoded to `'party'`; `LoView`/`ModeSwitch` components untouched, just not rendered)
- [ ] Re-expose audio input (⊃ footer button hidden Aug 17 2026, needs fine-tuning; `showInput`/`playInputUrl`/`stopInput`/`unit__input-panel` untouched, just not reachable)
- [ ] Further preset refinement pass — Aug 17 2026 pass fixed calming's exact knob settings, cut pulsing (global LFO depth + focussing's own rate), and added non-repeating drift wobble to wind/water/fire/earth; still worth a dedicated round on the remaining 5 presets' volumes/rates specifically
- [ ] When a shared/linked vibe URL is opened from obfusco.us's portal, the settings decode but nothing actually starts playing — needs a call-to-action prompting the visitor to activate playback
- [ ] Hexagram divination mode — a new footer icon draws two I Ching trigrams line-by-line (yarrow-stick/coin-toss style, requiring a user click per line) instead of the app's usual continuous mutation between paired trigrams. First trigram drawn activates its frequency; if changing lines are tossed, a second (resulting) hexagram is drawn and both are shown side by side in the circle viz, switchable by click, each independently playing its own 2 trigrams' worth of elemental frequencies (this state needs all 8 trigrams available as separate, non-mutating elements — 2 rows of 4 dials — rather than today's single row of paired-morphing elements). Lines render inside the circle viz as they're drawn, positioned so the bottom hexagram row maps to the bottom trigram and the top row to the top trigram. Substantial enough to need its own dedicated design pass before implementation
- [ ] True stereo binaural beats — the LFO ombak pulse (`setNoisePulse`) is amplitude modulation (isochronic-style), not the frequency-difference-between-ears technique the tone-science memory means by "binaural" (needs a `ChannelMergerNode` routing a slightly-detuned oscillator pair to separate L/R channels per active tone). Only benefits headphone listeners, so needs its own toggle/detection rather than replacing the current speaker-safe pulse
- [ ] φ (golden ratio, 1.618 Hz) as an available pulse rate — tone-science memory frames it as reducing neural habituation for deep sessions (never phase-locks with integer harmonics). Not wired in anywhere yet; deliberately left the existing moon-phase→Hz `PULSE_HZ` mapping in `reading.js` untouched during the Aug 29 audit rather than swap in an untested value over presets that got multiple dedicated tuning passes (Aug 17 2026 DEVLOG) — would want its own slot (new preset or explicit option) rather than replacing a tuned one
- [ ] Fire's amplitude-flicker LFOs (candle/campfire/bonfire: 0.6–1.4 Hz) and bonfire's sub-oscillator (52 Hz) sit well outside tone-science memory's literal "3–15 Hz flicker, 20–40 Hz sub" guidance — almost certainly the same deliberate calming-over-realistic tradeoff already made for wind ("too harsh, simulate more relaxing" per Jun 23 2026 DEVLOG), not a bug, but flagged from the Aug 29 audit in case a more textured/realistic fire option is ever wanted
- [ ] Astro chart houses/Ascendant — the Sep 1 2026 present-sky wheel (`VibeAstro.jsx`) only draws the 12-sign ring + planet glyphs; no house cusps, since nothing in this codebase computes local sidereal time or a house system. Would need lat/lon (already fetched, currently only shown in the caption) fed through a real house-cusp formula (Placidus/Whole Sign/etc.) — a from-scratch addition, not a config flip

## Completed
- [x] Present-sky astro chart: new footer icon opens a transparent, non-blocking full-screen zodiac wheel (12 signs + live planet glyphs at true ecliptic longitude), same location-permission flow as Vibe Reading (geolocation → IP fallback), dismissed by the same icon or an upper-right ×. No houses/Ascendant (see Backlog). Planet math extracted into shared `utils/planets.js` so the wheel and the circle-viz's own planet glyphs stay in sync
- [x] Cymatics/Chladni-pattern visualizer — a second `<canvas>` (`chladniCanvasRef`) stacked behind the existing spectrum/planet canvas, its own WebGL context rendering tone-science memory's exact standing-wave formula (`cos(m·π·x)·cos(n·π·y) − cos(n·π·x)·cos(m·π·y)`) as glowing nodal lines. Mode numbers m/n driven live by low/high FFT-band energy (smoothed toward target each frame, not jump-cut), colored in the same blue/pink family as the existing spectrum bars, faded by overall volume, gated off (canvas cleared) when `!anyOn` same as the spectrum visualizer. Purely additive — the existing canvas, planets, hit-testing, and drag interactions are completely untouched. Also folds in the vaguer "visual pulsing / animated interface (deeper)" backlog item, which this supersedes. Verified via Playwright screenshots: idle state clean, active state shows the nodal-line pattern clearly behind the spectrum bars and visibly shifts over consecutive captures (confirming the live audio-reactive drive, not a static shader)
- [x] Restored "search by ear" frequency-finding on noise channels, lost when the knob became color-morph (Jul 13 2026) — the dual-knob's outer ring was already claimed by volume, so instead: while isolated on a single noise channel (astro-sign click), the circle-viz's left/right drag repurposes from tone-rate (meaningless during noise isolation) to a live frequency sweep, with the isolated glyph's fade tracking it in real time. Ring-tip label switches to "search freq" during isolation. `FILTER_MIN`/`FILTER_MAX` exported from noise.js so the clamp range has one source of truth. Verified via Playwright: computed the Sun glyph's exact screen position from the same ecliptic-longitude math the app itself uses, clicked it (confirmed isolation via the cyan pulse ring), dragged, and confirmed the glyph fully faded out — proof the frequency actually moved far enough to break the octave match
- [x] Adjustable organic drift amount: new footer icon (squiggle) opens a small panel with depth/rate sliders (0–200%, default 100%), backed by a shared `audio/driftSettings.js` module read by both noise.js's color-chain drift and tones.js's shared `wobble()` helper. Applies as sounds (re)start, not live mid-play — v1 scope, noted in the panel's own copy
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
