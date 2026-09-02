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

// Mean ecliptic longitude from J2000.0 (Jan 1.5, 2000) using mean motion.
// Geocentric mean elements — no observer lat/lon correction, which is fine
// for placing a sign/degree on a ring but not precise enough for houses.
const J2000_ORBITS = {
  Sun: { L0: 280.460, rate: 0.9856474 }, Moon: { L0: 218.316, rate: 13.176396 },
  Mercury: { L0: 252.250, rate: 4.092317 }, Venus: { L0: 181.979, rate: 1.602130 },
  Mars: { L0: 355.453, rate: 0.524039 }, Jupiter: { L0: 34.396, rate: 0.083091 },
  Saturn: { L0: 50.066, rate: 0.033460 }, Uranus: { L0: 314.055, rate: 0.011733 },
  Neptune: { L0: 304.349, rate: 0.005996 },
}

export function eclipticLon(name, date = new Date()) {
  const d = date.getTime() / 86400000 - 10957.5  // days since J2000.0
  const o = J2000_ORBITS[name]
  return ((o.L0 + o.rate * d) % 360 + 360) % 360
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
