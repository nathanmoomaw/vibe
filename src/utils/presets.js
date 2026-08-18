// ── Static "prescription" presets ────────────────────────────────────────────
// A hand-tuned sound recipe per core VIBE state (see CLAUDE.md's six states:
// calming, relaxing, focussing, meditating, dreaming, floating). Simpler,
// non-randomized sibling to the astro/weather-driven VibeReading — a fixed
// dose you can reach for directly instead of pulling a reading.

// Wǔ Yīn pentatonic frequencies + the OM/Earth-year anchor — same tuning
// basis used by the reading engine (see utils/reading.js for the citation).
const WU_YIN_HZ = { earth: 512, metal: 576, wood: 640, fire: 768, water: 864 }
const OM_HZ = 136.1

function baseNoise() {
  return {
    white: { on: false, volume: 0.14, freq: 2000, typeAngle: 0 },
    pink:  { on: false, volume: 0.14, freq: 900,  typeAngle: 0 },
    blue:  { on: false, volume: 0.14, freq: 3500, typeAngle: 0 },
  }
}

function baseTones() {
  return {
    bell:  { on: false, volume: 0.5, rate: 25, typeAngle: 0 },
    chime: { on: false, volume: 0.5, rate: 10, typeAngle: 0 },
    gong:  { on: false, volume: 0.5, rate: 55, typeAngle: 0 },
    birds: { on: false, volume: 0.5, rate: 14, typeAngle: 0 },
    fire:  { on: false, volume: 0.5, typeAngle: 0 },
    wind:  { on: false, volume: 0.5, typeAngle: 0 },
    water: { on: false, volume: 0.5, typeAngle: 0 },
    earth: { on: false, volume: 0.5, typeAngle: 0 },
  }
}

function preset(id, emoji, label, pulseHz, hue, blurb, build, emojiFlip = false) {
  const noise = baseNoise()
  const tones = baseTones()
  build(noise, tones)
  return { id, emoji, label, pulseHz, hue, blurb, noise, tones, emojiFlip }
}

// Muted per-preset hover hues (low saturation, evocative of each state) —
// used as the sole hover accent color for that preset's card, replacing the
// single shared amber tint every preset used before.
// pulseHz drives an amplitude-modulation LFO (see setNoisePulse in
// audio/noise.js) — every preset was reading as noticeably "pulsy",
// focussing worst of all at 12Hz (was tremolo-fast). Lowered across the
// board via the shared LFO depth cut in noise.js; focussing's own rate is
// also pulled down here (12→8.5, still alpha/SMR range for focus).
export const PRESETS = [
  preset('calming', '🌙', 'calming', 9.0, 195,
    'a deep brown-noise hush under a slow ocean swell and an unhurried bell.',
    (noise, tones) => {
      // typeAngle 180 pulls pink fully to its paired brown — deeper and less
      // "present" than a bare Metal drone, closer to a hush than a hum
      noise.pink  = { on: true, volume: 0.03, freq: WU_YIN_HZ.metal, typeAngle: 180 }
      tones.water = { on: true, volume: 0.26, typeAngle: 240 }  // ocean
      tones.bell  = { on: true, volume: 0.36, rate: 31, typeAngle: 0 }
    }),
  preset('relaxing', '🕯️', 'relaxing', 7.0, 135,
    'a Wood-toned drone, a light breeze, and a loose chime shimmer.',
    (noise, tones) => {
      noise.pink  = { on: true, volume: 0.06, freq: WU_YIN_HZ.wood }
      tones.wind  = { on: true, volume: 0.20, typeAngle: 0 }   // breeze
      // rate raised from 14 → 22: at 14 the chime fired every ~7-22s, the
      // fastest of any preset — too busy to read as "relaxing" next to the
      // slower cadences everywhere else
      tones.chime = { on: true, volume: 0.20, rate: 22, typeAngle: 0 }
    }),
  preset('focussing', '🧲', 'focussing', 10.0, 25,
    'a Wood-toned pink drone under a steady breeze and a grounding loam tone.',
    (noise, tones) => {
      // Blue kept reading as "hissy" even after the earlier octave-up +
      // volume cut — blue is inherently a brighter/highpassed color by
      // design, no amount of tuning erases that. Consonance law #3 in the
      // acoustomancy reference calls for a pink (1/f) noise layer
      // specifically, so switched off blue entirely. Also dropped the chime
      // accent: its periodic strikes were likely what read as "too pulsy"
      // even after cutting the AM-pulse depth in noise.js — a percussive
      // onset every ~10-30s breaks a drone's steadiness in a way continuous
      // texture doesn't, so this preset is now a held drone. pulseHz moved
      // from a guessed 8.5 into the documented Focus binaural target (Alpha
      // 10-14 Hz — acoustomancy.md), at its gentle low end.
      //
      // Reference only, not live — the pink+wind-only combo above minus the
      // earth layer below (same 7%/16% volumes) was kept as a hand-tuned
      // fallback in case this one (with earth) doesn't hold up as well:
      //   noise.pink = { on: true, volume: 0.07, freq: WU_YIN_HZ.wood }
      //   tones.wind = { on: true, volume: 0.16, typeAngle: 0 }
      noise.pink  = { on: true, volume: 0.07, freq: WU_YIN_HZ.wood }
      tones.wind  = { on: true, volume: 0.16, typeAngle: 0 }   // breeze
      tones.earth = { on: true, volume: 0.13, typeAngle: 0 }   // loam
    }),
  preset('meditating', '🪬', 'meditating', 7.83, 268,
    'an OM-anchored drone, a slow gong, and a crystalline earth tone at 7.83 Hz.',
    (noise, tones) => {
      noise.pink  = { on: true, volume: 0.06, freq: OM_HZ }
      // gong was the loudest single sound of any preset at 0.30 — too
      // present for a meditative hush
      tones.gong  = { on: true, volume: 0.22, rate: 70, typeAngle: 0 }
      tones.earth = { on: true, volume: 0.16, typeAngle: 90 }  // crystalline
    }, true), // emojiFlip — hamsa rendered facing downward
  preset('dreaming', '🪽', 'dreaming', 4.0, 232,
    'an OM-anchored drone, a distant bell, and a soft ocean swell.',
    (noise, tones) => {
      noise.pink  = { on: true, volume: 0.05, freq: OM_HZ }
      tones.bell  = { on: true, volume: 0.17, rate: 34, typeAngle: 0 }
      tones.water = { on: true, volume: 0.08, typeAngle: 240 } // ocean
    }),
  preset('floating', '🫧', 'floating', 2.5, 172,
    'a soft drone under scattered chimes, distant birdsong, and a light breeze.',
    (noise, tones) => {
      noise.pink  = { on: true, volume: 0.09, freq: OM_HZ }
      tones.chime = { on: true, volume: 0.38, rate: 40, typeAngle: 0 }
      tones.birds = { on: true, volume: 0.26, rate: 55, typeAngle: 0 }
      tones.wind  = { on: true, volume: 0.09, typeAngle: 0 }   // breeze
    }),
]
