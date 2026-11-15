// Six moods, one per VIBE state. Each sets the key and scale the five
// families play in, how bright and wet the sound is, how fast the slice
// drifts, the tile size, and the colour palette.
//
// Scales are just-tuned pentatonics (whole-number ratios), so every pair of
// notes is consonant. root is the pad pitch; bells play two octaves up.
const MAJOR = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3]
const MINOR = [1, 6 / 5, 4 / 3, 3 / 2, 9 / 5]
const SUS = [1, 9 / 8, 4 / 3, 3 / 2, 16 / 9]   // no third: open, unresolved

export const MOODS = [
  { id: 'calming',    root: 146.83, scale: MAJOR, cutoff: 950,  wet: 0.35, pad: 1.0, maxRate: 3,
    speed: 0.8, zoom: 1.0, spin: 0.006, hue: 195, spread: 170, sat: 58, light: 54 },
  { id: 'relaxing',   root: 174.61, scale: MAJOR, cutoff: 800,  wet: 0.4,  pad: 1.0, maxRate: 2.5,
    speed: 0.65, zoom: 1.25, spin: 0.004, hue: 22, spread: 150, sat: 66, light: 56 },
  { id: 'focussing',  root: 196.0,  scale: SUS,   cutoff: 1400, wet: 0.2,  pad: 0.7, maxRate: 4,
    speed: 1.2, zoom: 0.72, spin: 0.003, hue: 140, spread: 130, sat: 54, light: 52 },
  { id: 'meditating', root: 130.81, scale: SUS,   cutoff: 650,  wet: 0.5,  pad: 1.15, maxRate: 2,
    speed: 0.45, zoom: 1.45, spin: 0.003, hue: 265, spread: 150, sat: 55, light: 50 },
  { id: 'dreaming',   root: 164.81, scale: MINOR, cutoff: 900,  wet: 0.55, pad: 1.0, maxRate: 3,
    speed: 0.9, zoom: 1.05, spin: 0.012, hue: 290, spread: 300, sat: 64, light: 58 },
  { id: 'floating',   root: 116.54, scale: MAJOR, cutoff: 1100, wet: 0.6,  pad: 0.9, maxRate: 2.5,
    speed: 0.6, zoom: 1.15, spin: 0.008, hue: 200, spread: 360, sat: 50, light: 64 },
]

// Visual params that cross-fade when the mood changes
export const LERP_KEYS = ['speed', 'zoom', 'spin', 'hue', 'spread', 'sat', 'light']

// Shortest way round the hue wheel
export function lerpMood(cur, target, a) {
  const next = { ...cur }
  for (const k of LERP_KEYS) {
    if (k === 'hue') {
      const d = ((target.hue - cur.hue + 540) % 360) - 180
      next.hue = (cur.hue + d * a + 360) % 360
    } else next[k] = cur[k] + (target[k] - cur[k]) * a
  }
  return next
}
