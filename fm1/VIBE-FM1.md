# VIBE for the M-VAVE FM-1 (v0)

VIBE (vibe.obfusco.us) as a pocket instrument: colored noise and elemental tones, all synthesized, no samples.
Made for calming, relaxing, focussing, meditating, dreaming, floating.

Built on [Dinghy](https://github.com/zvenson/dinghy) (GPL-3.0), on Felucca's platform (Leo Kuroshita, Hügelton
Instruments) as SLOOP (isod89) carries it. Everything in `fm1/` is GPL-3.0-only (see `LICENSE`, `LICENSING.md`);
the rest of the vibe repo is unaffected. The app is [firmware/src/vibe.c](firmware/src/vibe.c); Dinghy's README
and docs (`docs/API.md`, `docs/RULES.md`) still describe the platform underneath.

## Playing it

The idea: no menus. Tap things, hold one thing and turn a knob, or hold one thing and press another.

| Control | What it does |
| --- | --- |
| **black keys** (11) | the channels, low to high: white, pink, blue noise · bell, chime · gong, birds, fire · wind, water · earth. **Tap** = on/off (lit = on) |
| **hold a black key + KNOB 1–4** | that channel's LEVEL, FREQ (noise) / RATE (bell, chime, gong, birds) / BODY (fire, wind, water, earth), COLOR (noise: white→violet, pink→brown, blue→grey) / REG (register) / TYPE (candle→campfire→bonfire, breeze→gale→squall, stream→rain→ocean, loam→stone→crystal), DRIFT. Hold several keys to move them together. A channel that is off comes on when you turn its knob |
| **white keys** (16) | strike a bell tuned to a Wǔ Yīn pentatonic scale from the root: mashing always sounds consonant. Held = it rings on |
| **hold BELL / CHIME / GONG / BIRDS + white key** | strike that voice instead (birds: a chirp) |
| **KNOB 1–4** (nothing held) | TILT (dark ↔ bright), DRIFT (how far every channel wanders), SPACE (reverb), PULSE (ombak, 0 = off) |
| **PRESETS** | the six intents: calming, relaxing, focussing, meditating, dreaming, floating (the web app's presets) |
| **HOME + white key 1–6** | jump straight to an intent |
| **SELECT** | the root, ±12 semitones |
| **ALGORITHM** | how fast the ring spins |
| **PLAY** | pause / resume (a ~1 s fade). The mix and the loop are kept in flash only while paused (an erase stalls the sound) |
| **REC** (held) | record a loop of what you play meanwhile: strikes, channel taps, knob moves (not audio). Let go = it loops (up to 60 s). REC lit = recording, blinks once a loop |
| **REC** tap / long hold | tap = loop on/off; hold 1.5 s without playing anything = clear the loop |
| **LFO** | shuffle: nudge every channel that is on |
| **SEQ** | evolve on/off: every 8–20 s one channel moves a little by itself |
| **FX** (held) | swell: the space opens and the tone brightens while held |
| **OCT− / OCT+** | the strike octave |
| **MIDI in** | notes strike bells (any channel) |

The screen: a ring that bulges (with inward spokes) where loud channels sit, the channels as coloured dots around it
(noise dots take their morph colour; fire, wind, water and earth drawn as their trigram, flipping to the paired one
past the TYPE knob's middle, as on the web), a rosette in the middle with one petal pair per channel that is on,
ripples out from every strike, the intent in the middle, and a dot going round while a loop records (red) or plays. The bottom strip shows what the four knobs move right now: the held
channel's values, or the macros with the root and octave.

## Build

- **Host (any computer, no toolchain):** `sh tests/run_host.sh tests/scripts/vibe.txt` → `build/host/vibe.wav` and
  screen PNGs. On macOS `run_host.sh` maps the pool's ELF section attribute away (`-Dsection(x)=__used__`).
- **Firmware (.fwsc):** needs the JieLi toolchain (Linux x86-64; Docker on macOS). PANGOLIN has neither Docker nor
  disk space, so GitHub builds it: every push to `dev/fm-1/**` that touches `fm1/` runs `.github/workflows/fm1.yml`,
  artifacts `vibe-fm1` (the `.fwsc`) and `vibe-fm1-host` (WAV + PNGs).
- **Install:** test in [fm1-emu](https://github.com/joakimeriksson/fm1-emu) first, then
  `python3 tools/fm1_install.py build/vibe.fwsc` or M-Flasher's *Install firmware*. Rescue: hold OCT− at power-on.
  Device notes and backups: `~/Sites/moomaw.info/misc/fm-1/FM-1.md`.
- **Tables:** `python3 tools/gen_vibe_tables.py` rewrites `firmware/src/vibe_tables.h` (frequency, decay and pulse
  curves; no float on the chip).

Identity `FM-1_960` (Dinghy is 99N; 96N looked free in the hub's list on 2026-11-24, check again before a public
release). Store magic `VIBE`.

## Sound, briefly

- Noise: one xorshift white source per frame → pink (Kellet), brown (leaky integrator), violet (Δwhite),
  blue (Δpink), grey (brown + violet); each channel morphs primary → pair, then a one-pole filter (white, pink:
  low-pass; blue: high-pass).
- Strikes: 10 modal voices, three decaying sine partials each (bell 1/2/2.76, chime 1/2.76/5.40, gong 1/1.47/2.09
  with a slow swell, keys 1/2/3).
- Birds and the stream's bubbles: 4 gliding-sine chirp voices.
- Fire: sparse crackles + hiss + rumble. Wind: white through a wandering SVF band-pass. Water: trickle / drops /
  ocean swell. Earth (the web's `makeEarth`): white through a resonant low-pass (90 Hz, Q 1.5 at loam → 410 Hz, Q 0.65 at
  crystal; BODY scales it ×0.6–1.6), a 32–44 Hz sub that thins toward crystal, a 0.04 Hz swell.
- Master: tilt, a small Freeverb-style reverb (4 combs, 2 allpasses a side), pulse, a soft knee at −4 dBFS.
- Per-channel drift: a slow random walk on level and filter, scaled by each channel's DRIFT and the global DRIFT.

## Not yet (v1 ideas)

- Measured ISR cost on hardware (budget 5.8 ms / 256 frames; Linux `DINGHY_PERF=1` gives instructions per sample).
- The circle-viz's trigram morph and planet glyphs on the ring (the FM-1 has no clock, so planets need a set date).
- Scenes (save/recall your own mixes to blobs), solo, MIDI CC for every knob, loop overdub.
- Planet glyphs on the ring: the FM-1 has no clock, so it would need the date set by hand or over MIDI.
