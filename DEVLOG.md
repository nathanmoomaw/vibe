# DEVLOG — vibe

## Jun 29 2026 — trigrams, hover glows, stop button, star trails

- **Trigrams**: size 22 → 30; added SVG border frame (thin rounded rect, 28% opacity) containing the bars — reduces floating-bars feel; inner bar layout uses padding so bars sit inside the frame
- **Console silent hover**: `.unit--silent:hover` adds a soft purple glow (box-shadow) when no audio is playing; transitions smoothly in/out
- **Circle viz silent hover**: `.unit__display-ring--silent:hover` glows the display ring with purple/violet haze when silent; also sets `cursor: pointer` to hint interactivity
- **Stop-all button**: removed border; `■` styled with 5s slow animated radial dark-red gradient overlay (`::before`); subtle pulsing at rest, saturates on hover
- **Star trail**: FAINT_RAW increased 130→220 stars; each star now draws a motion trail using its analytically-computed position 24 seconds in the past (same sidereal rotation at θ-24s); gradient line fades from transparent to 28% star alpha, lineWidth proportional to star radius

## Jun 29 2026 — six fixes and features

- **First-tap noise volume**: first-tap presets now start noise at 0.12–0.13 (from 0.45–0.55); user scales up from there; Wǔ Yīn-tuned noise frequencies applied to presets too
- **DualKnob volume display bug fixed**: `applyMixVisuals` was setting `style.strokeDasharray` (inline CSS) which persisted and overrode React's `strokeDasharray` attribute on subsequent re-renders. Fix: use `setAttribute` during drag and clear inline style on pointer up so React takes control
- **Reading fade flow**: opening the reading fades master to 0.06 and stops all current sounds (clean slate); each card reveal starts its sound; close/cancel fades back to 0.85; apply fades back in
- **Test media**: moved 2 MP3 files from project root → `public/test-media/`. Reference as `/test-media/01-make-your-move.mp3` and `/test-media/02-class-1.mp3` in the audio input section
- **Console transparency**: background alpha reduced further (0.02–0.03); borders and shadows also lightened; backdrop-filter softened to blur(18px)
- **Stop-all button**: `■` button appears in unit upper-right when any sound is playing; stops all sounds and clears pulse LFOs; hidden when silent

## Jun 29 2026 — apply acoustomancy findings to dev

- **Wǔ Yīn tuned noise frequencies**: each moon state's noise channel now uses the historically-grounded 五音 pentatonic frequency for its dominant I Ching element — Earth/Mountain=512Hz(C), Metal/Heaven=576Hz(D), Wood/Wind/Thunder=640Hz(E), Fire=768Hz(G), Water=864Hz(A)
- **136.1 Hz OM anchor**: new moon and waning crescent now use pink noise lowpass at 136.1 Hz (Earth orbital year → audible Hz), the deepest meditative frequency in the Wǔ Yīn / heart chakra tradition
- **LFO ombak pulse**: `setNoisePulse(id, beatHz)` in noise.js adds a sine LFO (±8% amplitude modulation) at the reading's binaural beat target — δ 2.5 Hz (floating), θ 4–7.83 Hz (meditating/dreaming), α 9–12 Hz (calming/focusing). Activates on "apply reading"
- **Schumann resonance**: full moon reading targets 7.83 Hz (Schumann fundamental) as its pulse — peak meditation at lunar peak
- **VibeReading modal**: shows intent label ("∿ meditating · ♁ 7.83 Hz") below tidal state in the moon section
- **MYTHOS.md**: added structural precedents — Oracle at Dodona, Nada Brahma, Wǔ Yīn, 136.1 Hz, ombak pulse, three laws of pleasant sound combination

## Jun 29 2026 — acoustomancy / audmancy research session

- Deep /learn session (tone + divination agents) focused on sound divination, psychoacoustics, and frequency combinations for mystic/pleasant states
- Saved as `learn_digest_2026-06-29.md` and `acoustomancy.md` in LIFE memory
- Key findings for VIBE: I Ching trigram → Wǔ Yīn note mappings (C/D/E/G/A historically grounded), binaural beat targets per intent state (theta 4–8 Hz for meditating, delta for floating), 136.1 Hz OM frequency as meditation anchor, 7.83 Hz Schumann for binaural target, consonance laws (3:2, 4:3 ratio pairs), Oracle at Dodona as structural metaphor for VIBE Reading

## Jun 29 2026 — vibe reading: tidal + weather depth

- Tidal state added: `tidalSpring(phase)` (1=spring/0=neap) and `tidalHeight(phase)` (high/low within lunar day, 12.42h cycle)
- Noise frequencies shift ±8% with tide height (high tide → slightly higher freq)
- Tone volumes modulated by tidal amplitude: spring tide +8%, neap tide −8%
- Wind speed → `wind.typeAngle` (calm breeze=0°, gale=150°), with km/h annotation on reason
- Precipitation → `water.typeAngle` (drizzle=stream/0°, rain=120°, heavy=ocean/270°), with mm annotation
- High spring tide at flood → adds quiet water undertone (vol 0.22) if no water/weather already present
- Weather entropy mixes into seed so same-hour readings vary with live conditions
- Tidal label ("high tide · spring" etc.) shown in reading header below moon phase

## Jun 29 2026 — vibe reading: progressive reveal + quiet noise

- Sound cards now reveal one at a time via "reveal the prescription ↓" button; each card shows sound name, type badge, and a contextual reason explaining why it was chosen for the current moon/time/weather
- All readings now guarantee a quiet noise channel (volume 0.12–0.14, time-scaling excluded); `waningGibbous` case previously had no noise — now adds pink noise at 0.13
- `buildReading` adds `soundCards[]` array with per-sound `reason` strings; `VibeReading` merges colors from NOISE/TONES metadata

## Jun 29 2026 — vibe reading + audio input

- **Vibe Reading** (`🃏` footer button): modal that reads current moon phase (synodic calculation from Jan 29 2025 new moon ref), time of day, and live weather (Open-Meteo, geolocation → LA fallback) → generates a 3-line poetic reading + recommended sound configuration; "apply reading" button loads the sounds
- Reading algorithm (`src/utils/reading.js`): moon state × time period × weather element → noise/tones config + MOON_TEXT/TIME_TEXT/PRESCRIPTION narrative templates
- **Audio input** (`⊃` footer button): paste a direct audio URL (mp3/wav/ogg — CORS-enabled sources only; YouTube is CORS-blocked); audio is routed through `createMediaElementSource()` and filtered through a parallel BiquadFilter bank mirroring active noise settings (bandpass per channel); stop button clears input
- `src/audio/engine.js`: added `setAudioInput(url, filterConfigs)`, `stopAudioInput()`, `isAudioInputActive()`

## Jun 29 2026 — transparent console + shimmer glitch + philosophy modal

- Console background nearly fully transparent (rgba alpha 0.05–0.08 from 0.72–0.88); backdrop-filter preserved for frosted glass
- Occasional shimmer glitch: diagonal light sweep (`::before`) + outward glow pulse (`box-shadow` animation) on 22s cycle, fires at 84–93%
- `🃏` joker button in footer opens Anti-Gimmick Principles modal (`VibePhilosophy`) — 6 principles from the Jun 27 learn digest (strip to minimum, progressive disclosure, dark by default, ritual aesthetic, sound follows symbol, page-turn pace)

## Jun 26 2026 — v0.1.0 released to vibe.obfusco.us

- Merged dev/v0 → main, tagged v0.1.0
- Includes: fire sound, water/fire types, gentler wind, real celestial globe, I Ching elemental section, planetary frequency visualizer, QR share modal, first-tap presets, and more

## Jun 25 2026 — Brighter stars + planetary visualizer overlay

- Globe stars: radius 2.7−0.42m (was 2.1−0.45m), alpha 1.08−0.20m (was 0.92−0.21m), limb fade power 0.20 (was 0.38), twinkle ±0.16 (was ±0.12); bright stars (mag<1) get a soft glow halo
- Planetary symbols (☉☽☿♀♂♃♄♅♆) fade onto the edge of the circular frequency visualizer when any active noise frequency is harmonically close to a Cousto planetary frequency (octave-invariant, ±280 cents)
- Symbols positioned at the planet's current ecliptic longitude (mean motion from J2000.0 + live clock)
- Source: tone_science memory (Cousto Cosmic Octave frequencies); Sun=126.22 Hz, Moon=210.42, Mercury=141.27, Venus=221.23, Mars=144.72, Jupiter=183.58, Saturn=147.85, Uranus=207.36, Neptune=211.44

## Jun 25 2026 — QR streak fix + first-tap preset

- Removed spill drip streaks from QR modal (both behind and on top drawSpills calls removed)
- First tap on the circular display when no sounds are active now starts a curated pleasant preset:
  5 combos (e.g. pink+wind+bell, blue+water+chime, white+earth+gong, pink+fire+birds, blue+wind+gong);
  one picked at random, sounds started, display flashes to confirm

## Jun 25 2026 — 3D revolving celestial globe

- Replaced flat azimuthal sky projection (updated every 60s) with a proper 3D celestial globe rendered every frame
- Stars pre-computed as Cartesian unit-sphere coords from RA/Dec: (x,y,z) = (cos(dec)cos(ra), cos(dec)sin(ra), sin(dec))
- Each frame: 3 rotation passes — sidereal (Z-axis, 1 rev/hour), slow wobble X (±3.1°, 240s), slow wobble Z (±2.2°, 416s)
- Orthographic projection: camera at +Y looking −Y → screenX = cx + X·R, screenY = cy − Z·R
- Globe radius = 1.62× half-diagonal so stars cover full canvas edge-to-edge; back hemisphere (y<0) culled
- Limb darkening: stars fade as depth (y) approaches 0 (visible hemisphere edge), `alpha *= y^0.38`
- Removed geolocation, computeVisibleStars, starsRef/lastStarCalc/canvasSizeRef (no longer needed)
- 56 named bright stars + 130 golden-angle faint fill stars = 186 total; 60–100 visible at any moment

## Jun 25 2026 — Fix QR codes (two bugs)

- Bug 1: gradient pass read from composited canvas (dark bg = all alpha=255) so it colored the entire image, making the QR unreadable. Fix: read raw pixel data from the tmp canvas *before* compositing — only dark QR modules have alpha>0, so the iridescent color applies correctly.
- Bug 2: `btoa()` produces `+`/`/`/`=` chars that corrupt URL query params when scanned. Fix: URL-safe base64 in settings.js (`+`→`-`, `/`→`_`, `=` removed, reversed on decode).
- Also: name label was drawn at y=82% of canvas which overlapped the QR area. Fix: canvas grows by nameH pixels and name is rendered below the QR boundary.
- Error correction lowered from 'H' (30%) to 'M' (15%) for shorter/denser QR.

## Jun 24 2026 — QR share modal

- `◈` button in footer opens VibeQR modal (adapted from ribbon/PresetQR lineage)
- Settings encoded as compact base64 JSON (noise: on/vol/freq; tones: on/vol/typeAngle|rate) appended to URL as `?v=`
- Iridescent QR canvas: swirling spiral gradient using active sound glow colors (falls back to deep-space palette); spill drip edges; edge glow; name label burned into QR
- Name input updates QR live; name added to URL as `?p=`; `⚡` button reshuffles gradient
- Copy link / save PNG actions
- On page load: if `?v=` present in URL, decodes settings and starts matching sounds automatically
- `src/utils/settings.js` — encodeSettings / decodeSettings utilities

## Jun 24 2026 — Richer background wash + trigram labels

- Background: primary aura boosted (0.12 base + 0.34×energy vs 0.04 + 0.18); gradient radius widened to 0.72× max dimension
- Added a slow orbiting secondary wash that drifts off-center and cycles through sound colors at a different rate (9s vs 3.5s), creating a residual color field across the whole canvas
- Elemental slot labels: each trigram now shows its I Ching name (li / kan / xun / zhen / kun / qian) below the SVG; switches at the morph midpoint (morphT=0.5), lit in the element's color when on

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
