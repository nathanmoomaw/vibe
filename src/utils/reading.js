// ── Moon phase ────────────────────────────────────────────────────────────────
// Known new moon: 2025-01-29 18:35 UTC
const REF_NEW_MOON_MS = 1738175700000
const SYNODIC_MS = 29.530589 * 24 * 3600 * 1000

export function moonPhase() {
  return (((Date.now() - REF_NEW_MOON_MS) % SYNODIC_MS) / SYNODIC_MS + 1) % 1
}

function moonState(phase) {
  if (phase < 0.03 || phase > 0.97) return 'new'
  if (phase < 0.22) return 'waxingCrescent'
  if (phase < 0.28) return 'firstQuarter'
  if (phase < 0.47) return 'waxingGibbous'
  if (phase < 0.53) return 'full'
  if (phase < 0.72) return 'waningGibbous'
  if (phase < 0.78) return 'lastQuarter'
  return 'waningCrescent'
}

export const MOON_LABEL = {
  new: 'new moon', waxingCrescent: 'waxing crescent', firstQuarter: 'first quarter',
  waxingGibbous: 'waxing gibbous', full: 'full moon', waningGibbous: 'waning gibbous',
  lastQuarter: 'last quarter', waningCrescent: 'waning crescent',
}

// ── Decan / cosmic Tarot pip ─────────────────────────────────────────────────
// Sun's ecliptic longitude via the Meeus low-precision solar position formula
// (accurate to ~0.01°, more than enough to place a 10°-wide decan). No API —
// pure date math, per the July 1 learn-session digest.
function sunEclipticLongitude(date = new Date()) {
  const jd = date.getTime() / 86400000 + 2440587.5
  const T = (jd - 2451545.0) / 36525
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360
  const M  = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360
  const Mr = M * Math.PI / 180
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
          + 0.000289 * Math.sin(3 * Mr)
  const trueLong = (L0 + C) % 360
  const omega = 125.04 - 1934.136 * T
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180)
  return (appLong + 360) % 360
}

const ZODIAC = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces']
const DECAN_NUM = ['I', 'II', 'III']
const ELEMENT_SUIT = {
  aries: 'wands', leo: 'wands', sagittarius: 'wands',
  cancer: 'cups', scorpio: 'cups', pisces: 'cups',
  gemini: 'swords', libra: 'swords', aquarius: 'swords',
  taurus: 'pentacles', virgo: 'pentacles', capricorn: 'pentacles',
}
// Cardinal signs → pips 2/3/4, fixed → 5/6/7, mutable → 8/9/10 (Golden Dawn)
const MODALITY_BASE_PIP = {
  aries: 2, cancer: 2, libra: 2, capricorn: 2,
  taurus: 5, leo: 5, scorpio: 5, aquarius: 5,
  gemini: 8, virgo: 8, sagittarius: 8, pisces: 8,
}
// Chaldean decan rulers, continuous cycle of 7 starting at Aries decan I = Mars
// (each sign's own ruler governs its first decan; the Chaldean order carries on from there)
const CHALDEAN_FROM_MARS = ['mars', 'sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter']

export function currentDecan(date = new Date()) {
  const lon = sunEclipticLongitude(date)
  const signIdx = Math.floor(lon / 30) % 12
  const sign = ZODIAC[signIdx]
  const degInSign = lon - signIdx * 30
  const decanIdx = Math.min(2, Math.floor(degInSign / 10)) // 0, 1, 2
  const globalDecanIdx = signIdx * 3 + decanIdx // 0..35, continuous from Aries I
  const ruler = CHALDEAN_FROM_MARS[globalDecanIdx % 7]
  const pip = MODALITY_BASE_PIP[sign] + decanIdx
  const suit = ELEMENT_SUIT[sign]
  return {
    sign, decanIndex: decanIdx, decanLabel: `${sign} ${DECAN_NUM[decanIdx]}`,
    ruler, pip, suit, cardName: `${pip} of ${suit}`,
  }
}

// ── Time of day ───────────────────────────────────────────────────────────────
function timePeriod(h) {
  if (h >= 4  && h < 7)  return 'dawn'
  if (h >= 7  && h < 12) return 'morning'
  if (h >= 12 && h < 16) return 'midday'
  if (h >= 16 && h < 19) return 'afternoon'
  if (h >= 19 && h < 22) return 'evening'
  if (h >= 22)           return 'night'
  return 'deepNight'
}

// ── Weather fetch (Open-Meteo, no key required) ───────────────────────────────
const LA_FALLBACK = { lat: 34.0522, lon: -118.2437 }

// IP-based coarse location — no permission prompt, used when the user denies
// (or the browser lacks) precise geolocation, so a declined prompt still gets
// a real reading for wherever they roughly are instead of always landing on
// the hardcoded LA default.
async function getCoordsByIP() {
  try {
    const res = await fetch('https://ipapi.co/json/')
    if (!res.ok) return null
    const json = await res.json()
    if (typeof json.latitude !== 'number' || typeof json.longitude !== 'number') return null
    return { lat: json.latitude, lon: json.longitude }
  } catch {
    return null
  }
}

async function getCoords() {
  if (!navigator.geolocation) return (await getCoordsByIP()) ?? LA_FALLBACK
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      async () => resolve((await getCoordsByIP()) ?? LA_FALLBACK),
      { timeout: 4000 }
    )
  })
}

// Air quality — separate Open-Meteo endpoint, fetched alongside the regular
// forecast so a reading can lean toward "clearing" (wind) when the air is
// actually bad, rather than only reacting to precipitation/wind/sky state.
async function fetchAqi(lat, lon) {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=us_aqi`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    return json.current?.us_aqi ?? null
  } catch {
    return null
  }
}

export async function fetchWeather() {
  try {
    const { lat, lon } = await getCoords()
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=weather_code,wind_speed_10m,precipitation&forecast_days=1`
    const [res, aqi] = await Promise.all([fetch(url), fetchAqi(lat, lon)])
    if (!res.ok) return null
    const json = await res.json()
    const { weather_code: wc, wind_speed_10m: wind, precipitation: precip } = json.current
    return { wc, wind, precip, aqi }
  } catch {
    return null
  }
}

export function weatherElement(w) {
  if (!w) return null
  const { wc, wind, precip } = w
  if (precip > 0.5 || (wc >= 51 && wc <= 82)) return 'water'
  if (wc >= 95)  return 'fire'
  if (wind > 20) return 'wind'
  if (wc === 0 || wc === 1) return 'birds'
  if (wc >= 71 && wc <= 77) return 'earth'
  return null
}

// ── Narrative text ────────────────────────────────────────────────────────────
const MOON_TEXT = {
  new:           ['the slate is clear. no pull, no residue.', 'before the light returns.', 'the void before the seed.'],
  waxingCrescent:['something is gathering.', 'light beginning to catch.', 'the quiet pull of becoming.'],
  firstQuarter:  ['the moment of decision.', 'half in shadow, half in light.', 'the turning point.'],
  waxingGibbous: ['pressure — beautiful pressure.', 'almost full. the charge is building.', 'something is about to land.'],
  full:          ['everything at once.', 'high tide of everything.', 'the peak. breathe into it.'],
  waningGibbous: ['the long exhale begins.', 'releasing what the full moon drew in.', 'the great slow letting go.'],
  lastQuarter:   ['clearing the ground.', 'what no longer fits is leaving.', 'half-shadow, earned.'],
  waningCrescent:['going very quiet now.', 'almost dark. almost still.', 'the final threshold before renewal.'],
}

const TIME_TEXT = {
  dawn:     ['the day has not yet declared itself.', 'before the city wakes.', 'the threshold hour.'],
  morning:  ['attention sharpens naturally here.', 'the mind is clean and ready.', "the day's first clear hours."],
  midday:   ['the sun at full reach.', 'all channels open.', 'no shadows anywhere.'],
  afternoon:['the light warming toward amber.', 'the slow gold hour approaching.', 'energy beginning its descent.'],
  evening:  ['the world is decelerating.', 'the day folding in on itself.', 'soft now, and softer.'],
  night:    ['below the threshold of the day.', 'the body remembers its older rhythms.', 'the dark is not empty.'],
  deepNight:['the body forgets its edges.', 'below thought. below memory.', 'the deepest hours.'],
}

const PRESCRIPTION = {
  water: ['enter the water.', 'let the tide do the work.', 'dissolve at the edges.'],
  fire:  ['let the fire metabolize it.', 'warmth in the center.', 'burn what is not you.'],
  wind:  ['let the wind carry it.', 'release into the moving air.', 'become lighter.'],
  earth: ['settle into the ground.', 'be held.', 'root.'],
  birds: ['the birds know the hour.', 'open to the living field.', 'you are part of the field.'],
  bell:  ['let the tone carry you.', 'follow the overtone upward.', 'listen past the sound.'],
  chime: ['follow the shimmer.', 'the overtones know where to go.', 'become the air between the notes.'],
  gong:  ['ride the decay.', "slow down to the gong's pace.", 'rest inside the ring.'],
  noise: ['become the frequency.', 'let the color of sound fill you.', 'disappear into the wave.'],
}

// Reasons are keyed by sound id — contextual overrides added per-case below
const BASE_REASONS = {
  white: 'white noise opens all frequencies equally — a clean, undifferentiated field',
  pink:  'pink noise mirrors the warmth of organic sound — soft, round, and body-close',
  blue:  'blue noise sharpens the high frequencies — clarity and edge, like cold air',
  bell:  'the bell carries a single fundamental and its overtones outward',
  chime: 'chime shimmer dissolves at its peak — a sound that arrives and immediately lets go',
  gong:  'the gong holds you inside its decay — a long, slow envelope for the body to rest in',
  birds: 'birds encode the vitality of the living field — an open, natural frequency',
  fire:  'fire metabolizes — it transforms what it receives',
  wind:  'wind carries things outward — the moving air takes what you release',
  water: 'water follows the moon — the most tide-responsive element in the body',
  earth: 'earth receives — it grounds what cannot be held in the upper body',
}

// ── Tidal state (derived from moon phase) ─────────────────────────────────────
// springFactor: 1.0 at new/full moon, 0.0 at quarter moons
export function tidalSpring(phase) {
  return Math.abs(Math.cos(phase * 2 * Math.PI))
}

// tidalHeight: approximate 0=low → 1=high, cycles ~twice per lunar day
export function tidalHeight(phase) {
  const hour = new Date().getHours()
  // Lunar day ≈ 24.84h; approximate high/low within that cycle
  const lunarDayPos = (phase * 29.53 * 24 + hour) / 12.42
  return 0.5 + 0.5 * Math.cos(lunarDayPos * 2 * Math.PI)
}

export function tidalLabel(spring, height) {
  const springStr = spring > 0.75 ? 'spring' : spring < 0.3 ? 'neap' : 'moderate'
  const heightStr = height > 0.65 ? 'high' : height < 0.35 ? 'low' : 'mid'
  return `${heightStr} tide · ${springStr}`
}

// ── Wǔ Yīn pentatonic frequencies (I Ching → element → note) ─────────────────
// Trigram → 5-Element → Wǔ Yīn tone → Hz (doubled octave for noise filter range)
// Earth/Mountain=C(512) Metal=D(576) Wood=E(640) Fire=G(768) Water=A(864)
// Basis: 3,000yr TCM/Taoist 五音 system + ancient 64-bell ritual bronze set
const WU_YIN_HZ = { earth: 512, metal: 576, wood: 640, fire: 768, water: 864 }

// Special: 136.1 Hz = Earth's orbital year cycle, "OM frequency", heart chakra anchor
// Use for deep meditation / floating states via pink noise lowpass
const OM_HZ = 136.1

// Binaural beat targets per moon state (LFO ombak pulse Hz for amplitude modulation)
// delta=floating, theta=meditating/dreaming, alpha=calming/relaxing, alpha+=focusing
const PULSE_HZ = {
  new:            2.5,  // δ — floating in the void
  waxingCrescent: 7.0,  // θ — gathering, relaxed
  firstQuarter:   12.0, // α+ — focused decision
  waxingGibbous:  9.0,  // α — calming the charge
  full:           7.83, // ♁ — Schumann resonance, peak meditation
  waningGibbous:  7.0,  // θ — the slow exhale
  lastQuarter:    9.0,  // α — clearing, calm
  waningCrescent: 4.0,  // θ/δ — dreaming toward dark
}

const INTENT_LABEL = {
  new:            'floating · δ 2.5 Hz',
  waxingCrescent: 'relaxing · θ 7 Hz',
  firstQuarter:   'focusing · α 12 Hz',
  waxingGibbous:  'calming · α 9 Hz',
  full:           'meditating · ♁ 7.83 Hz',
  waningGibbous:  'relaxing · θ 7 Hz',
  lastQuarter:    'calming · α 9 Hz',
  waningCrescent: 'dreaming · θ 4 Hz',
}

// ── Energetic-quality blurbs for hover tooltips (how each factor shapes the sound) ──
export const MOON_QUALITY = {
  new:            'the void phase — binaural pulse sits at 2.5 Hz (δ, deep floating). sound is sparse: a single chime over an OM-anchored drone, mirroring the dark of the cycle.',
  waxingCrescent: 'first light returning — 7 Hz (θ) pulse for a relaxed, gathering state. a soft chime rides a Wood-toned drone as the cycle starts to build.',
  firstQuarter:   'the decision point — 12 Hz (α+) sharpens focus. wind carries a Wood-toned edge, matching the turn from gathering into motion.',
  waxingGibbous:  'pressure building toward full — 9 Hz (α) keeps the charge calm. water rises against a Metal-toned drone as the tide of the cycle builds.',
  full:           'peak of the cycle — 7.83 Hz, the Schumann resonance, for full-body meditation. every frequency opens at once: birds, water and a Fire-toned noise floor.',
  waningGibbous:  'the exhale begins — 7 Hz (θ) eases the release. a gong dissolves over grounding earth as the Metal tone softens.',
  lastQuarter:    'clearing what no longer fits — 9 Hz (α) keeps it steady. earth alone, tuned low, holding ground through the release.',
  waningCrescent: 'the final threshold — 4 Hz (θ/δ) eases toward dreaming. a distant bell over an OM-anchored drone, quiet as the cycle closes.',
}

export function tidalQualityText(tidal) {
  const { spring, height } = tidal
  const heightStr = height > 0.65 ? 'high' : height < 0.35 ? 'low' : 'mid'
  const springStr = spring > 0.75 ? 'spring (max range)' : spring < 0.3 ? 'neap (min range)' : 'moderate range'
  const freqPct = Math.round((height - 0.5) * 16)
  return `${heightStr} tide, ${springStr}. tide height shifts every active frequency ${freqPct >= 0 ? '+' : ''}${freqPct}% right now; spring/neap range scales tone volume between 92–108%.`
}

const BAND_QUALITY = {
  'δ':  'delta — the slowest brainwave band, linked to deep sleep and full-body release. used here to pull you toward floating.',
  'θ':  'theta — the dreaming and light-meditation band, the bridge between waking and sleep. used here for relaxing or dreaming states.',
  'α':  'alpha — a relaxed-but-awake band, the state of calm focus. used here for calming or focusing states.',
  'α+': 'alpha (upper) — the sharper end of relaxed focus, closer to active attention. used here to sharpen focus without tipping into stress.',
  '♁':  "the Schumann resonance — Earth's own electromagnetic pulse (7.83 Hz), used here as a grounding anchor for deep meditation.",
}
export function intentQualityText(intentLabel) {
  const band = intentLabel.match(/[δθα♁]\+?/)?.[0]
  return BAND_QUALITY[band] ?? 'a binaural pulse tuned to the present lunar phase.'
}

const ELEMENT_QUALITY = {
  wands:     'a Fire sign — active, quick-burning energy. in this reading it leans the sound toward warmth and transformation.',
  cups:      'a Water sign — emotional, tide-responsive energy. in this reading it leans the sound toward flow and release.',
  swords:    'an Air sign — quick, mental, wind-driven energy. in this reading it leans the sound toward clarity and movement.',
  pentacles: 'an Earth sign — slow, grounded, body-based energy. in this reading it leans the sound toward stillness and root.',
}

const RULER_QUALITY = {
  sun:     'ruled by the Sun — vitality and clarity, brightening whatever it touches.',
  moon:    'ruled by the Moon — receptivity and tide, pulling the sound toward the emotional body.',
  mercury: 'ruled by Mercury — quick and communicative, adding shimmer and motion.',
  venus:   'ruled by Venus — harmony and pleasure, softening the edges of the sound.',
  mars:    'ruled by Mars — drive and heat, sharpening the sound toward intensity.',
  jupiter: 'ruled by Jupiter — expansion and ease, widening the sound outward.',
  saturn:  'ruled by Saturn — structure and depth, slowing the sound toward gravity.',
}

export function decanQualityText(decan) {
  return `${ELEMENT_QUALITY[decan.suit]} ${RULER_QUALITY[decan.ruler]} the ${decan.cardName} pip carries this decan's tarot correspondence.`
}

// ── Sound config builder ──────────────────────────────────────────────────────
function pick(arr, seed) {
  return arr[Math.floor(seed * arr.length) % arr.length]
}

// Golden-ratio low-discrepancy step — each call lands somewhere new and
// well-spread from the last, so two readings taken seconds apart (same hour,
// same weather) still read as genuinely different rather than identical.
// The moon/time/weather-driven sound config itself is unaffected — this only
// spreads the narrative line picks — matching "the user's own condition has
// shifted a little" rather than re-randomizing the whole reading.
let readingCallCount = 0

export function buildReading(phase, weather) {
  readingCallCount += 1
  const hour = new Date().getHours()
  const moon = moonState(phase)
  const time = timePeriod(hour)
  const weatherEl = weatherElement(weather)
  const spring = tidalSpring(phase)
  const height = tidalHeight(phase)

  // Seed: hour-based + weather entropy + a per-call golden-ratio increment,
  // so conditions still ground the reading but immediate repeats never land
  // on the exact same narrative lines
  const weatherEntropy = weather ? (weather.wind * 0.013 + weather.precip * 0.09) % 1 : 0
  const callEntropy = (readingCallCount * 0.6180339887) % 1
  const seed = ((Date.now() / 3600000) + weatherEntropy * 0.6 + callEntropy * 0.4) % 1

  // Default state (all off) — noise volumes kept quiet by design
  const noise = {
    white: { on: false, volume: 0.14, freq: 2000 },
    pink:  { on: false, volume: 0.14, freq: 900 },
    blue:  { on: false, volume: 0.14, freq: 3500 },
  }
  const tones = {
    bell:  { on: false, volume: 0.5, rate: 25,  typeAngle: 0 },
    chime: { on: false, volume: 0.5, rate: 10,  typeAngle: 0 },
    gong:  { on: false, volume: 0.5, rate: 55,  typeAngle: 0 },
    birds: { on: false, volume: 0.5, rate: 14,  typeAngle: 0 },
    fire:  { on: false, volume: 0.5, typeAngle: 0 },
    wind:  { on: false, volume: 0.5, typeAngle: 0 },
    water: { on: false, volume: 0.5, typeAngle: 0 },
    earth: { on: false, volume: 0.5, typeAngle: 0 },
  }

  // Per-sound contextual reasons (filled as sounds are activated)
  const reasons = {}

  let primaryEl = null
  let prescriptionKey = 'noise'

  // Moon phase → primary sounds (Wǔ Yīn-tuned noise frequencies; tones carry the reading)
  switch (moon) {
    case 'new':
      // New moon = void, Earth element (Kūn), Gōng tone (C = 512 Hz) deepened to OM anchor
      noise.pink  = { on: true, volume: 0.13, freq: OM_HZ }
      tones.chime = { on: true, volume: 0.22, rate: 18, typeAngle: 0 }
      reasons.pink  = `pink noise lowpass at 136.1 Hz — the OM frequency, Earth's orbital year cycle. the lowest resonant field before a cycle begins`
      reasons.chime = 'a single chime at the threshold — the overtone you follow into stillness'
      primaryEl = 'chime'; prescriptionKey = 'chime'
      break
    case 'waxingCrescent':
      // Xùn (Wind) = Wood element, Jué tone (E = 640 Hz)
      noise.pink  = { on: true, volume: 0.13, freq: WU_YIN_HZ.wood }
      tones.chime = { on: true, volume: 0.28, rate: 12, typeAngle: 0 }
      reasons.pink  = `pink noise at ${WU_YIN_HZ.wood} Hz — the Jué (角) Wood tone of the Wǔ Yīn system. warm and forward-leaning, like something budding`
      reasons.chime = 'chime shimmer mirrors the thin crescent — barely there, beckoning forward'
      primaryEl = 'chime'; prescriptionKey = 'chime'
      break
    case 'firstQuarter':
      // Zhèn (Thunder) = Wood element, Jué tone (E). Blue highpass at E×2
      noise.blue = { on: true, volume: 0.14, freq: WU_YIN_HZ.wood * 2 }
      tones.wind = { on: true, volume: 0.45, typeAngle: 60 }
      reasons.blue = `blue noise highpass at ${WU_YIN_HZ.wood * 2} Hz — the Jué (角) Wood tone, upper octave. sharp, crisp, the edge of a decision`
      reasons.wind = 'the wind carries what you release at the turning — the moving air takes the decision outward'
      primaryEl = 'wind'; prescriptionKey = 'wind'
      break
    case 'waxingGibbous':
      // Qián (Heaven) = Metal element, Shāng tone (D = 576 Hz)
      noise.pink  = { on: true, volume: 0.14, freq: WU_YIN_HZ.metal }
      tones.water = { on: true, volume: 0.50, typeAngle: 0 }
      reasons.pink  = `pink noise at ${WU_YIN_HZ.metal} Hz — the Shāng (商) Metal tone of the Wǔ Yīn. grounded and clear, carrying the building charge`
      reasons.water = 'the waxing moon governs the tides — water rises to meet the pressure building in the body'
      primaryEl = 'water'; prescriptionKey = 'water'
      break
    case 'full':
      // Lí (Fire) = Fire element, Zhǐ tone (G = 768 Hz). Full moon = peak Fire
      noise.white = { on: true, volume: 0.13, freq: WU_YIN_HZ.fire }
      tones.birds = { on: true, volume: 0.38, rate: 16, typeAngle: 0 }
      tones.water = { on: true, volume: 0.42, typeAngle: 180 }
      reasons.white = `white noise centered at the Zhǐ (徵) Fire tone — ${WU_YIN_HZ.fire} Hz. full moon opens all frequencies; the Fire note holds the peak`
      reasons.birds = 'birds sing loudest under the full moon — life at its fullest frequency'
      reasons.water = 'ocean tide peaks with the full moon — water is most potent now; Fire and Water in balance'
      primaryEl = 'birds'; prescriptionKey = 'birds'
      break
    case 'waningGibbous':
      // Duì (Lake) = Metal element, Shāng tone (D = 576 Hz) — release begins
      noise.pink  = { on: true, volume: 0.13, freq: WU_YIN_HZ.metal }
      tones.gong  = { on: true, volume: 0.44, rate: 65, typeAngle: 0 }
      tones.earth = { on: true, volume: 0.42, typeAngle: 0 }
      reasons.pink  = `pink noise at ${WU_YIN_HZ.metal} Hz — the Shāng (商) Metal tone. soft and round at the exhalation, carrying the release`
      reasons.gong  = "the gong's long decay mirrors the waning — sound dissolving exactly as the moon does"
      reasons.earth = 'earth holds what the full moon released — grounding at the beginning of the exhale'
      primaryEl = 'gong'; prescriptionKey = 'gong'
      break
    case 'lastQuarter':
      // Gèn (Mountain) = Earth element, Gōng tone (C = 512 Hz) — clearing
      noise.pink  = { on: true, volume: 0.14, freq: WU_YIN_HZ.earth }
      tones.earth = { on: true, volume: 0.44, typeAngle: 90 }
      reasons.pink  = `pink noise at ${WU_YIN_HZ.earth} Hz — the Gōng (宮) Earth tone, lowest of the Wǔ Yīn. rooted, stable, the ground of the clearing`
      reasons.earth = 'earth receives what you let go — steady ground for the final clearing before dark'
      primaryEl = 'earth'; prescriptionKey = 'earth'
      break
    case 'waningCrescent':
      // Kǎn (Water) = Water element, Yǔ tone (A = 864 Hz) + OM anchor
      noise.pink  = { on: true, volume: 0.12, freq: OM_HZ }
      tones.bell  = { on: true, volume: 0.24, rate: 30, typeAngle: 0 }
      reasons.pink  = `pink noise at 136.1 Hz — the OM frequency again, the Earth tone. going very quiet; the cycle closes where it opened`
      reasons.bell  = 'a distant bell escorts you toward the threshold — the tone that marks the final edge'
      primaryEl = 'bell'; prescriptionKey = 'bell'
      break
  }

  // Tidal influence on active noise frequencies (±8% based on high/low tide)
  const tideFreqBias = (height - 0.5) * 0.16 // -8% at low tide, +8% at high tide
  for (const k of Object.keys(noise)) {
    if (noise[k].on) noise[k].freq = Math.round(noise[k].freq * (1 + tideFreqBias))
  }

  // Time of day → volume modulation (noise stays quiet; tones scale naturally)
  const timeVol = { dawn: 0.82, morning: 1.0, midday: 1.0, afternoon: 0.92, evening: 0.85, night: 0.75, deepNight: 0.65 }[time] ?? 1.0
  // Spring tide boosts tone volume slightly; neap tide quiets it
  const tidalVolMod = 0.92 + spring * 0.16 // 0.92 (neap) → 1.08 (spring)
  // Only modulate tones by time + tidal — noise stays at its quiet absolute level
  for (const k of Object.keys(tones)) if (tones[k].on) tones[k].volume *= timeVol * tidalVolMod

  // Weather → add/override elemental sound
  if (weatherEl && !tones[weatherEl]?.on) {
    const angle = weatherEl === 'water' ? 180 : weatherEl === 'wind' ? 60 : 0
    if (tones[weatherEl] !== undefined) {
      tones[weatherEl] = { on: true, volume: 0.45 * timeVol, typeAngle: angle }
      primaryEl = weatherEl; prescriptionKey = weatherEl
      const weatherReasons = {
        water: 'rain is falling where you are — the reading follows the weather outside',
        fire:  'electrical charge in the atmosphere — fire metabolizes the storm energy',
        wind:  'strong wind outside — the reading mirrors what the atmosphere is already doing',
        earth: 'the sky is heavy and closed — earth holds steady beneath the weight',
      }
      reasons[weatherEl] = weatherReasons[weatherEl] ?? BASE_REASONS[weatherEl]
    } else if (weatherEl === 'birds') {
      tones.birds = { on: true, volume: 0.35 * timeVol, rate: 14, typeAngle: 0 }
      primaryEl = 'birds'; prescriptionKey = 'birds'
      reasons.birds = 'clear sky above — birds are active and the frequency field is open'
    }
  }

  // Weather → precise typeAngle for wind and water based on actual conditions
  if (weather) {
    if (tones.wind.on) {
      const w = weather.wind ?? 0
      // Calm breeze → 0°, moderate → 60°, strong gale → 150°
      tones.wind.typeAngle = w < 8 ? Math.round(w * 4) : w < 25 ? Math.round(32 + (w - 8) * 3.5) : Math.min(150, Math.round(92 + (w - 25) * 2.5))
      reasons.wind = (reasons.wind ?? BASE_REASONS.wind) +
        ` (${w < 8 ? 'light breeze' : w < 25 ? 'moderate wind' : 'strong wind'} · ${Math.round(w)} km/h)`
    }
    if (tones.water.on) {
      const p = weather.precip ?? 0
      // Drizzle → stream (0°), rain → rain (120°), heavy → ocean (270°)
      tones.water.typeAngle = p < 0.5 ? 0 : p < 3 ? 120 : 270
      if (p > 0.1) {
        reasons.water = (reasons.water ?? BASE_REASONS.water) +
          ` (${p < 0.5 ? 'drizzle' : p < 3 ? 'rain' : 'heavy rain'} · ${p.toFixed(1)} mm)`
      }
    }
  }

  // High spring tide → add a water undertone if not already present
  if (spring > 0.85 && height > 0.7 && !tones.water.on && !weatherEl) {
    tones.water = { on: true, volume: 0.22 * timeVol * tidalVolMod, typeAngle: 0 }
    reasons.water = 'spring tide at its height — the ocean frequency rises as a subtle undertone'
  }

  // Poor air quality → a clearing wind undertone (moving air carries it out),
  // subtle enough not to override a more specific weather-driven element
  const aqi = weather?.aqi
  if (aqi > 100 && !tones.wind.on) {
    tones.wind = { on: true, volume: 0.2 * timeVol, typeAngle: aqi > 150 ? 90 : 45 }
    reasons.wind = `the air quality is poor here (US AQI ${Math.round(aqi)}) — a clearing wind undertone to carry it out`
  }

  // Narrative text (3 lines)
  const moonLine = pick(MOON_TEXT[moon], seed)
  const timeLine = pick(TIME_TEXT[time], seed * 1.37)
  const presLine = pick(PRESCRIPTION[prescriptionKey], seed * 2.11)

  // Build ordered sound cards (noise first, then tones) with reasons
  const soundCards = [
    ...['white', 'pink', 'blue'].filter(id => noise[id].on).map(id => ({
      id, type: 'noise', reason: reasons[id] ?? BASE_REASONS[id],
    })),
    ...['bell','chime','gong','birds','fire','wind','water','earth'].filter(id => tones[id].on).map(id => ({
      id, type: 'tone', reason: reasons[id] ?? BASE_REASONS[id],
    })),
  ]

  return {
    moonPhase: phase, moonState: moon, timePeriod: time, weatherEl, primaryEl,
    tidal: { spring, height, label: tidalLabel(spring, height) },
    pulseHz: PULSE_HZ[moon] ?? 7.83,
    intentLabel: INTENT_LABEL[moon] ?? 'meditating · ♁ 7.83 Hz',
    decan: currentDecan(),
    lines: [moonLine, timeLine, presLine],
    soundCards, noise, tones,
  }
}
