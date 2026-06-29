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
async function getCoords() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ lat: 34.0522, lon: -118.2437 })
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      ()  => resolve({ lat: 34.0522, lon: -118.2437 }),
      { timeout: 4000 }
    )
  })
}

export async function fetchWeather() {
  try {
    const { lat, lon } = await getCoords()
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=weather_code,wind_speed_10m,precipitation&forecast_days=1`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const { weather_code: wc, wind_speed_10m: wind, precipitation: precip } = json.current
    return { wc, wind, precip }
  } catch {
    return null
  }
}

function weatherElement(w) {
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

// ── Sound config builder ──────────────────────────────────────────────────────
function pick(arr, seed) {
  return arr[Math.floor(seed * arr.length) % arr.length]
}

export function buildReading(phase, weather) {
  const hour = new Date().getHours()
  const moon = moonState(phase)
  const time = timePeriod(hour)
  const weatherEl = weatherElement(weather)
  const seed = (Date.now() / 3600000) % 1 // changes each hour

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

  // Moon phase → primary sounds (noise always quiet; tones carry the reading)
  switch (moon) {
    case 'new':
      noise.white = { on: true, volume: 0.14, freq: 1600 }
      tones.chime = { on: true, volume: 0.22, rate: 18, typeAngle: 0 }
      reasons.white = 'white noise holds the empty space of the new moon — a clean field with no pull, no residue'
      reasons.chime = 'a single chime at the threshold — the overtone you follow into stillness'
      primaryEl = 'chime'; prescriptionKey = 'chime'
      break
    case 'waxingCrescent':
      noise.pink  = { on: true, volume: 0.13, freq: 700 }
      tones.chime = { on: true, volume: 0.28, rate: 12, typeAngle: 0 }
      reasons.pink  = 'pink noise carries the warmth of gathering light — low, round, like something budding'
      reasons.chime = 'chime shimmer mirrors the thin crescent — barely there, beckoning forward'
      primaryEl = 'chime'; prescriptionKey = 'chime'
      break
    case 'firstQuarter':
      noise.blue = { on: true, volume: 0.14, freq: 3800 }
      tones.wind = { on: true, volume: 0.45, typeAngle: 60 }
      reasons.blue = 'blue noise sharpens to the high frequencies — the crisp edge of a moment of decision'
      reasons.wind = 'the wind carries what you release at the turning — the moving air takes the decision outward'
      primaryEl = 'wind'; prescriptionKey = 'wind'
      break
    case 'waxingGibbous':
      noise.pink  = { on: true, volume: 0.14, freq: 900 }
      tones.water = { on: true, volume: 0.50, typeAngle: 0 }
      reasons.pink  = 'pink noise holds the building pressure softly — a warm carrier for the waxing charge'
      reasons.water = 'the waxing moon governs the tides — water rises to meet the pressure building in the body'
      primaryEl = 'water'; prescriptionKey = 'water'
      break
    case 'full':
      noise.white = { on: true, volume: 0.13, freq: 2200 }
      tones.birds = { on: true, volume: 0.38, rate: 16, typeAngle: 0 }
      tones.water = { on: true, volume: 0.42, typeAngle: 180 }
      reasons.white = 'white noise opens all frequencies — the full moon withholds nothing'
      reasons.birds = 'birds sing loudest under the full moon — life at its fullest frequency'
      reasons.water = 'ocean tide peaks with the full moon — the water is at its most potent now'
      primaryEl = 'birds'; prescriptionKey = 'birds'
      break
    case 'waningGibbous':
      noise.pink  = { on: true, volume: 0.13, freq: 850 }
      tones.gong  = { on: true, volume: 0.44, rate: 65, typeAngle: 0 }
      tones.earth = { on: true, volume: 0.42, typeAngle: 0 }
      reasons.pink  = 'pink noise at the exhale — soft and round for the long release after the full moon'
      reasons.gong  = "the gong's long decay mirrors the waning — sound dissolving exactly as the moon does"
      reasons.earth = 'earth holds what the full moon released — grounding at the beginning of the exhale'
      primaryEl = 'gong'; prescriptionKey = 'gong'
      break
    case 'lastQuarter':
      noise.pink  = { on: true, volume: 0.14, freq: 750 }
      tones.earth = { on: true, volume: 0.44, typeAngle: 90 }
      reasons.pink  = 'pink noise at the clearing — the warmest frequency for a half-shadowed hour'
      reasons.earth = 'earth receives what you let go — steady ground for the final clearing before dark'
      primaryEl = 'earth'; prescriptionKey = 'earth'
      break
    case 'waningCrescent':
      noise.white = { on: true, volume: 0.12, freq: 1400 }
      tones.bell  = { on: true, volume: 0.24, rate: 30, typeAngle: 0 }
      reasons.white = 'white noise thins toward silence — the quietest field before the cycle renews'
      reasons.bell  = 'a distant bell escorts you toward the threshold — the tone that marks the final edge'
      primaryEl = 'bell'; prescriptionKey = 'bell'
      break
  }

  // Time of day → volume modulation (noise stays quiet; tones scale naturally)
  const timeVol = { dawn: 0.82, morning: 1.0, midday: 1.0, afternoon: 0.92, evening: 0.85, night: 0.75, deepNight: 0.65 }[time] ?? 1.0
  // Only modulate tones by time — noise stays at its quiet absolute level
  for (const k of Object.keys(tones)) if (tones[k].on) tones[k].volume *= timeVol

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
    lines: [moonLine, timeLine, presLine],
    soundCards, noise, tones,
  }
}
