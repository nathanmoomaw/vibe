# DEVLOG — vibe

## Aug 25 2026 (3) — stop button 4x, redder shimmer, hover reveals a mute glyph

- **Stop-all button (`.unit__stop-all`) rebuilt as an inline SVG** instead of the bare "□" text glyph — needed to fit a second icon inside it. At rest it's the same outline square, now 4x the size (2.8rem, up from a ~0.7rem glyph) and recolored: the slow `stop-outline-shift` color-cycle moved off the gold/blue/amber console palette onto an all red/orange range, so it reads as "stop" even before hover, plus a new `stop-shimmer-pulse` glow-pulse animation layered on for actual shimmer motion at rest
- **Hover now swaps in a monochrome muted-speaker glyph** (speaker body + diagonal strike-through, both `stroke: currentColor`) inside the square via an opacity crossfade, rather than just brightening the same empty square — makes the mute affordance explicit on desktop hover
- One CSS gotcha carried forward from the original comment: `filter` is now *also* animated at rest (the new shimmer-pulse), so the hover rule's `filter` override needed `!important` too, same reasoning as the pre-existing `color !important` — a paused CSS animation's frozen value still outranks a plain author declaration at any specificity
- Verified visually via Playwright screenshots at rest and on hover: rest shows a larger reddish pulsing outline square, hover shows the same square with a clean monochrome mute icon inside, in bright red

## Aug 25 2026 (2) — QR landings actually play sound now, screen wake lock while playing

- **QR-scan landings weren't playing any sound.** The `?v=` decode effect (`App.jsx`) called `startNoise`/`startTone` directly from a mount-time `useEffect` — but a bare page load from a QR scan carries no real user gesture, so that hit a suspended `AudioContext` and silently produced nothing. Root-caused after the user's own hunch ("prolly the browser audio interaction thing")
- Fixed by no longer starting audio from that effect at all: it now stashes the decoded config (`pendingLandingRef`) and shows a new `VibeQRLanding` component instead — a half-opacity re-render of the same QR (reusing `VibeQR.jsx`'s exported `drawVibeQR`) with a "vibe" button underneath. A click anywhere on it (the button or the backdrop — no `stopPropagation`, so both fire the same handler) is a genuine gesture, and that's what actually calls `startNoise`/`startTone` (`handleQrLandingStart`). No rename/copy/save controls, unlike the full `VibeQR` share modal — just the QR and the one button, per spec
- Caught one aliasing bug before shipping: the first draft stashed `decoded` in the ref and then mutated `decoded.noise`/`decoded.tones` in place to build the paused landing state, which silently zeroed out the very on/off flags `handleQrLandingStart` needed to read later (same object, shared by reference). Fixed by building separate fresh `pausedNoise`/`pausedTones` objects instead of mutating `decoded`
- The `play=0` obfusco.us handoff path is untouched — it never shows this overlay and never attempted autoplay in the first place
- Verified via Playwright: grabbed a real share URL through the app's own "copy link" button, opened it in a fresh page — landing overlay appeared, `stopNoise`-driven UI (stop-all button) stayed hidden until a click on `.vql__btn`, then appeared, confirming playback only starts post-gesture. Separately confirmed a `play=0` URL shows no landing overlay at all, matching prior behavior
- **Also added a Screen Wake Lock while anything's playing** (`audio/engine.js`, `setPlaybackActive`), per a report of audio cutting out on a Pixel 7 "when it sleeps or just about to." Requests `navigator.wakeLock.request('screen')` when playback starts, releases it when playback stops, and re-acquires on `visibilitychange` if playback is still active (wake locks auto-release whenever the tab is hidden). This only prevents the screen's own inactivity timeout — it can't stop a manual power-button lock or an app switch — so it's additive to the existing keep-alive-audio + Media Session background handling, not a replacement for it

## Aug 25 2026 — geolocation prompt no longer fires on page load

- **The location-services dialog was popping up immediately on landing**, before the user had done anything — traced to a mount-time `useEffect` in `App.jsx` (`fetchWeather()`, added to cache weather for randomize gestures) that called `getCoords()`, which reaches straight for `navigator.geolocation.getCurrentPosition` and triggers the browser permission prompt. This is separate from `VibeReading.jsx`'s own `fetchWeather()` call, which is fine as-is since that component only mounts once the user opens the "read your vibe" modal
- Fixed by giving `fetchWeather()` a `precise` parameter (`reading.js`): `precise=true` (the reading flow's default) behaves as before, `precise=false` skips `navigator.geolocation` entirely and goes straight to the IP-based fallback (or the LA default). App.jsx's mount-time cache now calls `fetchWeather(false)` — still gets real-ish coarse weather to bias randomize gestures, no permission prompt until the user actually clicks "read your vibe"
- Confirmed fixed on `dev/v1`; fast-forward merged straight to `main` and pushed to production (no new commits on `main` since the last release, so no merge conflicts), then switched back to `dev/v1` to continue work

## Aug 24 2026 — v1 cut: dev/v1 replaces dev/v0, merged to production

- **Cut `dev/v1` from `dev/v0`'s tip**, per "call this present state v1." Before merging to `main`, merged `main` into `dev/v1` first so nothing from the Aug 19 `play=0` production hotfix (`0212b68`) got orphaned — it turned out `dev/v0` already carried the same change independently (`03d31ab`, a separately-hashed commit with identical content, likely applied twice rather than cherry-picked once), so the merge was nearly trivial. One real conflict: `main`'s `startNoise(id, volume, freq)` call was a stale 3-arg form from before `startNoise` gained a `typeAngle` parameter — resolved in favor of `dev/v0`'s current 4-arg call (`startNoise(id, volume, typeAngle, freq)`, matching `audio/noise.js`'s live signature)
- `main` then fast-forward merged from `dev/v1` cleanly (42 files, the full backlog since the last direct-to-main hotfix) and pushed to production
- `CLAUDE.md`'s Git Workflow section updated: `dev/v1` is now the active dev branch (autodeploys to vibe-dev.obfusco.us via the existing `dev/**` wildcard in `.github/workflows/deploy.yml` — no CI changes needed), `dev/v0` retired but left intact on GitHub as history, not deleted
- Switched back to `dev/v1` to continue work, per instruction

## Aug 19 2026 (3) — footer icon glow, sparkle turned up

- **Footer buttons (reading/presets/qr) get a permanent subtle glow**, not just on hover — each carries its own low-key `drop-shadow` in its accent hue (purple for reading, amber for presets matching the presets-modal pill, blue for qr matching the QR modal's own accent), still brightening further on hover as before. First pass (4px blur, ~0.22 alpha) was confirmed via computed-style check to be applying, but read as essentially invisible in a screenshot — bumped to 6px blur / ~0.45-0.55 alpha base, ~8px / ~0.7 on hover, until it actually reads as a glow rather than a rounding error
- **Yesterday's idle footer sparkle (Aug 19 (2)) turned up** per "increase their sparkle by a bit": cycle durations shortened (15/18/21s → 10/13/16s, so each button's sparkle fires noticeably more often) and the peak itself bumped (opacity 0.9→1, scale 1→1.15, glyph size 0.5rem→0.6rem) — still idle-only (`.unit--silent`) and still staggered so the three don't flash in sync

## Aug 19 2026 (2) — footer sparkle, tooltip renames, IP-geolocation fallback, reading entropy, AQI

- **Footer buttons (reading/presets/qr) now get an occasional tiny ✨ badge** while idle — a single small sparkle per button (not a particle field) on its own long, staggered animation cycle (15s/18s/21s, offset delays) so the three never flash together, gated to `.unit--silent` so it only shows before anything is playing. Verified via computed-style check: `animationName` is `footer-sparkle` while idle and `none` once a preset is playing
- **Footer tooltips renamed**: "Your vibe reading" → "read your vibe", "Presets" → "prescriptions", "Share / QR code" → "qr / share"
- **Circle-viz "how to use this" tooltip nudged down 3px** (`.unit__ring-tip`'s `top` offset 10px → 13px)
- **Geolocation was already gated behind the reading button** (`getCoords()` only ever runs from `VibeReading`'s mount effect, which only mounts when `showReading` is true) — the real gap was what happens on denial. Added an IP-based fallback (`ipapi.co`, no key) in `reading.js`: denied/unsupported geolocation now tries IP-coarse location before falling back to the hardcoded LA default, so a declined permission prompt still gets a real-ish reading instead of always defaulting to LA. Verified via Playwright with a context granted zero permissions (denies the geolocation prompt): reading still resolved with 3 narrative lines, no hang or error
- **Readings now vary between immediate back-to-back re-reads**: the seed was `hour-fraction + weather-entropy`, both of which barely move within seconds of each other — same moon state, same time period, same weather meant byte-identical narrative lines. Added a module-level call counter mixed in via a golden-ratio low-discrepancy step (`(callCount * 0.618...) % 1`), so consecutive calls land on well-spread, always-different seed values regardless of wall-clock proximity — verified 3 consecutive `buildReading()` calls with identical inputs produced different line combinations each time. The moon/time/weather-driven *sound config* itself is untouched by this — only the narrative line picks, matching "conditions barely changed" rather than re-rolling the whole reading
- **Air quality now factors into readings**: `fetchWeather()` fetches Open-Meteo's air-quality endpoint (US AQI) alongside the regular forecast; when AQI is above 100 and wind isn't already active from a more specific weather match, a clearing wind undertone gets added with a reason naming the actual AQI value — poor air quality now visibly shapes the reading rather than being silently ignored

## Aug 19 2026 — nameplate gets its own rainbow drift, 2 roadmap items logged

- **"vibe" and "freq gen" each get a slow, independent rainbow drift**: both were flat-tinted text (`.unit__brand`/`.unit__model` in `App.css`); replaced with a low-alpha gradient-text animation (`background-clip: text` + animated `background-position`) at different periods and opposite directions (24s / 33s reverse) so the two never visibly sync into one shared cycle. Kept deliberately subtle at rest — low alpha (0.5 / 0.28) matching the labels' existing dimness — then `saturate()`/`brightness()` bump plus a shorter `animation-duration` on `.unit__nameplate:hover` for both, per "increase a bit on hover." Verified via Playwright: zoomed screenshots at rest vs. hover show a visible hue shift and brightening on both labels; separately confirmed the nameplate's click handler (full reroll) still fires correctly and produces a genuinely different active-channel set, unaffected by the styling change
- **Two items logged to ROADMAP.md instead of implemented** (both prefixed `roadmap:` in the dump, which isn't one of `dump-route.py`'s recognized prefixes so they landed as plain items — routed by hand): a call-to-action prompt for when a shared vibe link opens from obfusco.us's portal (settings decode but nothing auto-plays), and a substantial future "hexagram divination mode" spec (two trigrams drawn line-by-line via user clicks, changing-line handling, dual-hexagram switching) that needs its own design pass before implementation
- Also cleaned up a stray `obfusco.us` dev server left running on port 5173 from spec 18's investigation, which was silently swallowing vibe's own `npm run dev` port binding during this session's Playwright verification

## Aug 18 2026 (6) — misfiled batch reverted

- **A batch of 5 DUMP items (row expand/contract speed, meditating-hand alignment, pill confetti, pill text rotation, panel expand animation) turned out to belong to the obfusco.us project**, not vibe — they describe obfusco.us's own floating "vibe pill" portal widget, a different component from anything in this repo. 4 of the 5 had already been implemented and pushed here before the mismatch surfaced; reverted that commit (`e79b1ff` → `7429d02`) and moved all 5 items over to `obfusco.us`'s DUMP.md (including copying the two referenced screenshots into that project's `screenshots/` folder, since they'd been pasted into the wrong dump alongside the misfiled text)

## Aug 18 2026 (5) — console text no longer selectable

- **Dragging across the console (nameplate, row labels, hint text) was highlighting text like a webpage**, screenshotted mid-drag-select spanning "vibe / freq gen" through the row labels — a side effect of this week's new click targets there (row randomize, full reroll) making that area more mouse-active than before. `.unit` (the whole console) gained `user-select: none` / `-webkit-user-select: none` in `App.css`, matching the same property `.slot`/`DualKnob` already carry. Scoped to `.unit` specifically (not the whole page) so it doesn't reach the separate overlay modals (QR, presets, reading) sitting outside it. Verified via Playwright: a mouse-down-drag-up spanning the nameplate to the tone row label now selects nothing (`window.getSelection().toString()` empty), while the QR name `<input>` — a real form control, exempt from an ancestor's `user-select:none` by spec — still selects/edits normally

## Aug 18 2026 (4) — QR name gets a proper outline for contrast

- **Glow alone wasn't enough contrast once the veil was gone** — a glyph landing over a similarly-hued patch of the gradient could still wash out. Added a real outline pass in `VibeQR.jsx`: `ctx.strokeText` with a near-black stroke (`rgba(0,0,0,0.92)`, width scaled to font size) drawn around each character before its gradient fill+glow, so every glyph gets guaranteed separation from the pattern regardless of what color happens to sit behind it — independent of the glow, which stayed as a secondary effect rather than the only contrast mechanism. No veil, no border box, no plate — this is purely a per-glyph outline, distinct from all three things already explicitly removed this session. Re-ran the same `jsqr` sweep (14 names × 2 seeds) to confirm scannability held; it did

## Aug 18 2026 (3) — QR name: veil gone, distortion pushed further

- **Dropped the jagged dark veil behind the QR name entirely** — letters now sit directly on the iridescent pattern with no backing wash at all, legible only through their own glow. Doubled down on the glow to compensate (shadowBlur 5→8, drawn twice per character to deepen it) since it's now the only thing separating text from the busy pattern behind it. Per-character rotation/scale/skew/wave ranges all widened too (rotation ±6°→±11°, close to puddle's own ±12° now instead of half of it) per "distort the letters a bit more." Area budget, font-shrink loop, and the `Q`-level error-correction bump were untouched — removing the veil doesn't change how many pixels the text itself covers, so re-ran the same `jsqr`-via-Playwright sweep (14 names × 3 restyle seeds this time) purely to confirm nothing regressed, and nothing did

## Aug 18 2026 (2) — QR name plate: no border, squiggly per-character warp

- **The QR name plate's straight rounded-rect border and flat straight-line text read as a plain box, not "captcha style"** — went and looked at how puddle's `PresetQR.jsx` (same lineage) already does this, per the request to match it (toned down). Two changes in `VibeQR.jsx`: (1) the plate is now a jagged closed polyline with per-vertex jitter instead of a stroked rounded rect — no straight border edge anywhere; (2) each character renders individually with its own small random rotation (±~6°, half of puddle's ±~12°), scale, skew, and a shared per-line sine wobble on the baseline, using the same seeded `rng()` already driving the spill streaks so a given name+seed always warps the same way. Kept the text near-full opacity (unlike puddle's deliberately-faint 0.55-0.75 alpha watermark) since this needs to actually read clearly, not just add texture — "less distorted" was about the geometry, not the legibility. Re-verified scannability wasn't disturbed by the shape/warp change: same `jsqr`-via-Playwright sweep as yesterday (13 names × 2 restyle seeds each) all decoded clean

## Aug 18 2026 — row-click deactivate, focussing gains earth, QR captcha plate, more glitter, 2 new bloom shapes

- **Row background click now toggles both ways**: previously clicking empty row space only did something when the row was fully inactive (curate a random start); clicking an already-active row's background did nothing. `randomizeRow()` in `App.jsx` now checks for active members in the row first and, if any exist, stops them all instead of falling through to the curate branch — symmetric on/off gesture. Also dropped the now-redundant `noiseRowInactive`/`toneRowInactive`/`elementRowInactive` flags that only existed to conditionally show a pointer cursor — the row background is unconditionally actionable now, so the cursor is too. Verified via Playwright: applying a preset then clicking each row's label in turn correctly dropped that row's active channels one row at a time
- **Focussing preset gained an earth/loam layer** (pink 7% + wind 16% breeze, unchanged, plus earth 13% loam) per a hand-tuned reference screenshot — matches the pink+wind-only combo from yesterday's rebuild almost exactly on those two values, just adds a grounding layer on top. The pink+wind-only version is kept as a commented-out fallback directly above the live one in `presets.js`, per "save the other preset for future reference"
- **QR name now renders INTO the code itself**, not as a caption below it — first attempt (tinting only already-dark QR modules wherever the name's glyph mask landed, so module presence/absence — what a scanner reads — never changes) turned out too fragmented to actually read once diced by the QR's ~50% module density. Replaced with the standard "logo in the middle of a QR" technique instead: a translucent rounded plate over the code's center, holding fully legible gradient-colored text, sized via an explicit pixel-area budget that shrinks the font (down to a floor) until the plate stays small. This needed a genuinely empirical pass, not just reasoning about it — installed `jsqr` temporarily (`npm install --no-save`, never touched `package.json`) and scripted decode attempts against the live component in Playwright. Two things only showed up that way: an initial ~20%-area plate broke decoding outright even at error-correction level M; and bumping to level H (~30% recovery) to compensate broke decoding for very short names independent of the plate entirely (a `qrcode`/jsQR interaction at low QR versions, still unexplained) — level Q (~25%) sidestepped that. Landed on Q + an 11%→6% area budget, swept ~13 names (empty, 1-char, unicode, exactly the 36-char max, multiple restyle seeds each) and all decoded clean before calling it done
- **Sparkle and falling-glitter density both bumped again** (base spawn chance roughly doubled for each, plus an occasional 2-at-once burst) per repeated "more glitter/shimmer" feedback in `Background.jsx`
- **Two new ripple bloom shapes**: `drawFlowerLotus` (rounded overlapping petal blobs, softer/fuller than the existing rose-curve `drawFlower`) and `drawFlowerDaisy` (thin tapered outline-only petals, airier). Fire now uses lotus, chime now uses daisy — the rest of `SOUND_SHAPE`'s mappings are unchanged

## Aug 17 2026 (3) — nameplate is now a full reroll, not a jitter

- **Nameplate click and ring tap had become identical** since the earlier same-day change wired both to `randomizeActive`/`randomizeFirst` — per request, they need to diverge: the ring keeps jittering only whatever's presently active (unchanged), while the nameplate ("vibe" / "freq gen") should reroll everything. Added `randomizeAll()` in `App.jsx`: stops every currently-playing channel (also clearing any pending astro-isolation snapshot, same as `stopAllSounds`), then calls `randomizeRow()` for all three rows unconditionally via a new `force` param that skips its usual "only if this row is fully inactive" guard. Nameplate's `onClick` now just points at `randomizeAll`. Verified via Playwright: applied the calming preset (pink+bell+water), tapped the ring — same three channels stayed on, only their volumes/rates jittered — then clicked the nameplate — a different channel set came up (pink+blue noise, bell, wind), confirming a genuine reroll rather than a jitter

## Aug 17 2026 (2) — row-click dead zones, isolated-sign ring, focussing rebuilt again

- **Row-click randomize had dead zones**: the earlier same-day fix wired `onClick` to each `<section className="unit__section">`, which covers the gaps *within* a row (between cards, between the label and the grid — confirmed working via direct pixel-coordinate clicks). What it didn't cover: `.unit__body`'s own `1.1rem/1rem` padding above the first row and below the last, plus its `1rem` flex `gap` *between* rows — all outside any individual `.unit__section`'s box, so clicks landing there hit `.unit__body` with no handler at all and did nothing. Added `onBodyClick` in `App.jsx`: skips if the click is inside a `.unit__section` (that row's own handler already deals with it) or a `.slot`, otherwise measures distance from the click's Y to each of the three section rects and routes to whichever is nearest. Verified via Playwright: clicks in the top padding, between tone/element rows, and in the bottom padding each correctly triggered their nearest row's randomize; a direct slot click still only toggles that one slot (no double-fire)
- **Isolated astro sign now gets a visible ring**, not just silence: isolating previously only had an audible effect — the glyph itself rendered exactly like a normal (non-hovered) fade-in, no visual cue that it was the one thing playing. Added an `isolatedPlanetRef` (mirrors `isolatedPlanet` state into the canvas draw loop, same pattern as `hoveredPlanetRef`) and a slow-pulsing cyan ring (`performance.now()`-driven sine, radius/opacity breathing) drawn around the glyph whenever it's the isolated one, plus full alpha regardless of fade — distinct from the amber hover glow so "this is locked in" reads clearly. Verified visually via Playwright screenshot: ring renders around the isolated glyph
- **Focussing rebuilt again** — still reported "too pulsy and hissy" after the earlier same-day pulse-depth cut. Went back to the project's own acoustomancy reference (`~/.claude/projects/.../memory/acoustomancy.md`) instead of guessing further: consonance law #3 there calls for a *pink* (1/f) noise layer specifically, and blue is inherently brighter/highpassed by design — no amount of octave/volume tuning was going to stop it reading as hissy, so dropped blue entirely in favor of pink at the Wood note (640Hz). Also dropped the chime accent: a periodic percussive strike every ~10-30s is arguably what "too pulsy" was actually describing, distinct from the amplitude-LFO pulse — focussing is now a pure held drone (pink + steady breeze, no periodic element at all). `pulseHz` moved from a guessed-low 8.5 into the reference's documented Focus binaural target (Alpha 10-14 Hz), landing at 10. This is a qualitative audio judgment call that can't be screenshot-verified — worth a listen

## Aug 17 2026 — row-click randomize, astro-sign isolate/restore, falling glitter, preset polish

- **Click empty space in a fully-inactive row (noise/tone/element) to randomly curate a start for it**, instead of having to hand-pick a slot — same "pleasant" bias `randomizeFirst()` already uses (Wǔ Yīn-ish frequencies via each channel's `filterDefault` ± `COARSE_TUNE_PCT` jitter, named not blended elemental types, subtle starting volume). New `randomizeRow()`/`onRowClick()` in `App.jsx`, wired to each `<section className="unit__section">`'s `onClick`; guards against slot clicks (`e.target.closest('.slot')`) so a slot's own toggle is untouched, and no-ops once anything in that row is already on. Verified via Playwright: clicking the "tone" row label with nothing active turned on 2 tone slots with plausible volume/rate; clicking an active row's label (or a slot directly) does nothing extra
- **Astro-sign click now isolates that sign's channel, click again to restore**: clicking a planet glyph in the circle viz used to only show its info tooltip. It now also toggles between hearing *only* the noise channel that's actually tuned close to it (same match the glyph's own fade already computes via `planetFade`) and restoring the full prior mix — snapshotted once into a ref on first isolate, applied back exactly on the matching second click; clicking a *different* sign while isolated switches the target without re-snapshotting, so hopping between signs and back still restores the true original mix. `toggleIsolatePlanet()` in `App.jsx`; `stopAllSounds` also clears any pending isolation snapshot since it'd otherwise go stale. Verified end-to-end with Playwright: applied a preset with a second unrelated noise channel added on top, clicked the resulting glyph (silenced everything but the matching channel), re-located the glyph (its on-screen position shifts because the console reflows height when rows go inactive — a pre-existing layout quirk, not something this feature caused) and clicked again — all four original channels came back at their exact original volumes/rates
- **Falling glitter pass added to the background sparkle system**: the existing "selfie-filter" sparkle overlay pops glints in place at random screen positions; added a second `glitters` array in `Background.jsx` that spawns similarly-styled glints around the console/ring footprint and lets them drift downward with a light gravity accel (`vy` + `5·dt²`) before fading, reading as glitter shaken loose off the console rather than popping in place
- **Audio input hidden for now** (needs a fine-tuning pass) — same pattern as the Jul 10 party/lo hide: removed the ⊃ footer button from `App.jsx`'s render only; `showInput`/`inputUrl`/`playInputUrl`/`stopInput`/the input panel JSX are all untouched and simply unreachable. Roadmap entry added
- **Preset pass**: calming's exact knob settings brought in line with a hand-tuned reference screenshot (pink 6%→3% volume + typeAngle pushed to 180/fully-brown so "Metal-toned" becomes a deep brown hush per the reference, water 20%→26% ocean, bell 18%→36% volume and rate 32→31s) — required actually wiring preset-specified `typeAngle` through `applySoundState` in `App.jsx`, since presets previously only ever set volume/freq and silently left color-blend/type alone even when a preset object specified one. Pulsing cut two ways: the shared amplitude-LFO depth in `audio/noise.js` (`setNoisePulse`) dropped from ±8% to ±4.5% (affects every preset), and focussing's own `pulseHz` dropped from 12→8.5 (still alpha/SMR range, was the pulsiest by far). Continuous elemental generators (wind/water/fire/earth in `audio/tones.js`) each gained a slow secondary "wobble" oscillator on their existing modulation LFO's own rate — two incommensurate sine rates summed together have an effective combined period far longer than either alone, so the modulation reads as organic rather than visibly looping, without introducing an unbounded random walk (matches the existing noise-color drift philosophy). Preset hover in `VibePresets.css` "polarized" per request — swapped the muted `grayscale(0.5)` hover treatment for full color + higher saturation, so hover reads as a clear on/off pole instead of a half-step
- **Nameplate ("vibe / freq gen") now also triggers the tap-to-randomize gesture**, with a pointer cursor, matching the ring's own tap behavior (jitter if anything's on, curated first-preset if not)
- Verified the whole pass with Playwright against the running dev build: build + lint clean (only pre-existing unrelated errors/warnings), calming preset screenshot-matched pixel-for-pixel against the reference, row-randomize and astro-isolate/restore both exercised end-to-end with real state assertions, zero console errors throughout

## Aug 4 2026 — background-audio keep-alive, celestial/weather-biased randomize

- **Mobile "gets skippy in background" was re-reported after the Jul 14 CPU fix** (lazy paired-color chains + `visibilitychange` resume), so the root cause was still open. Found it: `bell`/`chime`/`gong`/`birds` schedule their next strike with a plain `setTimeout` (`audio/tones.js` `scheduleNext`), not the Web Audio clock. Backgrounded mobile tabs — iOS Safari in particular — throttle or freeze that timer once the page isn't recognized as an active media session, so strikes queue up and fire in a stuttering burst on return. Added a background-playback keep-alive to `audio/engine.js`: a silent looping `HTMLAudioElement` (a hand-built 1s/8kHz/8-bit silent WAV via Blob URL, no external asset) plus a registered `navigator.mediaSession` (metadata + playbackState + pause/stop action handlers wired to the app's existing `stopAllSounds`). This is the standard technique PWAs use to get the OS/browser to treat the page as genuine background audio rather than arbitrary background JS, which is what keeps `setTimeout`-scheduled tone triggers running on schedule instead of frozen. Wired via two effects in `App.jsx` keyed on `anyOn`/`stopAllSounds`. Verified the app still loads, toggles sounds, and produces zero console errors with these changes (headless Playwright smoke pass); true backgrounded-tab timer behavior isn't observable from this environment and is worth confirming on a real device
- **Randomize now leans toward present conditions instead of pure noise**, per request: "the mood created should compliment and expand the present conditions." `randomizeActive()` (tap-to-jitter while playing) now applies the same tide bias `buildReading()` already uses for the Vibe Reading feature — `utils/reading.js` gained an exported `weatherElement()` — volume and frequency jitters shift with tide height (`tidalHeight`), jitter range widens at spring tide and narrows at neap (`tidalSpring`), and whichever elemental tone matches the (session-cached, fetched once on mount) current weather gets a small volume boost instead of jittering blind. `randomizeFirst()` (first-tap curated preset) now leans 2-in-3 toward whichever of the 5 presets' elemental tone matches the present decan's tarot suit (wands→fire, cups→water, swords→wind, pentacles→earth) rather than picking uniformly at random. Verified via headless Playwright: toggling one channel on and tapping the display canvas jitters only that channel's volume, doesn't spuriously activate others, and throws no console errors

## Jul 24 2026 (2) — stop button red hover, tooltip fade 900ms, preset redesigns

- **Stop button hover wasn't reliably red**: its `color` cycles through gold/blue/amber via a 16s keyframe animation, and hover previously just paused the cycle and brightened whatever color it landed on (`filter: brightness()`) — never actually red, so it didn't read as a stop control on hover per feedback. A plain `color` override in the `:hover` rule is silently beaten by the animation's frozen value at any specificity, but `!important` outranks the animation origin itself — added `color: rgba(255, 90, 70, 0.9) !important` to `.unit__stop-all:hover` in `App.css`, keeping the brightness/drop-shadow lift alongside it. Verified via computed style: hover color is now exactly that red regardless of where the cycle was paused
- **Tooltip fade still read as too fast**: bumped `useFadeVisible`'s default `exitMs` and the matching `.unit__planet-tip`/`.unit__ring-tip` CSS transition from 450ms to 900ms. Before touching more code, checked whether the fade-in was actually a *duration* problem or something more structural — a busy-page test showed opacity already at 1 within ~100ms nominal, which looked like the single-`requestAnimationFrame` enter trick snapping instead of easing. Isolated on a fresh page load, though, the same hover produced a clean graduated curve (0 → 0.18 → 0.64 → 0.90 → 1 across ~900ms) — the earlier reading was test-harness overhead (several `$eval` round-trips stacking real latency ahead of the nominal wait), not a product bug, so left the mechanism alone rather than "fixing" something that wasn't broken
- **Focussing preset redesigned** — "sounds like a spurty garden hose, too brash." The old combo (blue noise highpassed at only 1280Hz + a 60°/gusty "gale" wind) left too much midband hiss and gustiness. New combo in `presets.js`: blue's highpass corner raised an octave to 1920Hz at lower volume (thinner, less hiss), wind swapped from gale to a steady 0° breeze, and a small crisp chime added for the "alert clarity" the blurb promises. This one's a qualitative audio judgment call I can't screenshot-verify — worth a listen
- **Dreaming preset**: water's volume/type brought in line with the user's own hand-tuned reference screenshot — 0.14→0.08 volume, typeAngle 180→240 (unambiguously "ocean" rather than sitting exactly on the rain/ocean label boundary). Blurb updated from "soft rain" to "a soft ocean swell" to match
- **Floating preset rebuilt** to match a second reference screenshot — pink 0.04→0.09, chime 0.15→0.38 (rate unchanged at 40s), water dropped entirely, birds added new (0.26, rate 55s), wind added new (0.09, breeze). Verified pixel-for-pixel against the reference: applying the preset in a live page and reading back each slot's displayed %/rate matched the screenshot exactly

## Jul 24 2026 — slower tooltip fade, preset emoji refresh

- **Tooltip fade was still too fast**: yesterday's fade-out fix used a 180ms transition/unmount delay, apparently still read as an abrupt flick rather than an ease. Bumped both to 450ms (`useFadeVisible`'s default `exitMs` in `App.jsx`, and the matching `transition: opacity` duration on `.unit__planet-tip`/`.unit__ring-tip` in `App.css` — kept in sync since the JS timeout controls how long the element stays mounted and must not cut the CSS transition off early). Verified by sampling computed opacity at 100ms intervals through a full hover-in/hover-out cycle: opacity now ramps smoothly across ~450-500ms in both directions instead of snapping
- **Preset emoji refresh**: calming 🕊️→🌙, relaxing 🍵→🕯️, focussing 🎯→🧲, meditating 🧘→🪬, dreaming 💭→🪽, floating 🪶→🫧. The hamsa (🪬) needed to read as facing downward, which Unicode has no separate codepoint for — `preset()` in `presets.js` gained an `emojiFlip` flag (only meditating sets it), and `VibePresets.jsx` applies `transform: rotate(180deg)` to that card's emoji span when set. Verified all six glyphs render (not tofu boxes) and the hamsa's computed transform matrix confirms the flip

## Jul 23 2026 (3) — tooltip fade-out, audio input silent with no active channel

- **Circle viz tooltips only faded in, not out**: both the planet-glyph tooltip and the new ring function tooltip used a one-shot `animation: ... forwards` that ran on mount and vanished instantly on unmount (React removed the DOM node the moment `hoveredPlanet`/`ringHover` went false — no time for a fade). Added a small `useFadeVisible(value, exitMs)` hook in `App.jsx`: it keeps the last non-null content mounted for `exitMs` (180ms) after the value goes null, toggling a `--visible` class that now drives opacity via a plain CSS `transition` instead of a keyframe. Both tooltips route through it; verified via computed-style sampling that opacity ramps 0→1 on entry and the element stays mounted (opacity easing down) for ~180ms after the pointer leaves before actually unmounting
- **Audio input played unfiltered at full volume when nothing was on**: `engine.js` treated an empty filter bank (no noise/tone channel active) as "connect straight through" — the opposite of the feature's whole premise, which is playing the input *through* the active channels. `setAudioInput`/`updateAudioInputFilters` now mute the input's gain node (`out.gain.value = 0`) instead of connecting it directly when `filterConfigs.length === 0`, so there's silence until at least one channel is on. Verified by monkeypatching `AudioParam.prototype.value` in a live page to log every gain assignment: submitting a URL with nothing active logs `0` (never the old `0.75`), and turning on a noise channel afterward immediately logs `0.75` alongside that channel's matching filter frequency/Q — confirming the input goes from silent to audible-through-the-filter exactly when a channel activates

## Jul 23 2026 (2) — preset volume rebalance, astro-glyph clipping fix, ring function tooltip, QR button overlap

- **Preset volumes/rates felt too hot for "calming"**: rebalanced `presets.js` — tone volumes trimmed roughly 15-20% across all 6 presets (meditating's gong was the loudest single sound at 0.30, now 0.22; calming/relaxing/focussing's wind/water/bell/chime all pulled down similarly), and relaxing's chime rate raised from 14 to 22 (it fired every ~7-22s, the fastest cadence of any preset — read as busy rather than relaxed next to everything else's slower pacing)
- **Astro-body glyphs clipping at the ring's edge on hover**: the glyph anchor radius (`pr = maxR + 9` in `App.jsx`'s canvas draw loop) left only ~3 canvas units of headroom before the circular clip boundary, and hover's 1.55× font magnification (up to ~28px) plus an 11px shadow blur pushed well past it. Pulled `maxR` in from `cx*0.88` to `cx*0.8`, `pr` from `maxR+9` to `maxR+6`, hover magnification from 1.55× to 1.3×, and hover shadowBlur from 11 to 7 — verified by reading the canvas's raw pixel data before/after: glyphs now peak at ~97 units from center even while hover-magnified, safely inside the 100-unit clip radius
- **Circle viz function tooltip**: hovering the ring away from any astro glyph (and not mid-drag) now shows a small popover — tap/randomize, up-down/volume, left-right/rate, each with a plain-text monochrome icon (●/↕/↔, styled via CSS not emoji, so they inherit the accent color like everything else). New `ringHover` state + `.unit__ring-tip` in `App.jsx`/`App.css`, styled to match the existing planet-glyph tooltip so the two custom popovers read as one system; mutually exclusive with the planet tooltip and suppressed while dragging
- **QR modal's × and ⚡ buttons overlapped the QR canvas**: `.vqr__modal`'s top padding (32px) was less than the buttons' own footprint (`top:10px` + ~29px tall = bottom at ~39px) — a ~7px overlap onto the canvas underneath. Bumped padding-top to 46px, matching the clearance every other modal gets for free via its title/header row (VibeQR has no header, so needed to add the gap directly)
- Verified all four end-to-end with a scripted headless-browser pass (Playwright driving the running dev build): preset cards show 6 distinct `--vps-hue` values and visually distinguishable hover glows/labels (cyan calming vs. warm-tan focussing vs. lavender meditating); the ring tooltip renders with the expected three rows; a real astro glyph (Mercury, from the calming preset's 576Hz pink noise) was located via direct canvas pixel readback and measured at 97.3/100 units from center while hover-magnified; the QR modal's close/shake buttons measured a clean 6-7px gap above the canvas. No console errors during the pass
- **Aside**: while hunting for a free port for the dev-server check, an `lsof -ti:5173 | kill` swept up an unrelated background dev server for a different project (`obfusco.us`) that happened to already be listening there — it came back up once, then wasn't running anymore by the end of the session. Re-ran vibe's own dev server on a dedicated port (5183) for the rest of the verification to avoid touching 5173 again. Worth restarting that other project's dev server by hand if it's still needed

## Jul 23 2026 — audio-input filters now track live, per-preset hover colors

- **Explained + fixed** (priority item): audio input "not being processed through the enabled frequencies" — the filter bank itself was real (source only reached destination through a BiquadFilterNode per active noise/tone channel), but `playInputUrl` only ever built it once, at the moment the URL was submitted. Turning a knob or toggling a tone afterward had no effect because nothing rebuilt the bank. Factored the filter-config derivation out into `buildInputFilterConfigs()` in `App.jsx`, added `updateAudioInputFilters()` to `engine.js` (rebuilds the parallel filter bank in place — reuses the existing `MediaElementAudioSourceNode` and doesn't restart playback), and wired a `useEffect` keyed on `[noise, tones, inputStatus]` to call it live whenever input is playing
- **Per-preset hover colors**: all 6 presets shared one hardcoded amber hover tint (`rgba(255, 209, 102, …)`) on both the emoji glow and label. Added a muted `hue` value per preset in `presets.js` (calming 195, relaxing 135, focussing 25, meditating 268, dreaming 232, floating 172), threaded through as a `--vps-hue` CSS custom property, and switched `VibePresets.css` to `hsla(var(--vps-hue), 32%, 62%, 0.3)` / `hsla(var(--vps-hue), 30%, 68%, 0.85)` — lower saturation than the old amber so each preset reads as its own muted color rather than one vivid shared tint

## Jul 14 2026 — noise knob color morph, mobile CPU fix

- **Noise knob color now morphs with the color blend**: the slot's `--color`/`--glow` now interpolate (RGB lerp) between the primary and paired color at the same continuous weight driving the audible crossfade, instead of staying fixed on the primary color. `App.jsx` gained `pairColor` per NOISE entry (violet `#c266ff`, brown `#a0522d`, grey `#9aa5b1`) and a `noiseColorAt()` helper; verified the knob's `--color` goes from white's exact rgb to a value approaching violet's as it's dragged
- **Found and fixed the mobile "gets skippy" / high-CPU report**: yesterday's noise color-pairing change unconditionally built *both* colors' full synthesis chain (buffer source, filter, drift oscillator, 2 gains) the instant a channel turned on — for every channel whose color knob is never touched (the common case), that's a silent 2x node count for zero audible benefit. Made the paired chain lazy: it's only built once the crossfade weight actually crosses a small threshold (`PAIRED_WEIGHT_THRESHOLD = 0.02`) in `setNoiseType`/`startNoise`, and stays built for the rest of that session once created (avoids start/stop thrashing right at the threshold). Verified via node-count instrumentation: an untouched channel now creates ~6 nodes instead of ~11; turning the knob lazily adds the other ~5
- **Added a background/foreground AudioContext resume handler**: mobile browsers (iOS Safari especially) can suspend the AudioContext while backgrounded; previously it only resumed on the next unrelated interaction that happened to call `getContext()`, which can read as a jarring catch-up skip. `engine.js` now listens for `visibilitychange` and resumes proactively the moment the page is visible again
- **Explained** (priority item): the freq/rate knob no longer moves noise toward celestial-body frequencies because (1) the knob doesn't touch frequency at all anymore since yesterday's color-pairing change, and (2) tone rate was never wired into that system in the first place — only `NOISE` frequencies ever fed the planet-glyph fade logic
- **Other performance options not implemented, noted for later**: consolidating drift LFOs across chains rather than one oscillator per chain; reviewing the elemental tones' (wind/water/fire/earth) own internal oscillator/filter counts, which weren't touched in this pass; trimming canvas draw-loop cost further (browsers already auto-throttle `requestAnimationFrame` when hidden, so this is lower-priority); adopting the Media Session API so mobile OSes recognize the tab as an active audio/playback context rather than arbitrary background JS, which can affect how aggressively the OS deprioritizes it

## Jul 13 2026 (2) — 3 new noise colors, paired-color knob morph

- **Added brown/red, violet/purple, and grey noise**, bringing the total from 3 colors to 6. Each of the 3 existing channels now continuously morphs into a paired second color as its knob turns, rather than adding 3 new standalone slots — white↔violet (both a bright hiss), pink↔brown (soft hum vs. deep rumble), blue↔grey (edge/clarity colors), per the requested groupings. Brown is a leaky-integrated random walk of white noise (classic -6dB/octave); violet is white noise double-differenced (+6dB/octave, sharper than blue's single difference); grey reuses the white buffer with a downstream peaking cut around the ~2-5kHz region the ear is most sensitive to, approximating perceptual flatness
- **The knob's job changed from frequency to color-blend**: there was no free control surface left on the existing dual-knob (outer ring = volume, inner = frequency) to add a second color per slot, so — after checking with the user on the tradeoff — the inner knob now drives a continuous 2-way crossfade between the pair (same cosine morph formula already used for the elemental trigrams), and each color's own filter frequency became fixed per-color rather than freely user-adjustable. `noise.js`'s `startNoise`/`setNoiseVolume` gained a sibling `setNoiseType(id, angle)`; `App.jsx`'s circular-display drag and the on-slot knob both now write `typeAngle` instead of `freq`
- **Preserving the Wǔ Yīn tuning system was the hard part**: `reading.js`/`presets.js` set specific channels to specific Hz (OM at 136.1Hz on pink, pentatonic notes 512-864Hz, etc) as part of the app's acoustomancy design — repurposing the knob for color threatened to break that entirely. First attempt clamped any tuning target to ±25% of each channel's *default* frequency, which sounded reasonable in the abstract but is wrong in practice: OM's 136.1Hz is nowhere near pink's 900Hz default, so every distinct Wǔ Yīn note would've clamped to the same boundary value and collapsed into one flat pitch — caught this by actually running the real `WU_YIN_HZ`/`OM_HZ` numbers through the clamp function before shipping. Fixed by restoring the original per-channel absolute range (white 200-8000Hz, pink 100-5000Hz, blue 500-10000Hz — the exact bounds the knob used to be limited to) and applying tuning only to the *primary* color, leaving the paired color at its own fixed default; readings/presets keep passing the exact same Hz values as before and every note now passes through unclamped again
- **Known side effect**: noise channels used to be draggable to "find" a planet glyph on the circle viz by ear (the display-drag gesture adjusted frequency, which the glyph-fade logic tracks). Since frequency isn't user-draggable anymore, that specific exploratory interaction is gone for noise channels — readings/presets can still land a channel near a planet's frequency, just not by manual search. Not addressed further since it was an accepted consequence of the knob-repurposing decision
- Verified end-to-end: production build (StrictMode-free) confirms exactly 2 buffer sources per active noise slot (primary + paired chain); all three pairs (white↔violet, pink↔brown, blue↔grey) morph and relabel correctly on a real knob drag; a full Vibe Reading apply flow (which exercises `setNoiseFreq`) runs with zero console errors; QR settings encode/decode round-trips the new `typeAngle` field with old 3-tuple codes defaulting it to 0

## Jul 13 2026 — mobile astro-sign taps, parameter fade-in

- **Astro-sign taps on mobile triggered randomize instead of showing the tooltip**: the circular display's tap handler (`onDisplayUp`) always ran `randomizeActive()`/`randomizeFirst()` on any non-drag tap, regardless of where it landed. On desktop this wasn't obvious because hovering a planet glyph shows its tooltip *before* any click. Touch has no hover — a tap goes straight to pointerdown→pointerup with no intervening pointermove, so a tap on a glyph never got hit-tested at all. Extracted the hover hit-test into a shared `hitTestPlanet()`/`showPlanetTip()` pair and now call it from `onDisplayUp` too: a tap landing within the existing 14px hit radius of a glyph shows its tooltip and skips randomizing; a tap anywhere else behaves as before. Verified with a Playwright script that computed the exact canvas-space glyph position for a visible planet (white noise's default 2000Hz sits ~17 cents from Sun's 16th octave, which was enough to also surface the Moon glyph) and confirmed a real mouse tap on it opens the tooltip instead of randomizing
- **Abrupt parameter start**: turning on a noise channel or a held elemental tone (wind/water/fire/earth) snapped straight to full volume. Both `noise.js`'s `startNoise` and `tones.js`'s continuous-tone branch of `startTone` now ramp gain from 0 to the target volume over 0.5s (`linearRampToValueAtTime`) instead of setting `.value` directly. Left periodic tones (bell/chime/gong/birds) alone — each note already has its own fast attack envelope, which is the correct "hit" transient for a percussive sound and shouldn't be slowed down. Verified by spying on `AudioParam.linearRampToValueAtTime` in a live page and confirming a ramp gets scheduled when a channel is toggled on

## Jul 12 2026 — organic default drift for noise + bell

- **Default organic drift**: sound generation was previously perfectly static once a channel was on — a held noise filter frequency never moved, and the bell tone struck the exact same 440Hz every time (unlike chime/gong, which already randomize per note). Added a slow sine LFO (randomized rate per channel, ~0.015–0.05 Hz, so channels don't wobble in sync) summed onto each active noise channel's filter frequency via `noise.js`'s `startNoise`/`setNoiseFreq`, at a fixed ±3.5% depth of the current freq. Gave `triggerBell` in `tones.js` a ±1.5% random pitch deviation per strike when no explicit freq is passed (chime still passes its own randomized freq and is unaffected). Elemental tones (wind/water/fire/earth) already had internal breathing LFOs on their filters, so left those as-is. Depth/rate are hardcoded for now — added to ROADMAP backlog as a future adjustable setting
- **Drift long-use audit**: checked the new drift against the app's "always kept within enjoyable range" rule (`NOISE`'s `filterMin`/`filterMax` in `App.jsx`). The flat ±3.5% depth could push a channel's peak past its filterMax when the knob was already near the top of its range (e.g. white at 8000Hz could momentarily hit ~8280Hz). Added `driftDepthFor()` in `noise.js`, which clamps the LFO's depth to whatever headroom actually exists on the tighter side of the current freq — drift now tapers to zero right at the knob's min/max and never exceeds the vetted range at any point in its cycle. Separately: since it's a bounded periodic sine rather than a random walk, there's no accumulation risk over long sessions by construction — verified with a script checking the clamp math holds at min/mid/max for all three channels, plus a live browser run confirming no runtime errors

## Jul 10 2026 — audio-input tone filtering, presets modal jump fix, party icon v5, hid mode switch

- **Party/lo mode switch hidden**: removed the `<ModeSwitch>` footer button per request to hide the feature for now. `mode` state stays hardcoded to `'party'` (its existing default); `ModeSwitch`/`LoView` components and the `mode === 'party'` conditionals in `App.jsx` are untouched, just no longer reachable from the UI. See ROADMAP backlog to re-expose later
- **Audio-input filter bank ignored tones entirely**: the input-URL filter bank (`playInputUrl`) only ever built filters from active `NOISE` channels (white/pink/blue) — if a user had only tones on (bell, gong, wind, ...) and no noise channel, `filterConfigs` came back empty and the input played back completely unfiltered. Added a `TONE_FILTER` map giving each tone a representative filter band pulled from its own synthesis (bell/chime/gong bandpass around their pitch, birds a high bandpass, wind/water/fire bandpass around their swept range, earth lowpass), and `playInputUrl` now merges active-tone filters in alongside the noise ones. Verified with a Playwright script that toggled only gong on (no noise) and confirmed a biquad filter node is now created for the input chain (previously zero)
- **Presets-modal jump on the meditating card**: its blurb was nearly double the length of every other preset's one-liner, wrapping to 2 lines against a `.vps__blurb` `min-height` sized for ~1.5 lines, so hovering it visibly resized the modal. Shortened the blurb to match the other cards' length and bumped `min-height` to a full 2 lines as a safety margin for any future long blurb
- **Hovered preset emoji color**: `grayscale(0)` → `grayscale(0.5)` on hover, per request to tone down the "hint of color" treatment
- **Party icon v5**: previous attempts kept reading as sparse/spotty. Redrew as a cone with a bevelled (sharp, non-rounded) tip plus a 4-piece confetti fan spraying from the opening, evaluated by rendering the candidate SVG through `qlmanage -t` and inspecting it as an image before committing to the final path data — first time this icon's been checked visually rather than hand-tuned blind
- **Planet-glyph tooltip text size**: bumped `.unit__planet-tip`/`.unit__planet-tip-name` font sizes up and widened `max-width` to match

## Jul 9 2026 — vignette blur, presets rainbow pill + hover description, tooltip placement fix

- **Whole-scene vignette blur, not per-shape**: the earlier per-ripple `ctx.filter` blur (tuned to ~90px, then ~220px) still wasn't enough and wasn't a true "gradient" — because only the ripple *shapes* were blurred, not the aura wash or starfield behind them. Replaced with a proper vignette technique: each frame, copy the ~290px region around screen-center to an offscreen canvas, blur it, mask it with a radial gradient (full strength through most of the radius, fading at the edge), and composite it back over the sharp scene. Blurs everything drawn near the console's footprint — stars, aura, ripples alike — while staying perfectly sharp outside that radius, with no per-shape tuning needed
- **Custom tooltips are back, underline is not**: turns out the actual complaint two commits ago was the dotted-underline decoration (and the clipping), not custom tooltips as a concept — losing the styled popover for the Vibe Reading labels in favor of native `title` was a regression ("no longer have the nice hover info they were showing"). Rebuilt the same dark styled-box popover for moon/tidal/intent/decan, minus the underline, with `cursor: help` kept as the hover affordance. Corrected the standing memory note on this
- **Planet-glyph tooltip placement**: was centering directly on the hovered glyph, which put the box right on top of the cursor and the thing being read, and clipped against the console's top edge for glyphs near 12 o'clock. Now computes which side (bottom/left/right — never top, since there's far more room below the ring than above it within the console) has the most room and offsets the popover fully to that side instead of centering on the anchor
- **Presets modal**: pill title bumped to 4× size and switched to a dedicated black/white rainbow variant (`PillIcon`'s new `rainbow` prop) — solid black/white capsule halves with the outline traced by a slowly-rotating SVG gradient (`<animateTransform>` on a `<linearGradient>`, no CSS masking needed). Per-card description blurbs are gone; there's now one shared description area under the title that fills in with whichever preset is currently hovered and stays empty otherwise, with reserved height so the modal doesn't resize as it fills in

## Jul 9 2026 — dropped custom tooltips for native title, presets redesign, origin blur

- **Custom tooltip pattern removed**: the `.info-tip` hover-popover utility from earlier today got rejected on sight — the always-on dotted underline looked bad (especially under emoji), and the popovers still got clipped by ancestor `overflow:hidden` in more spots even after the stop-button fix. Reverted the stop button and the Vibe Reading modal's moon/tidal/intent/decan labels to the native `title` attribute, and deleted the whole `.info-tip`/`.info-tip--below` CSS utility since nothing uses it anymore. Saved as a standing preference in memory: prefer native tooltips, or persistently-visible text when there's room, over custom hover popovers
- **Presets modal redesign**: replaced the "presets" text title with a large `PillIcon` (now extracted to its own `PillIcon.jsx` so both the footer button and the modal title share it), widened the modal and switched to a 2-column grid, dropped each card's border/background box, and replaced the hover-tooltip blurb with an always-visible description line under every preset's label. Preset emoji now sit at rest desaturated (`grayscale(0.9)`) and bloom back to full color + a gold glow on hover — the same treatment the 🃏 joker button has used since the philosophy-modal days
- **`.slot` resting background removed**: noise/tone/element cards no longer have a background fill at rest (hover and active-state backgrounds are unchanged) — continuing the "remove background treatment" pass from earlier today onto the individual cards
- **`.unit__divider` removed**: the thin gradient rules between the noise/tone/element sections are gone
- **Origin blur on center-spawned ripples**: with the console background gone, the ripple shapes (halo/flower/star) read as too sharp right where they spawn, directly behind the controls. They now draw with a `ctx.filter: blur()` that's strong at birth (near the console's center) and gradually fades to fully sharp by a ~220px radius, without needing to reintroduce any console background (bumped from an initial ~90px pass that wasn't gradual/wide enough)

- **Stop button hover/tooltip bug**: two separate bugs. (1) `.unit__stop-all`'s hover `color` override was silently ignored — a CSS keyframe animation that's still applied (even paused) always wins the cascade over a plain `color` declaration for the same property, so the intended brighter hover color never rendered. Switched to a `filter: brightness()` boost instead, which isn't animated and always applies. (2) the button itself had `overflow: hidden`, which clipped its own tooltip pseudo-element — a `position:absolute` pseudo-element is still a child of its element in the render tree, so it was being cut away entirely even though it was positioned well outside the tiny button box. Removed the unneeded `overflow:hidden`, and moved the tooltip to render below the button via a new `.info-tip--below` variant (it sits near the top of the console, and `.unit` itself clips overflow, so an above-anchored popover would've been cut off there too)
- **Audio-input filtering bug**: the input-URL filter bank mapped the white noise channel to an `allpass` biquad filter (matching white's own synthesis filter, which is intentionally a no-op — white noise doesn't get shaped by its own freq knob either). But an allpass filter doesn't shape frequency content at all, so pasting a URL while only white noise was active played it back completely unfiltered. Changed the input-filter mapping to blue→highpass, pink→lowpass, white→wide bandpass, so every active channel now audibly shapes the input regardless of which one it is
- **Console background removed entirely**: dropped `.unit`'s background gradient + `backdrop-filter` blur, and `.unit__body`'s faint background tint — continuing the "make it more see-through" trend from Jul 8 to its conclusion. The console is now just border/shadow/content floating directly over the starfield
- **Preset volumes lowered further**: noise channels ~0.10–0.14 → ~0.04–0.07, and the "noisy" noise-buffer-based elemental drones (wind/water/earth) cut by roughly a third; left the percussive/periodic tones (bell/chime/gong) alone
- **Preset fade-in**: selecting a preset now ducks the master gain briefly before the new sounds start, then lets the existing `fadeMaster` ramp back up — previously every preset's sounds snapped in at full volume the instant you tapped a card
- **Pill icon**: filled the left half solid so it reads as an actual two-tone capsule instead of a plain outline
- **Favicon**: added `public/favicon.svg` (the `<link>` in index.html was already pointing at it, but the file didn't exist) — a small radiating spectrum ring (circle viz) + 6-petal rosette (flower) around the Qian ☰ Heaven trigram, three solid gold bars

## Jul 8 2026 — presets grid, info tooltips, vertical row labels, party icon v4

- **Random tone periods**: periodic tones (bell/chime/gong/birds) previously computed one randomized interval at start and then repeated it forever via `setInterval` (a dead `jitterUpdate` closure was defined but never called). Rewrote as a self-rescheduling `setTimeout` chain that draws a fresh random wait — `interval × (0.5–1.6)` — on every single firing, so the cadence never settles into a metronome
- **Party icon v4**: rebuilt as pure strokes (cone outline + 4 separated confetti marks) instead of thin filled slivers, which were smearing into an unreadable blob at the 15px footer size
- **Vertical row labels**: "noise"/"tone"/"element" section labels now sit in a narrow vertical column to the left of each row (`writing-mode: vertical-rl`) instead of stacked above it, reclaiming vertical space and cutting scroll
- **Elemental knob hover fix**: hovering an elemental slot's inner knob showed the same type-name text ("stone") already printed below the dial. Now shows the raw angle (e.g. "132°") instead — new information, not a repeat
- **Circle-viz planet glyphs**: bumped base size, added a hover magnify (font size ×1.55, brighter glow) with hit-testing against the last-drawn glyph positions, plus a hover tooltip describing each planet's energetic quality and Cousto frequency. Moved the canvas's circular clip to a dedicated inner wrapper so the tooltip can escape the ring's `overflow:hidden` instead of being cut off at the rim
- **Info tooltips**: added a reusable `.info-tip` CSS utility (hover popover, dotted underline) and wired it to the Vibe Reading modal's moon/tidal/intent/decan labels — e.g. hovering "cancer II" now explains how that decan's element + ruling planet shape the reading's sound choice
- **Presets grid**: new pill-emoji footer button (monochrome capsule outline) opens a 6-card grid — one hand-tuned preset per core state (calming, relaxing, focussing, meditating, dreaming, floating), each with its own emoji, a hover blurb, and a one-tap apply. Shares the apply/fade logic with Vibe Reading via a common `applySoundState` helper

## Jul 2 2026 — trigram tooltips, stop button hover polish

- **Trigram label tooltip**: hovering an elemental slot's Chinese trigram name (li, kan, xun, etc.) now shows a native tooltip with the English gloss (fire, water, wind, thunder, lake, mountain, heaven, earth)
- **Stop button hover**: added a smooth `color`/`filter` transition and a warm drop-shadow glow on hover, matching the fade-and-glow treatment already used by the other console icon buttons (joker/qr/mode-switch) instead of an instant color jump

## Jul 2 2026 — decan/Tarot pip, stop button restyle, party icon v3, idle glints

- **Decan reading**: Vibe Reading now shows the current 10°-decan (e.g. "cancer II"), its Chaldean-order ruling planet, and its Golden Dawn Tarot pip card (e.g. "3 of cups") — pure Sun-ecliptic-longitude math (Meeus low-precision formula), no new API. Validated against the July 1 learn digest's independently-sourced fact ("Cancer I = Venus = 2 of Cups")
- **Stop button restyle**: swapped the filled ■ (static red) for an outline □ whose color slowly cycles through the console's own gold/blue/amber palette instead of a fixed red fill
- **Party icon v3**: simplified from 8 thin-stroke paths (including near-invisible zero-length-line dots) down to 4 bold filled shapes — a solid cone plus 3 chunky confetti flecks — for clarity at the tiny footer-button size
- **Mode switch hover**: added `:hover` color-brighten states to the party/lo buttons, matching the other footer icons (qr/joker/input) which already brighten on hover
- **Idle radial glints**: while the whole console is silent, each sound-slot card and the central circle visualizer now occasionally flash a brief radial glint from their center — staggered per-card via a random negative animation-delay so they never sync up

## Jul 2 2026 — trigram pairs rematched to non-elemental "relatives"

- Each elemental card keeps its own literal primary trigram (fire=Li, wind=Xun, water=Kan, earth=Kun) but now morphs into a thematically related *non-elemental* trigram instead of another sibling element's name: fire↔Zhen (thunder — lightning is fire from the sky), wind↔Dui (lake — wind rippling water), water↔Gen (mountain — springs rise from mountains), earth↔Qian (heaven — the primal Heaven/Earth duality)
- Previously fire paired with Kan (water) and vice versa, so the fire card could morph into literally showing "kan" — the water card's own name. Supersedes the Kan/Li ↔ Gen/Dui swap from earlier today; this restores water's original Kan identity while still keeping full 8-trigram coverage across the 4 elemental slots
- Fu Xi ordering (Li 3 → Xun 5 → Kan 6 → Kun 8) stays ascending with no card reordering needed

## Jul 2 2026 — trigram click-to-enable, hypnotic visual sync, glitch variety, sparkle overlay, full 8-trigram coverage, spacebar

- **Trigram tap-to-toggle**: hovering an inactive trigram now shows a normal pointer (not `ns-resize`) and a real click (press+release under 4px of movement) toggles the sound; a genuine vertical drag still adjusts the inner param and no longer accidentally toggles on release
- **Party icon v2**: swapped the custom glyph for the well-known "party popper" line-icon shape (cone + confetti flecks/streaks) — more recognizable at a glance
- **Hypnotic rate/color sync**: Background's aura brightness and ripple spawn cadence now breathe in time with the actual sounds playing — periodic tones (bell/chime/gong) use their real trigger rate, noise channels get their filter frequency octave-divided down into a ~0.08–0.25 Hz "breathing" band (Cousto Cosmic Octave method run in reverse, same principle as using Schumann resonance as an LFO rate rather than an audible tone)
- **Glitch variety**: console glitch/shimmer converted from a fixed 22s CSS loop to a JS-scheduled one-shot event firing at an irregular 12–40s interval, randomly picking a blue or warm-amber variant and a randomized duration each time
- **Sparkle overlay**: added a new "selfie filter" style glint effect (tapered 4-point sparkles that pop in, hold, and fade) scattered across the background canvas, denser when a sound is actively playing — distinct from both the console's diagonal shimmer sweep and the starfield's twinkle
- **Full 8-trigram coverage**: water's trigram pairing changed from Kan/Li (which duplicated fire's Li/Kan pair) to Gen/Dui (Mountain/Lake — the one classical opposite-pair that was unused); all four elemental slots now cover all 8 trigrams with no repeats, and the Fu Xi ordering (Li 3 → Xun 5 → Gen 7 → Kun 8) stays ascending
- **Spacebar**: stops all playing sounds, or resumes the exact snapshot that was playing before the last stop (works with both the spacebar and the stop-all button, which now share one `stopAllSounds` callback)

## Jul 2 2026 — trigram outline fix, drag-to-adjust, reading header text, party icon

- **Trigram outline**: removed the always-on bordering rect frame (looked disconnected once bars morphed mid-transition between paired trigrams). Outline now traces the nearest *discrete* trigram's bars (crisp, unmorphed) in a lighter `color-mix` shade of the fill color, while the fill itself keeps the smooth morph
- **Trigram drag**: dragging vertically on an elemental trigram now adjusts that slot's inner (type) param, same math as the DualKnob's circular inner-zone drag
- **color-mix colorspace**: switched all `color-mix(in srgb, …)` to `color-mix(in oklch, …)` (DualKnob, VibeReading, Trigram) for perceptually uniform blends instead of the muddier sRGB interpolation — per July 1 learn session digest
- **Reading modal header**: bumped dateline/title/moon/tidal/intent text further (title 0.78→1rem, moon icon 1.5→1.9rem, others ~20%) per follow-up feedback that the first bump wasn't enough for this section
- **Mode switch**: replaced the "party" text label with a monochrome line-art SVG icon (cone + confetti) matching the app's stroke-based aesthetic; `aria-label`/`title` still say "party"

## Jul 1 2026 — reading modal text size bump

- All VibeReading modal font sizes increased ~20–25%: reading lines 0.82→1.02rem, title 0.62→0.78rem, moon label 0.5→0.65rem, tidal/intent 0.42→0.55rem, card reason 0.68→0.84rem, card name 0.54→0.68rem, reveal button 0.55→0.68rem, apply button 0.6→0.72rem
- Modal width widened from min(360px, 88vw) to min(420px, 92vw)

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
