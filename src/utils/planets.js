// Shared planetary-position math — used by both the circle-viz (App.jsx) and
// the astro chart overlay (VibeAstro.jsx) so the two stay in sync rather than
// carrying two copies of the same mean-orbit constants.

// ── Planetary Cousto frequencies (Cosmic Octave, orbital period → Hz via 2ⁿ) ──
export const PLANETS = [
  { name: 'Sun',     symbol: '☉', freq: 126.22 },
  { name: 'Moon',    symbol: '☽', freq: 210.42 },
  { name: 'Mercury', symbol: '☿', freq: 141.27 },
  { name: 'Venus',   symbol: '♀', freq: 221.23 },
  { name: 'Mars',    symbol: '♂', freq: 144.72 },
  { name: 'Jupiter', symbol: '♃', freq: 183.58 },
  { name: 'Saturn',  symbol: '♄', freq: 147.85 },
  { name: 'Uranus',  symbol: '♅', freq: 207.36 },
  { name: 'Neptune', symbol: '♆', freq: 211.44 },
]

// Energetic-quality blurbs for the hover tooltip on each planetary glyph
export const PLANET_QUALITY = {
  Sun:     'vitality and identity — the core pulse. resonant near 126.22 Hz.',
  Moon:    'receptivity and tide — the emotional body. resonant near 210.42 Hz.',
  Mercury: 'quick and communicative — shimmer and motion. resonant near 141.27 Hz.',
  Venus:   'harmony and pleasure — softens the edges of the sound. resonant near 221.23 Hz.',
  Mars:    'drive and heat — sharpens toward intensity. resonant near 144.72 Hz.',
  Jupiter: 'expansion and ease — widens the sound outward. resonant near 183.58 Hz.',
  Saturn:  'structure and depth — slows the sound toward gravity. resonant near 147.85 Hz.',
  Uranus:  'sudden shift and spark — an unpredictable charge. resonant near 207.36 Hz.',
  Neptune: 'dissolve and dream — blurs the sound toward the unconscious. resonant near 211.44 Hz.',
}

// Geocentric ecliptic longitude (degrees, ecliptic of date) for the Sun,
// Moon and planets. Planets: JPL's approximate Keplerian elements (Standish,
// "Approximate Positions of the Planets", valid 1800-2050): solve Kepler for
// the planet and for Earth, subtract to get the view from Earth, then add
// precession since J2000. Sun = Earth's heliocentric direction + 180°. Moon:
// mean longitude plus its six largest periodic terms (Meeus, low precision).
// Accurate to well under a degree against Wolfram|Alpha (checked Nov 14
// 2026), plenty for signs, aspects and directions. No observer location:
// geocentric, so not good enough for houses.
//
// Before Nov 14 2026 this returned *heliocentric* mean longitudes for
// Mercury-Neptune (as seen from the Sun), up to 138° off for Venus.
const D2R = Math.PI / 180
// a (AU), e, I, L, long. perihelion, long. node; then rates per century
const ELEMENTS = {
  Mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
            [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  Venus:   [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
            [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  Earth:   [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
            [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  Mars:    [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
            [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  Jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
            [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  Saturn:  [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
            [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  Uranus:  [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
            [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  Neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
            [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
}

// Heliocentric ecliptic (J2000) x, y, z in AU, T in centuries since J2000
function helio(name, T) {
  const [e0, rate] = ELEMENTS[name]
  const [a, e, I, L, wbar, node] = e0.map((v, i) => v + rate[i] * T)
  const w = (wbar - node) * D2R, O = node * D2R, inc = I * D2R
  const M = ((((L - wbar) % 360) + 540) % 360 - 180) * D2R
  let E = M + e * Math.sin(M)
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(inc), sI = Math.sin(inc)
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ]
}

function moonLon(d) {
  const L = 218.316 + 13.176396 * d          // mean longitude
  const Mm = (134.963 + 13.064993 * d) * D2R // Moon's mean anomaly
  const Ms = (357.529 + 0.98560028 * d) * D2R // Sun's mean anomaly
  const D = (297.850 + 12.190749 * d) * D2R  // mean elongation
  const F = (93.272 + 13.229350 * d) * D2R   // argument of latitude
  return L + 6.289 * Math.sin(Mm) + 1.274 * Math.sin(2 * D - Mm) + 0.658 * Math.sin(2 * D)
    + 0.214 * Math.sin(2 * Mm) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F)
}

export function eclipticLon(name, date = new Date()) {
  const d = date.getTime() / 86400000 - 10957.5  // days since J2000.0
  const T = d / 36525
  let lon
  if (name === 'Moon') lon = moonLon(d)          // already of date
  else {
    const [ex, ey] = helio('Earth', T)
    if (name === 'Sun') lon = Math.atan2(-ey, -ex) / D2R
    else {
      const [px, py] = helio(name, T)
      lon = Math.atan2(py - ey, px - ex) / D2R
    }
    lon += 1.396971 * T                           // precession J2000 → date
  }
  return ((lon % 360) + 360) % 360
}

// ︎ (VS15, text-presentation selector) forces these to render as plain
// glyphs — without it several browsers/fonts default the zodiac range
// (U+2648-2653) to colorful boxed emoji instead of a simple symbol.
export const ZODIAC_SIGNS = [
  { name: 'aries',       glyph: '♈︎' },
  { name: 'taurus',      glyph: '♉︎' },
  { name: 'gemini',      glyph: '♊︎' },
  { name: 'cancer',      glyph: '♋︎' },
  { name: 'leo',         glyph: '♌︎' },
  { name: 'virgo',       glyph: '♍︎' },
  { name: 'libra',       glyph: '♎︎' },
  { name: 'scorpio',     glyph: '♏︎' },
  { name: 'sagittarius', glyph: '♐︎' },
  { name: 'capricorn',   glyph: '♑︎' },
  { name: 'aquarius',    glyph: '♒︎' },
  { name: 'pisces',      glyph: '♓︎' },
]
