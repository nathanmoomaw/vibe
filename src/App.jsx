import { useState, useCallback, useEffect, useRef } from 'react'
import { getAnalyser, setAudioInput, stopAudioInput, updateAudioInputFilters, isAudioInputActive, fadeMaster } from './audio/engine.js'
import { setNoisePulse, stopAllNoisePulses } from './audio/noise.js'
import { startNoise, stopNoise, setNoiseVolume, setNoiseFreq, setNoiseType } from './audio/noise.js'
import { startTone, stopTone, setToneVolume, setToneParam } from './audio/tones.js'
import Background from './components/Background.jsx'
import SoundSlot from './components/SoundSlot.jsx'
import LoView from './components/LoView.jsx'
import { VibeQR } from './components/VibeQR.jsx'
import { VibePhilosophy } from './components/VibePhilosophy.jsx'
import { VibeReading } from './components/VibeReading.jsx'
import { VibePresets } from './components/VibePresets.jsx'
import { PillIcon } from './components/PillIcon.jsx'
import { encodeSettings, decodeSettings } from './utils/settings.js'
import './App.css'

// ── Planetary Cousto frequencies (Cosmic Octave, orbital period → Hz via 2ⁿ) ──
const PLANETS = [
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
const PLANET_QUALITY = {
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

// Mean ecliptic longitude from J2000.0 (Jan 1.5, 2000) using mean motion
const J2000_ORBITS = {
  Sun: { L0: 280.460, rate: 0.9856474 }, Moon: { L0: 218.316, rate: 13.176396 },
  Mercury: { L0: 252.250, rate: 4.092317 }, Venus: { L0: 181.979, rate: 1.602130 },
  Mars: { L0: 355.453, rate: 0.524039 }, Jupiter: { L0: 34.396, rate: 0.083091 },
  Saturn: { L0: 50.066, rate: 0.033460 }, Uranus: { L0: 314.055, rate: 0.011733 },
  Neptune: { L0: 304.349, rate: 0.005996 },
}
function eclipticLon(name) {
  const d = Date.now() / 86400000 - 10957.5  // days since J2000.0
  const o = J2000_ORBITS[name]
  return ((o.L0 + o.rate * d) % 360 + 360) % 360
}

// Octave-invariant frequency proximity (cents deviation, mod 1200)
function planetFade(noiseFreq, planetFreq) {
  const logR = Math.log2(noiseFreq / planetFreq)
  const centsDev = Math.abs(logR - Math.round(logR)) * 1200
  return Math.max(0, 1 - centsDev / 280)
}

// Each channel continuously morphs into a paired color as its knob turns
// (mirrors NOISE_PAIR in audio/noise.js — keep in sync): white↔violet
// (both a high hiss), pink↔brown (both a soft body-close hum vs a deep
// rumble), blue↔grey (both edge/clarity colors). filterDefault is also each
// primary's "no offset" tuning target for the Wǔ Yīn coarse-nudge system —
// see setNoiseFreq in audio/noise.js.
export const NOISE = [
  { id: 'white', label: 'white', color: '#d4d4d4', glow: 'rgba(212,212,212,0.35)',
    filterDefault: 2000, pairId: 'violet', pairLabel: 'violet', pairColor: '#c266ff' },
  { id: 'pink',  label: 'pink',  color: '#ff7eb3', glow: 'rgba(255,126,179,0.4)',
    filterDefault: 900,  pairId: 'brown', pairLabel: 'brown', pairColor: '#a0522d' },
  { id: 'blue',  label: 'blue',  color: '#66ccff', glow: 'rgba(102,204,255,0.4)',
    filterDefault: 3500, pairId: 'grey', pairLabel: 'grey', pairColor: '#9aa5b1' },
]

// Interpolates a noise slot's own color toward its paired color's, at the
// same continuous morph weight as the audible crossfade (getNoiseLabel /
// audio/noise.js's weights()) — so the knob's glow visibly tracks which
// color is dominant, not just its text label.
function lerpHex(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16)
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255
  return {
    r: Math.round(ar + (br - ar) * t),
    g: Math.round(ag + (bg - ag) * t),
    b: Math.round(ab + (bb - ab) * t),
  }
}

function noiseColorAt(s, angle) {
  const t = 0.5 - 0.5 * Math.cos(((angle % 360) + 360) % 360 * Math.PI / 180)
  const { r, g, b } = lerpHex(s.color, s.pairColor, t)
  return { color: `rgb(${r},${g},${b})`, glow: `rgba(${r},${g},${b},0.4)` }
}

// Mirrors COARSE_OFFSET_PCT in audio/noise.js — how far a Wǔ Yīn tune nudge
// is allowed to shift a channel's default frequency.
const COARSE_TUNE_PCT = 0.25

// I Ching trigrams: [top, middle, bottom] 1=yang(solid), 0=yin(broken)
const TRIGRAMS = {
  Qian: [1, 1, 1],  // ☰ Heaven
  Dui:  [0, 1, 1],  // ☱ Lake
  Li:   [1, 0, 1],  // ☲ Fire
  Zhen: [0, 0, 1],  // ☳ Thunder
  Xun:  [1, 1, 0],  // ☴ Wind
  Kan:  [0, 1, 0],  // ☵ Water
  Gen:  [1, 0, 0],  // ☶ Mountain
  Kun:  [0, 0, 0],  // ☷ Earth
}

// Cosine morph: 0°=base, 180°=pair, 360°=base
function morphTrigram(base, pair, angle) {
  const t = 0.5 - 0.5 * Math.cos(((angle % 360) + 360) % 360 * Math.PI / 180)
  return base.map((b, i) => b + (pair[i] - b) * t)
}

function getTrigramLabel(s, angle) {
  const t = 0.5 - 0.5 * Math.cos(((angle % 360) + 360) % 360 * Math.PI / 180)
  return (t < 0.5 ? s.trigram : s.pairTrigram).toLowerCase()
}

// The discrete (unmorphed) trigram nearest the current angle — used to draw a crisp outline
function getClosestTrigramLines(s, angle) {
  const t = 0.5 - 0.5 * Math.cos(((angle % 360) + 360) % 360 * Math.PI / 180)
  return TRIGRAMS[t < 0.5 ? s.trigram : s.pairTrigram]
}

export const TONES = [
  { id: 'bell',  label: 'bell',  color: '#ffd166', glow: 'rgba(255,209,102,0.4)', periodic: true, rateDefault: 25, rateMin: 8,  rateMax: 90  },
  { id: 'chime', label: 'chime', color: '#ffe8a0', glow: 'rgba(255,232,160,0.4)', periodic: true, rateDefault: 10, rateMin: 3,  rateMax: 40  },
  { id: 'gong',  label: 'gong',  color: '#ff9944', glow: 'rgba(255,153,68,0.4)',  periodic: true, rateDefault: 55, rateMin: 20, rateMax: 120 },
  { id: 'birds', label: 'birds', color: '#88ee88', glow: 'rgba(136,238,136,0.4)', periodic: true, rateDefault: 14, rateMin: 5,  rateMax: 60  },
  // Elemental sounds — I Ching Fu Xi order: Li (3) → Xun (5) → Kan (6) → Kun (8).
  // Each card's primary trigram matches its own header (fire=Li, wind=Xun,
  // water=Kan, earth=Kun). Pair targets are a thematic "relative" from the
  // remaining 4 non-elemental trigrams — never another of these 4 canonical
  // elements, so no card ever morphs into a sibling's own name:
  //   fire↔Zhen (thunder — lightning is fire from the sky)
  //   wind↔Dui (lake — wind rippling a lake's surface)
  //   water↔Gen (mountain — springs and rivers rise from mountains)
  //   earth↔Qian (heaven — the primal Heaven/Earth duality)
  { id: 'fire',  label: 'fire',  color: '#ff6633', glow: 'rgba(255,102,51,0.4)',  periodic: false, hasType: true, elemental: true, trigram: 'Li',  pairTrigram: 'Zhen' },
  { id: 'wind',  label: 'wind',  color: '#aaddcc', glow: 'rgba(170,221,204,0.4)', periodic: false, hasType: true, elemental: true, trigram: 'Xun', pairTrigram: 'Dui'  },
  { id: 'water', label: 'water', color: '#44aaff', glow: 'rgba(68,170,255,0.4)',  periodic: false, hasType: true, elemental: true, trigram: 'Kan', pairTrigram: 'Gen'  },
  { id: 'earth', label: 'earth', color: '#cc8855', glow: 'rgba(204,136,85,0.4)',  periodic: false, hasType: true, elemental: true, trigram: 'Kun', pairTrigram: 'Qian' },
]

// Representative center frequency (+ filter shape) for each tone's synthesis —
// mirrors the NOISE freq/type pairing so the audio-input filter bank can be
// built from whichever tones are active, not just the noise channels. Values
// pulled from each tone's own oscillator/filter setup in audio/tones.js.
const TONE_FILTER = {
  bell:  { type: 'bandpass', freq: 440,  q: 2.2 },
  chime: { type: 'bandpass', freq: 750,  q: 1.6 },
  gong:  { type: 'bandpass', freq: 70,   q: 1.8 },
  birds: { type: 'bandpass', freq: 3000, q: 1.0 },
  wind:  { type: 'bandpass', freq: 600,  q: 1.2 },
  water: { type: 'bandpass', freq: 1300, q: 1.1 },
  fire:  { type: 'bandpass', freq: 1500, q: 0.9 },
  earth: { type: 'lowpass',  freq: 130,  q: 1.2 },
}

// Derives the audio-input filter bank from whichever noise/tone channels are
// presently active — shared by the initial submit and the live-tracking
// effect that keeps the bank in sync as the user adjusts knobs afterward.
function buildInputFilterConfigs(noise, tones) {
  // white's own synthesis filter is 'allpass' (shapes nothing — white noise
  // stays broadband regardless of its freq knob), but reusing that here made
  // the input audibly unfiltered whenever white was the only active channel.
  // Use a wide bandpass for white instead so "filter the input through the
  // active channels" is true for every channel, not just pink/blue.
  const noiseFilters = NOISE
    .filter(s => noise[s.id].on)
    .map(s => ({
      type: s.id === 'blue' ? 'highpass' : s.id === 'pink' ? 'lowpass' : 'bandpass',
      freq: noise[s.id].freq,
      q: s.id === 'white' ? 0.6 : 1.5,
    }))
  // Tones (bell, gong, wind, water, ...) have their own characteristic
  // bands (see TONE_FILTER) — include them too, so the input is still
  // shaped when only elemental/periodic tones are active and no noise
  // channel is on.
  const toneFilters = TONES
    .filter(t => tones[t.id].on)
    .map(t => TONE_FILTER[t.id])
  return [...noiseFilters, ...toneFilters]
}

const WATER_TYPES = ['stream', 'rain', 'ocean']
const FIRE_TYPES  = ['candle', 'campfire', 'bonfire']
const WIND_TYPES  = ['breeze', 'gale', 'squall']
const EARTH_TYPES = ['loam', 'stone', 'crystal']

// Which of a noise slot's two paired colors is closest to the current knob
// angle — same continuous 2-way crossfade threshold used in audio/noise.js.
function getNoiseLabel(s, angle) {
  const t = 0.5 - 0.5 * Math.cos(((angle % 360) + 360) % 360 * Math.PI / 180)
  return t < 0.5 ? s.label : s.pairLabel
}

function getTypeName(id, angle) {
  const a = ((angle % 360) + 360) % 360
  const idx = a < 60 || a >= 300 ? 0 : a < 180 ? 1 : 2
  if (id === 'water') return WATER_TYPES[idx]
  if (id === 'fire')  return FIRE_TYPES[idx]
  if (id === 'wind')  return WIND_TYPES[idx]
  if (id === 'earth') return EARTH_TYPES[idx]
  return undefined
}

function initState(slots, extra) {
  return Object.fromEntries(slots.map(s => [s.id, { on: false, volume: 0.5, ...extra(s) }]))
}

// Monochrome outline of 💊 — a capsule rotated diagonal with a center divider,
// the classic two-tone pill silhouette rendered as pure strokes.
export default function App() {
  const [mode, setMode] = useState('party')
  const [noise, setNoise] = useState(() => initState(NOISE, s => ({ freq: s.filterDefault, typeAngle: 0 })))
  const [tones, setTones] = useState(() => initState(TONES, s => ({ rate: s.rateDefault ?? 20, typeAngle: 0 })))
  const [dispDragging, setDispDragging] = useState(false)
  const [dispFlashing, setDispFlashing] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showPhilosophy, setShowPhilosophy] = useState(false)
  const [showReading, setShowReading] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [inputUrl, setInputUrl] = useState('')
  const [inputStatus, setInputStatus] = useState('idle') // idle | loading | playing | error
  const [glitch, setGlitch] = useState(null) // null | { variant: 'blue'|'warm', duration }

  const canvasRef       = useRef(null)
  const rafRef           = useRef(null)
  const dispDragRef      = useRef(false)
  const dispTotalMoved   = useRef(0)
  const noiseRef         = useRef(noise)
  const pausedRef        = useRef(null) // snapshot of {noise, tones} taken right before a stop-all, for spacebar resume
  const planetPosRef     = useRef([])   // latest on-screen planet glyph positions, for hover hit-testing
  const hoveredPlanetRef = useRef(null)
  const [hoveredPlanet, setHoveredPlanet] = useState(null) // { name, x, y } | null — drives the hover tooltip
  const [ringHover, setRingHover] = useState(false) // hovering the display ring generally (not a planet glyph) — drives the function-tip below
  useEffect(() => { noiseRef.current = noise }, [noise])
  useEffect(() => { hoveredPlanetRef.current = hoveredPlanet?.name ?? null }, [hoveredPlanet])

  const anyOn = [...Object.values(noise), ...Object.values(tones)].some(s => s.on)
  const activeSounds = [
    ...NOISE.filter(s => noise[s.id].on).map(s => ({ id: s.id, glow: s.glow, freq: noise[s.id].freq })),
    ...TONES.filter(s => tones[s.id].on).map(s => ({ id: s.id, glow: s.glow, rateSec: s.periodic ? tones[s.id].rate : undefined })),
  ]

  // Decode settings from URL on first load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('v')
    if (!encoded) return
    setNoise(n => {
      setTones(t => {
        const decoded = decodeSettings(encoded, n, t, NOISE, TONES)
        if (!decoded) return t
        // Start any sounds that are on in the decoded state
        NOISE.forEach(s => {
          if (decoded.noise[s.id].on) startNoise(s.id, decoded.noise[s.id].volume, decoded.noise[s.id].typeAngle, decoded.noise[s.id].freq)
        })
        TONES.forEach(s => {
          const ds = decoded.tones[s.id]
          if (ds.on) {
            const param = s.hasType ? ds.typeAngle : (s.periodic ? ds.rate : null)
            startTone(s.id, ds.volume, param)
          }
        })
        setTimeout(() => setNoise(() => decoded.noise), 0)
        return decoded.tones
      })
      return n
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Console glitch/shimmer — fires at an irregular interval with a randomly
  // picked variant/duration so it never reads as a fixed metronome
  useEffect(() => {
    let scheduleTimer, clearTimer
    function scheduleGlitch() {
      const delay = 12000 + Math.random() * 28000 // 12–40s
      scheduleTimer = setTimeout(() => {
        const variant = Math.random() < 0.5 ? 'blue' : 'warm'
        const duration = 2.2 + Math.random() * 1.4 // 2.2–3.6s
        setGlitch({ variant, duration })
        clearTimer = setTimeout(() => setGlitch(null), duration * 1000)
        scheduleGlitch()
      }, delay)
    }
    scheduleGlitch()
    return () => { clearTimeout(scheduleTimer); clearTimeout(clearTimer) }
  }, [])

  // Radial spectrum visualizer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!anyOn) {
      cancelAnimationFrame(rafRef.current)
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    const analyser = getAnalyser()
    const data = new Uint8Array(analyser.frequencyBinCount)
    const ctx = canvas.getContext('2d')

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      const { width, height } = canvas
      const cx = width / 2, cy = height / 2
      ctx.clearRect(0, 0, width, height)

      const bars = 72
      const step = Math.floor(data.length * 0.5 / bars)
      // Kept back from the circular clip edge (canvas radius === clip radius,
      // since the canvas fills its clipped wrapper 1:1) so the planet glyphs
      // anchored just beyond maxR have headroom for their own width/height —
      // otherwise their outer half gets clipped, worse on hover magnification.
      const maxR = cx * 0.8
      const minR = cx * 0.3

      for (let i = 0; i < bars; i++) {
        const val = data[i * step] / 255
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2
        const r = minR + val * (maxR - minR)
        const hue = 190 + i * 2
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(angle) * minR, cy + Math.sin(angle) * minR)
        ctx.lineTo(cx + Math.cos(angle) * r,    cy + Math.sin(angle) * r)
        ctx.strokeStyle = `hsla(${hue},65%,62%,${0.35 + val * 0.6})`
        ctx.lineWidth = (Math.PI * 2 * minR / bars) * 0.55
        ctx.stroke()
      }

      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
      ctx.beginPath()
      ctx.arc(cx, cy, minR * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${0.05 + avg * 0.12})`
      ctx.fill()

      // ── Planetary symbols — fade in when a noise frequency matches a Cousto planet freq ──
      const activeFreqs = NOISE
        .filter(s => noiseRef.current[s.id]?.on)
        .map(s => noiseRef.current[s.id].freq)

      const positions = []
      if (activeFreqs.length > 0) {
        for (const p of PLANETS) {
          const fade = Math.max(...activeFreqs.map(f => planetFade(f, p.freq)))
          if (fade < 0.02) continue

          const angle = (eclipticLon(p.name) * Math.PI / 180) - Math.PI / 2
          const pr = maxR + 6
          const px = cx + Math.cos(angle) * pr
          const py = cy + Math.sin(angle) * pr
          positions.push({ name: p.name, px, py })

          const hovered = hoveredPlanetRef.current === p.name
          const baseSize = 12 + Math.round(fade * 6)

          ctx.save()
          ctx.globalAlpha = hovered ? Math.max(0.95, fade) : fade * 0.9
          ctx.shadowColor = 'rgba(255,200,80,0.9)'
          ctx.shadowBlur = hovered ? 7 : 5
          ctx.font = `bold ${hovered ? Math.round(baseSize * 1.3) : baseSize}px serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#ffd080'
          ctx.fillText(p.symbol, px, py)
          ctx.restore()
        }
      }
      planetPosRef.current = positions
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [anyOn])

  // ── Randomize all active sounds' parameters ───────────────────────
  const randomizeActive = useCallback(() => {
    setNoise(prev => {
      const next = { ...prev }
      for (const s of NOISE) {
        if (!prev[s.id].on) continue
        const newVol = Math.max(0.1, Math.min(1,
          prev[s.id].volume + (Math.random() - 0.5) * 0.5))
        // Coarse Wǔ Yīn-style tune nudge, ±25% of the channel's default —
        // typeAngle (which color is dominant) is left alone here, same as
        // elemental tones leave their typeAngle untouched on randomize and
        // only jitter rate.
        const newFreq = s.filterDefault * (1 + (Math.random() - 0.5) * COARSE_TUNE_PCT)
        setNoiseVolume(s.id, newVol)
        setNoiseFreq(s.id, newFreq)
        next[s.id] = { ...prev[s.id], volume: newVol, freq: newFreq }
      }
      return next
    })
    setTones(prev => {
      const next = { ...prev }
      for (const s of TONES) {
        if (!prev[s.id].on) continue
        const newVol = Math.max(0.1, Math.min(1,
          prev[s.id].volume + (Math.random() - 0.5) * 0.5))
        setToneVolume(s.id, newVol)
        let updates = { volume: newVol }
        if (s.periodic) {
          const rateRange = s.rateMax - s.rateMin
          const newRate = Math.max(s.rateMin, Math.min(s.rateMax,
            prev[s.id].rate + (Math.random() - 0.5) * rateRange * 0.5))
          updates.rate = newRate
        }
        next[s.id] = { ...prev[s.id], ...updates }
      }
      return next
    })
  }, [])

  // ── Curated first-tap presets ─────────────────────────────────────
  const randomizeFirst = useCallback(() => {
    // Noise starts subtle (~0.13) — user turns up if they want more
    const presets = [
      { n: [{id:'pink', v:0.13,f:640}],  t: [{id:'wind', v:0.48,p:30},  {id:'bell', v:0.3,p:32}] },
      { n: [{id:'blue', v:0.13,f:1280}], t: [{id:'water',v:0.52,p:0},   {id:'chime',v:0.32,p:11}] },
      { n: [{id:'pink', v:0.12,f:512}],  t: [{id:'earth',v:0.5,p:0},    {id:'gong', v:0.28,p:65}] },
      { n: [{id:'pink', v:0.13,f:768}],  t: [{id:'fire', v:0.48,p:120}, {id:'birds',v:0.3,p:18}] },
      { n: [{id:'blue', v:0.12,f:1280}], t: [{id:'wind', v:0.5,p:85},   {id:'gong', v:0.26,p:72}] },
    ]
    const preset = presets[Math.floor(Math.random() * presets.length)]
    setNoise(prev => {
      const next = { ...prev }
      for (const { id, v, f } of preset.n) {
        startNoise(id, v, prev[id].typeAngle, f)
        next[id] = { ...prev[id], on: true, volume: v, freq: f }
      }
      return next
    })
    setTones(prev => {
      const next = { ...prev }
      const meta = (id) => TONES.find(t => t.id === id)
      for (const { id, v, p } of preset.t) {
        const m = meta(id)
        const param = m?.hasType ? p : (m?.periodic ? p : null)
        startTone(id, v, param)
        if (m?.hasType) next[id] = { ...prev[id], on: true, volume: v, typeAngle: p }
        else if (m?.periodic) next[id] = { ...prev[id], on: true, volume: v, rate: p }
        else next[id] = { ...prev[id], on: true, volume: v }
      }
      return next
    })
    setDispFlashing(true)
    setTimeout(() => setDispFlashing(false), 700)
  }, [])

  // ── Apply a reading or preset sound state ──────────────────────────
  const applySoundState = useCallback((readingNoise, readingTones, pulseHz, onDone) => {
    stopAllNoisePulses()
    setNoise(prev => {
      const next = { ...prev }
      for (const s of NOISE) {
        const cfg = readingNoise[s.id]
        if (cfg.on) {
          if (!prev[s.id].on) startNoise(s.id, cfg.volume, prev[s.id].typeAngle, cfg.freq)
          else { setNoiseVolume(s.id, cfg.volume); setNoiseFreq(s.id, cfg.freq) }
          // Apply LFO ombak pulse at binaural beat target frequency
          if (pulseHz) setTimeout(() => setNoisePulse(s.id, pulseHz), 50)
        } else {
          if (prev[s.id].on) stopNoise(s.id)
        }
        next[s.id] = { ...prev[s.id], ...cfg }
      }
      return next
    })
    setTones(prev => {
      const next = { ...prev }
      for (const s of TONES) {
        const cfg = readingTones[s.id]
        const meta = TONES.find(t => t.id === s.id)
        if (cfg.on) {
          if (!prev[s.id].on) {
            const param = meta?.hasType ? cfg.typeAngle : (meta?.periodic ? cfg.rate : null)
            startTone(s.id, cfg.volume, param)
          } else {
            setToneVolume(s.id, cfg.volume)
          }
        } else {
          if (prev[s.id].on) stopTone(s.id)
        }
        next[s.id] = { ...prev[s.id], ...cfg }
      }
      return next
    })
    // Fade master back up after applying reading sounds
    fadeMaster(0.85, 600)
    onDone?.()
    setDispFlashing(true)
    setTimeout(() => setDispFlashing(false), 700)
  }, [])

  const applyReading = useCallback((readingNoise, readingTones, pulseHz) => {
    applySoundState(readingNoise, readingTones, pulseHz, () => setShowReading(false))
  }, [applySoundState])

  const applyPreset = useCallback((preset) => {
    // Duck the master briefly before the new sounds start (each sound's own
    // gain jumps straight to its target when it starts), then let
    // applySoundState's own fadeMaster(0.85, …) ramp back up — the master
    // ramp is what makes the whole preset bloom in smoothly instead of
    // snapping to full volume the instant it's selected.
    fadeMaster(0.03, 200)
    setTimeout(() => {
      applySoundState(preset.noise, preset.tones, preset.pulseHz, () => setShowPresets(false))
    }, 220)
  }, [applySoundState])

  // ── Reveal one reading sound (called as each card is tapped) ────────
  const revealReadingSound = useCallback((id, type, cfg) => {
    if (type === 'noise') {
      setNoise(prev => {
        startNoise(id, cfg.volume, prev[id].typeAngle, cfg.freq)
        return { ...prev, [id]: { ...prev[id], on: true, volume: cfg.volume, freq: cfg.freq } }
      })
    } else {
      setTones(prev => {
        const meta = TONES.find(t => t.id === id)
        const param = meta?.hasType ? cfg.typeAngle : (meta?.periodic ? cfg.rate : null)
        startTone(id, cfg.volume, param)
        return { ...prev, [id]: { ...prev[id], on: true, volume: cfg.volume,
          ...(meta?.hasType ? { typeAngle: cfg.typeAngle } : {}),
          ...(meta?.periodic ? { rate: cfg.rate ?? prev[id].rate } : {}),
        } }
      })
    }
  }, [])

  // ── Audio input ───────────────────────────────────────────────────
  const playInputUrl = useCallback((url) => {
    setInputStatus('loading')
    setAudioInput(url, buildInputFilterConfigs(noise, tones))
      .then(() => setInputStatus('playing'))
      .catch(() => setInputStatus('error'))
  }, [noise, tones])

  const stopInput = useCallback(() => {
    stopAudioInput()
    setInputStatus('idle')
    setInputUrl('')
    setShowInput(false)
  }, [])

  // Keep the input filter bank tracking live knob/tone changes — without
  // this it stayed frozen at whatever was active the moment the URL was
  // submitted, so adjusting controls afterward had no audible effect.
  useEffect(() => {
    if (inputStatus === 'playing' && isAudioInputActive()) {
      updateAudioInputFilters(buildInputFilterConfigs(noise, tones))
    }
  }, [noise, tones, inputStatus])

  // ── Circular display drag + tap ───────────────────────────────────
  const onDisplayDown = useCallback((e) => {
    dispDragRef.current = true
    dispTotalMoved.current = 0
    setDispDragging(anyOn)
    setHoveredPlanet(null)
    setRingHover(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [anyOn])

  // Hit-test a pointer event's screen position against the last-drawn planet
  // glyph positions. Shared by hover (desktop mouse) and tap (touch, which
  // never fires a pointermove before pointerup) so astro signs are always
  // reachable regardless of input type.
  const hitTestPlanet = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const lx = (e.clientX - rect.left) * scaleX
    const ly = (e.clientY - rect.top) * scaleY
    for (const p of planetPosRef.current) {
      if (Math.hypot(lx - p.px, ly - p.py) < 14) return { ...p, scaleX, scaleY }
    }
    return null
  }, [])

  // Offset the tooltip to whichever side of the glyph has the most room,
  // instead of centering it on the glyph — centered made it overlap the
  // exact spot the cursor is trying to read. The ring sits near the top
  // of the console, with far more room below it than above, so vertical
  // placement always goes down rather than picking top/bottom evenly.
  const showPlanetTip = useCallback((hit) => {
    const canvas = canvasRef.current
    const dx = hit.px - canvas.width / 2, dy = hit.py - canvas.height / 2
    const placement = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : 'bottom'
    setHoveredPlanet({ name: hit.name, x: hit.px / hit.scaleX, y: hit.py / hit.scaleY, placement })
  }, [])

  // Hover-hit-test — drives the magnify effect in the draw loop and the info
  // tooltip below, independent of drag.
  const onDisplayHover = useCallback((e) => {
    const hit = hitTestPlanet(e)
    const hitName = hit ? hit.name : null
    if (hitName !== hoveredPlanetRef.current) {
      if (!hit) { setHoveredPlanet(null); return }
      showPlanetTip(hit)
    }
  }, [hitTestPlanet, showPlanetTip])

  const onDisplayMove = useCallback((e) => {
    if (!dispDragRef.current) onDisplayHover(e)
    dispTotalMoved.current += Math.abs(e.movementX) + Math.abs(e.movementY)
    // Only start adjusting after crossing tap-vs-drag threshold
    if (!dispDragRef.current || !anyOn || dispTotalMoved.current < 6) return
    const dy = e.movementY
    const dx = e.movementX

    setNoise(prev => {
      const next = { ...prev }
      for (const s of NOISE) {
        if (!prev[s.id].on) continue
        const newVol = Math.max(0, Math.min(1, prev[s.id].volume - dy / 400))
        const newAngle = (((prev[s.id].typeAngle + dx / 500 * 360) % 360) + 360) % 360
        setNoiseVolume(s.id, newVol)
        setNoiseType(s.id, newAngle)
        next[s.id] = { ...prev[s.id], volume: newVol, typeAngle: newAngle }
      }
      return next
    })
    setTones(prev => {
      const next = { ...prev }
      for (const s of TONES) {
        if (!prev[s.id].on) continue
        const newVol = Math.max(0, Math.min(1, prev[s.id].volume - dy / 400))
        setToneVolume(s.id, newVol)
        let updates = { volume: newVol }
        if (s.periodic) {
          const rateRange = s.rateMax - s.rateMin
          const newRate = Math.max(s.rateMin, Math.min(s.rateMax,
            prev[s.id].rate + dx / 500 * rateRange))
          updates.rate = newRate
        }
        next[s.id] = { ...prev[s.id], ...updates }
      }
      return next
    })
  }, [anyOn, onDisplayHover])

  const onDisplayUp = useCallback((e) => {
    const wasTap = dispTotalMoved.current < 6
    dispDragRef.current = false
    setDispDragging(false)
    // Touch devices never fire a pointermove hover before the tap, so a tap
    // landing on an astro sign wouldn't otherwise reveal its tooltip — hit-test
    // the tap itself and show the tooltip instead of randomizing in that case.
    const planetHit = wasTap && e ? hitTestPlanet(e) : null
    if (planetHit) {
      showPlanetTip(planetHit)
    } else if (wasTap && anyOn) {
      randomizeActive()
      setDispFlashing(true)
      setTimeout(() => setDispFlashing(false), 700)
    } else if (wasTap && !anyOn) {
      randomizeFirst()
    }
  }, [anyOn, randomizeActive, randomizeFirst, hitTestPlanet, showPlanetTip])

  // ── Noise handlers ────────────────────────────────────────────────
  const toggleNoise = useCallback((id) => {
    setNoise(prev => {
      const s = prev[id]
      s.on ? stopNoise(id) : startNoise(id, s.volume, s.typeAngle, s.freq)
      return { ...prev, [id]: { ...s, on: !s.on } }
    })
  }, [])

  const setNoiseVol = useCallback((id, v) => {
    setNoise(prev => { setNoiseVolume(id, v); return { ...prev, [id]: { ...prev[id], volume: v } } })
  }, [])

  const setNoiseTypeCb = useCallback((id, angle) => {
    setNoise(prev => { setNoiseType(id, angle); return { ...prev, [id]: { ...prev[id], typeAngle: angle } } })
  }, [])

  // ── Tone handlers ─────────────────────────────────────────────────
  const toggleTone = useCallback((id) => {
    setTones(prev => {
      const s = prev[id]
      const meta = TONES.find(t => t.id === id)
      if (s.on) {
        stopTone(id)
      } else {
        const param = meta?.hasType ? s.typeAngle : (meta?.periodic ? s.rate : null)
        startTone(id, s.volume, param)
      }
      return { ...prev, [id]: { ...s, on: !s.on } }
    })
  }, [])

  const setToneVol = useCallback((id, v) => {
    setTones(prev => { setToneVolume(id, v); return { ...prev, [id]: { ...prev[id], volume: v } } })
  }, [])

  const setToneRate = useCallback((id, r) => {
    setTones(prev => {
      const s = prev[id]
      if (s.on) { stopTone(id); startTone(id, s.volume, r) }
      return { ...prev, [id]: { ...s, rate: r } }
    })
  }, [])

  const setToneTypeCb = useCallback((id, angle) => {
    setTones(prev => {
      setToneParam(id, angle)
      return { ...prev, [id]: { ...prev[id], typeAngle: angle } }
    })
  }, [])

  // ── Stop-all / spacebar resume ──────────────────────────────────────
  const stopAllSounds = useCallback(() => {
    pausedRef.current = { noise, tones }
    NOISE.forEach(s => { if (noise[s.id].on) stopNoise(s.id) })
    TONES.forEach(s => { if (tones[s.id].on) stopTone(s.id) })
    stopAllNoisePulses()
    setNoise(prev => Object.fromEntries(Object.entries(prev).map(([k,v]) => [k,{...v,on:false}])))
    setTones(prev => Object.fromEntries(Object.entries(prev).map(([k,v]) => [k,{...v,on:false}])))
  }, [noise, tones])

  const resumeAllSounds = useCallback(() => {
    const snap = pausedRef.current
    if (!snap) return
    NOISE.forEach(s => {
      const st = snap.noise[s.id]
      if (st?.on) startNoise(s.id, st.volume, st.typeAngle, st.freq)
    })
    TONES.forEach(s => {
      const st = snap.tones[s.id]
      if (st?.on) startTone(s.id, st.volume, s.hasType ? st.typeAngle : (s.periodic ? st.rate : null))
    })
    setNoise(snap.noise)
    setTones(snap.tones)
    pausedRef.current = null
  }, [])

  // Spacebar stops everything playing, or resumes exactly what was paused
  useEffect(() => {
    function onKeyDown(e) {
      if (e.code !== 'Space') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      if (anyOn) stopAllSounds()
      else resumeAllSounds()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [anyOn, stopAllSounds, resumeAllSounds])

  return (
    <>
      {mode === 'party' && <Background anyOn={anyOn} activeSounds={activeSounds} />}

      <div className={`shell shell--${mode}`}>
        <div
          className={`unit${!anyOn ? ' unit--silent' : ''}${glitch ? ` unit--glitch-${glitch.variant}` : ''}`}
          style={glitch ? { '--glitch-dur': `${glitch.duration}s` } : undefined}
        >

          {/* Stop-all button — upper right, only visible when sounds are playing */}
          {anyOn && (
            <button
              className="unit__stop-all"
              onClick={stopAllSounds}
              title="Stop all sounds (spacebar)"
            >
              □
            </button>
          )}

          {/* Circular display — drag to control active knobs */}
          <div
            className={`unit__display-ring${dispDragging ? ' unit__display-ring--drag' : ''}${dispFlashing ? ' unit__display-ring--flash' : ''}${!anyOn ? ' unit__display-ring--silent' : ''}`}
            onPointerDown={onDisplayDown}
            onPointerMove={onDisplayMove}
            onPointerUp={onDisplayUp}
            onPointerCancel={onDisplayUp}
            onPointerEnter={() => setRingHover(true)}
            onPointerLeave={() => { setHoveredPlanet(null); setRingHover(false) }}
            style={{ touchAction: 'none', cursor: anyOn ? (dispDragging ? 'grabbing' : 'crosshair') : 'default' }}
          >
            <div className="unit__display-clip">
              <canvas ref={canvasRef} className="unit__viz" width={200} height={200} />
              {!anyOn && <div className="unit__display-idle">vibe</div>}
            </div>
            {hoveredPlanet && (
              <div
                className={`unit__planet-tip unit__planet-tip--${hoveredPlanet.placement}`}
                style={{ left: `${hoveredPlanet.x}px`, top: `${hoveredPlanet.y}px` }}
              >
                <span className="unit__planet-tip-name">{hoveredPlanet.name}</span>
                {PLANET_QUALITY[hoveredPlanet.name]}
              </div>
            )}
            {ringHover && !hoveredPlanet && !dispDragging && (
              <div className="unit__ring-tip">
                <div className="unit__ring-tip-row"><span className="unit__ring-tip-icon">&#9679;</span>tap — randomize</div>
                <div className="unit__ring-tip-row"><span className="unit__ring-tip-icon">&#8597;</span>up / down — volume</div>
                <div className="unit__ring-tip-row"><span className="unit__ring-tip-icon">&#8596;</span>left / right — rate</div>
              </div>
            )}
          </div>

          {/* Drag hint — shown below display */}
          <div className={`unit__display-hint${anyOn ? ' unit__display-hint--on' : ''}`}>
            ↔ freq &nbsp;·&nbsp; ↕ vol
          </div>

          {/* Nameplate */}
          <div className="unit__nameplate">
            <span className="unit__brand">vibe</span>
            <span className="unit__model">freq gen</span>
          </div>

          {/* Controls */}
          <div className="unit__body">
            {mode === 'party' ? (
              <>
                <section className="unit__section">
                  <div className="unit__section-label">noise</div>
                  <div className="unit__grid unit__grid--3">
                    {NOISE.map(s => {
                      const { color, glow } = noiseColorAt(s, noise[s.id].typeAngle)
                      return (
                        <SoundSlot
                          key={s.id} {...s}
                          color={color}
                          glow={glow}
                          active={noise[s.id].on}
                          volume={noise[s.id].volume}
                          param={noise[s.id].typeAngle}
                          paramLabel={getNoiseLabel(s, noise[s.id].typeAngle)}
                          paramMin={0}
                          paramMax={360}
                          innerCircular
                          idle={!anyOn}
                          onToggle={() => toggleNoise(s.id)}
                          onVolume={v => setNoiseVol(s.id, v)}
                          onParam={a => setNoiseTypeCb(s.id, a)}
                        />
                      )
                    })}
                  </div>
                </section>

                <section className="unit__section">
                  <div className="unit__section-label">tone</div>
                  <div className="unit__grid unit__grid--4">
                    {TONES.filter(s => !s.elemental).map(s => (
                      <SoundSlot
                        key={s.id} {...s}
                        active={tones[s.id].on}
                        volume={tones[s.id].volume}
                        param={s.periodic ? tones[s.id].rate : undefined}
                        paramLabel={s.periodic ? 'rate' : undefined}
                        paramMin={s.periodic ? s.rateMin : undefined}
                        paramMax={s.periodic ? s.rateMax : undefined}
                        idle={!anyOn}
                        onToggle={() => toggleTone(s.id)}
                        onVolume={v => setToneVol(s.id, v)}
                        onParam={s.periodic ? (r => setToneRate(s.id, r)) : undefined}
                      />
                    ))}
                  </div>
                </section>

                <section className="unit__section">
                  <div className="unit__section-label">element</div>
                  <div className="unit__grid unit__grid--4">
                    {TONES.filter(s => s.elemental).map(s => (
                      <SoundSlot
                        key={s.id} {...s}
                        active={tones[s.id].on}
                        volume={tones[s.id].volume}
                        param={tones[s.id].typeAngle}
                        paramLabel={getTypeName(s.id, tones[s.id].typeAngle)}
                        paramMin={0}
                        paramMax={360}
                        innerCircular
                        elemental
                        trigramLines={morphTrigram(TRIGRAMS[s.trigram], TRIGRAMS[s.pairTrigram], tones[s.id].typeAngle)}
                        trigramOutline={getClosestTrigramLines(s, tones[s.id].typeAngle)}
                        trigramLabel={getTrigramLabel(s, tones[s.id].typeAngle)}
                        idle={!anyOn}
                        onToggle={() => toggleTone(s.id)}
                        onVolume={v => setToneVol(s.id, v)}
                        onParam={a => setToneTypeCb(s.id, a)}
                      />
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <LoView
                NOISE={NOISE} TONES={TONES}
                noise={noise} tones={tones}
                onToggleNoise={toggleNoise}
                onToggleTone={toggleTone}
                onNoiseVol={setNoiseVol}
                onToneVol={setToneVol}
                onNoiseParam={setNoiseTypeCb}
              />
            )}
          </div>

          {/* Audio input panel */}
          {showInput && (
            <div className="unit__input-panel">
              <input
                className="unit__input-url"
                type="url"
                placeholder="audio url (mp3, wav, ogg…)"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && inputUrl.trim() && playInputUrl(inputUrl.trim())}
                autoFocus
              />
              {inputStatus === 'playing' && (
                <button className="unit__input-stop" onClick={stopInput}>■</button>
              )}
              {inputStatus === 'error' && (
                <span className="unit__input-err">cors blocked or bad url</span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="unit__foot">
            <button className="unit__joker-btn" onClick={() => {
              if (anyOn) {
                fadeMaster(0.06, 700)
                // Stop all sounds after fade so reading starts clean
                setTimeout(() => {
                  NOISE.forEach(s => { if (noise[s.id].on) stopNoise(s.id) })
                  TONES.forEach(s => { if (tones[s.id].on) stopTone(s.id) })
                  setNoise(prev => Object.fromEntries(Object.entries(prev).map(([k,v]) => [k,{...v,on:false}])))
                  setTones(prev => Object.fromEntries(Object.entries(prev).map(([k,v]) => [k,{...v,on:false}])))
                  fadeMaster(0.85, 200)
                }, 700)
              }
              setShowReading(true)
            }} title="Your vibe reading">
              🃏
            </button>
            <button className="unit__presets-btn" onClick={() => setShowPresets(true)} title="Presets">
              <PillIcon />
            </button>
            <button
              className={`unit__input-btn${inputStatus === 'playing' ? ' unit__input-btn--active' : ''}`}
              onClick={() => { if (inputStatus === 'playing') stopInput(); else setShowInput(v => !v) }}
              title="Audio input"
            >
              ⊃
            </button>
            <button className="unit__qr-btn" onClick={() => setShowQR(true)} title="Share / QR code">
              ◈
            </button>
          </div>
        </div>
      </div>

      {showPhilosophy && (
        <VibePhilosophy onClose={() => setShowPhilosophy(false)} />
      )}

      {showReading && (
        <VibeReading
          onClose={() => { fadeMaster(0.85, 400); setShowReading(false) }}
          onApply={applyReading}
          onRevealSound={revealReadingSound}
          NOISE={NOISE}
          TONES={TONES}
        />
      )}

      {showPresets && (
        <VibePresets
          onClose={() => setShowPresets(false)}
          onApply={applyPreset}
        />
      )}

      {showQR && (
        <VibeQR
          baseUrl={`${window.location.origin}${window.location.pathname}?v=${encodeSettings(noise, tones, NOISE, TONES)}`}
          name={new URLSearchParams(window.location.search).get('p') || ''}
          activeSounds={activeSounds}
          onClose={() => setShowQR(false)}
        />
      )}
    </>
  )
}
