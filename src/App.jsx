import { useState, useCallback, useEffect, useRef } from 'react'
import { getAnalyser } from './audio/engine.js'
import { startNoise, stopNoise, setNoiseVolume, setNoiseFreq } from './audio/noise.js'
import { startTone, stopTone, setToneVolume, setToneParam } from './audio/tones.js'
import Background from './components/Background.jsx'
import SoundSlot from './components/SoundSlot.jsx'
import LoView from './components/LoView.jsx'
import ModeSwitch from './components/ModeSwitch.jsx'
import { VibeQR } from './components/VibeQR.jsx'
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

export const NOISE = [
  { id: 'white', label: 'white', color: '#d4d4d4', glow: 'rgba(212,212,212,0.35)',
    filterDefault: 2000, filterMin: 200, filterMax: 8000 },
  { id: 'pink',  label: 'pink',  color: '#ff7eb3', glow: 'rgba(255,126,179,0.4)',
    filterDefault: 900,  filterMin: 100, filterMax: 5000 },
  { id: 'blue',  label: 'blue',  color: '#66ccff', glow: 'rgba(102,204,255,0.4)',
    filterDefault: 3500, filterMin: 500, filterMax: 10000 },
]

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

export const TONES = [
  { id: 'bell',  label: 'bell',  color: '#ffd166', glow: 'rgba(255,209,102,0.4)', periodic: true, rateDefault: 25, rateMin: 8,  rateMax: 90  },
  { id: 'chime', label: 'chime', color: '#ffe8a0', glow: 'rgba(255,232,160,0.4)', periodic: true, rateDefault: 10, rateMin: 3,  rateMax: 40  },
  { id: 'gong',  label: 'gong',  color: '#ff9944', glow: 'rgba(255,153,68,0.4)',  periodic: true, rateDefault: 55, rateMin: 20, rateMax: 120 },
  { id: 'birds', label: 'birds', color: '#88ee88', glow: 'rgba(136,238,136,0.4)', periodic: true, rateDefault: 14, rateMin: 5,  rateMax: 60  },
  // Elemental sounds — I Ching Fu Xi order: Li (3) → Xun (5) → Kan (6) → Kun (8)
  { id: 'fire',  label: 'fire',  color: '#ff6633', glow: 'rgba(255,102,51,0.4)',  periodic: false, hasType: true, elemental: true, trigram: 'Li',  pairTrigram: 'Kan'  },
  { id: 'wind',  label: 'wind',  color: '#aaddcc', glow: 'rgba(170,221,204,0.4)', periodic: false, hasType: true, elemental: true, trigram: 'Xun', pairTrigram: 'Zhen' },
  { id: 'water', label: 'water', color: '#44aaff', glow: 'rgba(68,170,255,0.4)',  periodic: false, hasType: true, elemental: true, trigram: 'Kan', pairTrigram: 'Li'   },
  { id: 'earth', label: 'earth', color: '#cc8855', glow: 'rgba(204,136,85,0.4)',  periodic: false, hasType: true, elemental: true, trigram: 'Kun', pairTrigram: 'Qian' },
]

const WATER_TYPES = ['stream', 'rain', 'ocean']
const FIRE_TYPES  = ['candle', 'campfire', 'bonfire']
const WIND_TYPES  = ['breeze', 'gale', 'squall']
const EARTH_TYPES = ['loam', 'stone', 'crystal']

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

export default function App() {
  const [mode, setMode] = useState('party')
  const [noise, setNoise] = useState(() => initState(NOISE, s => ({ freq: s.filterDefault })))
  const [tones, setTones] = useState(() => initState(TONES, s => ({ rate: s.rateDefault ?? 20, typeAngle: 0 })))
  const [dispDragging, setDispDragging] = useState(false)
  const [dispFlashing, setDispFlashing] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const canvasRef       = useRef(null)
  const rafRef          = useRef(null)
  const dispDragRef     = useRef(false)
  const dispTotalMoved  = useRef(0)
  const noiseRef        = useRef(noise)
  useEffect(() => { noiseRef.current = noise }, [noise])

  const anyOn = [...Object.values(noise), ...Object.values(tones)].some(s => s.on)
  const activeSounds = [
    ...NOISE.filter(s => noise[s.id].on).map(s => ({ id: s.id, glow: s.glow })),
    ...TONES.filter(s => tones[s.id].on).map(s => ({ id: s.id, glow: s.glow })),
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
          if (decoded.noise[s.id].on) startNoise(s.id, decoded.noise[s.id].volume, decoded.noise[s.id].freq)
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
      const maxR = cx * 0.88
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

      if (activeFreqs.length > 0) {
        for (const p of PLANETS) {
          const fade = Math.max(...activeFreqs.map(f => planetFade(f, p.freq)))
          if (fade < 0.02) continue

          const angle = (eclipticLon(p.name) * Math.PI / 180) - Math.PI / 2
          const pr = maxR + 9
          const px = cx + Math.cos(angle) * pr
          const py = cy + Math.sin(angle) * pr

          ctx.save()
          ctx.globalAlpha = fade * 0.9
          ctx.shadowColor = 'rgba(255,200,80,0.9)'
          ctx.shadowBlur = 5
          ctx.font = `bold ${9 + Math.round(fade * 4)}px serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#ffd080'
          ctx.fillText(p.symbol, px, py)
          ctx.restore()
        }
      }
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
        const freqRange = s.filterMax - s.filterMin
        const newFreq = Math.max(s.filterMin, Math.min(s.filterMax,
          prev[s.id].freq + (Math.random() - 0.5) * freqRange * 0.5))
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
    const presets = [
      { n: [{id:'pink',v:0.55,f:800}],  t: [{id:'wind',v:0.48,p:30}, {id:'bell',v:0.3,p:32}] },
      { n: [{id:'blue',v:0.5,f:3500}],  t: [{id:'water',v:0.52,p:0}, {id:'chime',v:0.32,p:11}] },
      { n: [{id:'white',v:0.45,f:1800}], t: [{id:'earth',v:0.5,p:0}, {id:'gong',v:0.28,p:65}] },
      { n: [{id:'pink',v:0.52,f:700}],  t: [{id:'fire',v:0.48,p:120},{id:'birds',v:0.3,p:18}] },
      { n: [{id:'blue',v:0.48,f:4200}], t: [{id:'wind',v:0.5,p:85}, {id:'gong',v:0.26,p:72}] },
    ]
    const preset = presets[Math.floor(Math.random() * presets.length)]
    setNoise(prev => {
      const next = { ...prev }
      for (const { id, v, f } of preset.n) {
        startNoise(id, v, f)
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

  // ── Circular display drag + tap ───────────────────────────────────
  const onDisplayDown = useCallback((e) => {
    dispDragRef.current = true
    dispTotalMoved.current = 0
    setDispDragging(anyOn)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [anyOn])

  const onDisplayMove = useCallback((e) => {
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
        const freqRange = s.filterMax - s.filterMin
        const newFreq = Math.max(s.filterMin, Math.min(s.filterMax,
          prev[s.id].freq + dx / 500 * freqRange))
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
  }, [anyOn])

  const onDisplayUp = useCallback(() => {
    const wasTap = dispTotalMoved.current < 6
    dispDragRef.current = false
    setDispDragging(false)
    if (wasTap && anyOn) {
      randomizeActive()
      setDispFlashing(true)
      setTimeout(() => setDispFlashing(false), 700)
    } else if (wasTap && !anyOn) {
      randomizeFirst()
    }
  }, [anyOn, randomizeActive, randomizeFirst])

  // ── Noise handlers ────────────────────────────────────────────────
  const toggleNoise = useCallback((id) => {
    setNoise(prev => {
      const s = prev[id]
      s.on ? stopNoise(id) : startNoise(id, s.volume, s.freq)
      return { ...prev, [id]: { ...s, on: !s.on } }
    })
  }, [])

  const setNoiseVol = useCallback((id, v) => {
    setNoise(prev => { setNoiseVolume(id, v); return { ...prev, [id]: { ...prev[id], volume: v } } })
  }, [])

  const setNoiseFreqCb = useCallback((id, hz) => {
    setNoise(prev => { setNoiseFreq(id, hz); return { ...prev, [id]: { ...prev[id], freq: hz } } })
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

  return (
    <>
      {mode === 'party' && <Background anyOn={anyOn} activeSounds={activeSounds} />}

      <div className={`shell shell--${mode}`}>
        <div className="unit">

          {/* Circular display — drag to control active knobs */}
          <div
            className={`unit__display-ring${dispDragging ? ' unit__display-ring--drag' : ''}${dispFlashing ? ' unit__display-ring--flash' : ''}`}
            onPointerDown={onDisplayDown}
            onPointerMove={onDisplayMove}
            onPointerUp={onDisplayUp}
            onPointerCancel={onDisplayUp}
            style={{ touchAction: 'none', cursor: anyOn ? (dispDragging ? 'grabbing' : 'crosshair') : 'default' }}
          >
            <canvas ref={canvasRef} className="unit__viz" width={200} height={200} />
            {!anyOn && <div className="unit__display-idle">vibe</div>}
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
                    {NOISE.map(s => (
                      <SoundSlot
                        key={s.id} {...s}
                        active={noise[s.id].on}
                        volume={noise[s.id].volume}
                        param={noise[s.id].freq}
                        paramLabel="freq"
                        paramMin={s.filterMin}
                        paramMax={s.filterMax}
                        onToggle={() => toggleNoise(s.id)}
                        onVolume={v => setNoiseVol(s.id, v)}
                        onParam={hz => setNoiseFreqCb(s.id, hz)}
                      />
                    ))}
                  </div>
                </section>

                <div className="unit__divider" />

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
                        onToggle={() => toggleTone(s.id)}
                        onVolume={v => setToneVol(s.id, v)}
                        onParam={s.periodic ? (r => setToneRate(s.id, r)) : undefined}
                      />
                    ))}
                  </div>
                </section>

                <div className="unit__divider" />

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
                        trigramLabel={getTrigramLabel(s, tones[s.id].typeAngle)}
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
                onNoiseParam={setNoiseFreqCb}
              />
            )}
          </div>

          {/* Footer */}
          <div className="unit__foot">
            <ModeSwitch mode={mode} onChange={setMode} />
            <button className="unit__qr-btn" onClick={() => setShowQR(true)} title="Share / QR code">
              ◈
            </button>
          </div>
        </div>
      </div>

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
