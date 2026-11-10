// Hexagram geometry for chingy. A hexagram is a 6-bit number: bit 0 is the
// bottom line (line 1), bit 5 the top (line 6), 1 = yang (solid). That makes
// every hexagram a vertex of the 6-cube, one changing line an edge, and the
// number of differing lines (Hamming distance) the size of a change.

// Trigram value, bottom line first: bit0 bottom, bit1 middle, bit2 top
export const TRIGRAM = {
  kun: 0, zhen: 1, kan: 2, dui: 3, gen: 4, li: 5, xun: 6, qian: 7,
}
export const TRIGRAM_NAME = ['kun', 'zhen', 'kan', 'dui', 'gen', 'li', 'xun', 'qian']
export const TRIGRAM_IMAGE = {
  qian: 'heaven', kun: 'earth', zhen: 'thunder', kan: 'water',
  gen: 'mountain', xun: 'wind', li: 'fire', dui: 'lake',
}

// Each trigram already has a voice in vibe: the four elemental tones morph
// between two trigrams via typeAngle (App.jsx TONES: 0° = base, 180° = pair).
export const TRIGRAM_VOICE = {
  li:   { tone: 'fire',  angle: 0,   color: '#ff6633' },
  zhen: { tone: 'fire',  angle: 180, color: '#ff9944' },
  xun:  { tone: 'wind',  angle: 0,   color: '#aaddcc' },
  dui:  { tone: 'wind',  angle: 180, color: '#88ccee' },
  kan:  { tone: 'water', angle: 0,   color: '#44aaff' },
  gen:  { tone: 'water', angle: 180, color: '#8899dd' },
  kun:  { tone: 'earth', angle: 0,   color: '#cc8855' },
  qian: { tone: 'earth', angle: 180, color: '#ffe8a0' },
}

// King Wen number by [lower][upper], trigram order qian zhen kan gen kun xun li dui
const KW_ORDER = ['qian', 'zhen', 'kan', 'gen', 'kun', 'xun', 'li', 'dui']
const KW_TABLE = [
  [1, 34, 5, 26, 11, 9, 14, 43],
  [25, 51, 3, 27, 24, 42, 21, 17],
  [6, 40, 29, 4, 7, 59, 64, 47],
  [33, 62, 39, 52, 15, 53, 56, 31],
  [12, 16, 8, 23, 2, 20, 35, 45],
  [44, 32, 48, 18, 46, 57, 50, 28],
  [13, 55, 63, 22, 36, 37, 30, 49],
  [10, 54, 60, 41, 19, 61, 38, 58],
]

// Wilhelm's titles, lowercased to match the house style
export const NAMES = [null,
  'the creative', 'the receptive', 'difficulty at the beginning', 'youthful folly',
  'waiting', 'conflict', 'the army', 'holding together',
  'small taming', 'treading', 'peace', 'standstill',
  'fellowship', 'great possession', 'modesty', 'enthusiasm',
  'following', 'work on the decayed', 'approach', 'contemplation',
  'biting through', 'grace', 'splitting apart', 'return',
  'innocence', 'great taming', 'nourishment', 'great exceeding',
  'the abysmal', 'the clinging', 'influence', 'duration',
  'retreat', 'great power', 'progress', 'darkening of the light',
  'the family', 'opposition', 'obstruction', 'deliverance',
  'decrease', 'increase', 'breakthrough', 'coming to meet',
  'gathering', 'pushing upward', 'oppression', 'the well',
  'revolution', 'the cauldron', 'the arousing', 'keeping still',
  'development', 'the marrying maiden', 'abundance', 'the wanderer',
  'the gentle', 'the joyous', 'dispersion', 'limitation',
  'inner truth', 'small exceeding', 'after completion', 'before completion',
]

export const lower = h => TRIGRAM_NAME[h & 7]
export const upper = h => TRIGRAM_NAME[(h >> 3) & 7]
export const kingWen = h => KW_TABLE[KW_ORDER.indexOf(lower(h))][KW_ORDER.indexOf(upper(h))]
export const lineOf = (h, i) => (h >> i) & 1

export function hamming(a, b) {
  let x = a ^ b, n = 0
  while (x) { n += x & 1; x >>= 1 }
  return n
}

// Upside-down (King Wen pairs most hexagrams this way); if that's the same
// figure, the pair is the full inversion (every line flipped).
export function reverse6(h) {
  let r = 0
  for (let i = 0; i < 6; i++) r |= ((h >> i) & 1) << (5 - i)
  return r
}
export function kingWenPartner(h) {
  const r = reverse6(h)
  return r === h ? h ^ 63 : r
}

// Reflected binary Gray code: n-th step of a walk that visits all 64
// hexagrams, changing exactly one line each step, and closes into a loop
// (gray(63) = 32 is one line from gray(0) = 0).
export const gray = n => n ^ (n >> 1)
export function grayIndex(h) {
  let n = 0
  for (let g = h; g; g >>= 1) n ^= g
  return n
}
// Which line (0-5) changes between consecutive Gray steps
export const changedLine = (a, b) => Math.log2(a ^ b) | 0

// 6-cube drawn in the plane: line i pushes the point along a direction at
// i·30°, so the 64 vertices fill a dodecagon and every edge is parallel to
// one of six directions, one per line.
const DIRS = Array.from({ length: 6 }, (_, i) => {
  const a = (i * 30 - 75) * Math.PI / 180
  return [Math.cos(a), Math.sin(a)]
})
export function cubePoint(h) {
  let x = 0, y = 0
  for (let i = 0; i < 6; i++) {
    const s = (h >> i) & 1 ? 0.5 : -0.5
    x += s * DIRS[i][0]
    y += s * DIRS[i][1]
  }
  return [x, y]
}
export const CUBE_EDGES = (() => {
  const e = []
  for (let h = 0; h < 64; h++) for (let i = 0; i < 6; i++) {
    const n = h ^ (1 << i)
    if (n > h) e.push([h, n, i])
  }
  return e
})()

// Cast from the present moment: three-coin odds per line (yang 1/2), seeded
// so it leans on the moon phase and decan rather than pure chance.
export function castFromMoment(phase, decanIndex) {
  let h = 0
  const tilt = (phase - 0.5) * 0.2 + (decanIndex - 1) * 0.05
  for (let i = 0; i < 6; i++) if (Math.random() < 0.5 + tilt) h |= 1 << i
  return h
}
