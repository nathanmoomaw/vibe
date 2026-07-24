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
export const PRESETS = [
  preset('calming', '🌙', 'calming', 9.0, 195,
    'a Metal-toned drone under a soft stream and a slow, distant bell.',
    (noise, tones) => {
      noise.pink  = { on: true, volume: 0.06, freq: WU_YIN_HZ.metal }
      tones.water = { on: true, volume: 0.20, typeAngle: 0 }   // stream
      tones.bell  = { on: true, volume: 0.18, rate: 32, typeAngle: 0 }
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
  preset('focussing', '🧲', 'focussing', 12.0, 25,
    'a crisp highpass edge and a moving wind, tuned for alert clarity.',
    (noise, tones) => {
      noise.blue = { on: true, volume: 0.07, freq: WU_YIN_HZ.wood * 2 }
      tones.wind = { on: true, volume: 0.20, typeAngle: 60 }   // squall edge
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
    'an OM-anchored drone, a distant bell, and soft rain.',
    (noise, tones) => {
      noise.pink  = { on: true, volume: 0.05, freq: OM_HZ }
      tones.bell  = { on: true, volume: 0.17, rate: 34, typeAngle: 0 }
      tones.water = { on: true, volume: 0.14, typeAngle: 180 } // rain
    }),
  preset('floating', '🫧', 'floating', 2.5, 172,
    'the quietest drone, a rare chime, and a low ocean swell.',
    (noise, tones) => {
      noise.pink  = { on: true, volume: 0.04, freq: OM_HZ }
      tones.chime = { on: true, volume: 0.15, rate: 40, typeAngle: 0 }
      tones.water = { on: true, volume: 0.14, typeAngle: 270 } // ocean
    }),
]
