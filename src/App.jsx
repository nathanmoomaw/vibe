import { useState, useCallback, useEffect, useRef } from 'react'
import { getAnalyser } from './audio/engine.js'
import { startNoise, stopNoise, setNoiseVolume, setNoiseFreq } from './audio/noise.js'
import { startTone, stopTone, setToneVolume, setToneParam } from './audio/tones.js'
import Background from './components/Background.jsx'
import SoundSlot from './components/SoundSlot.jsx'
import LoView from './components/LoView.jsx'
import ModeSwitch from './components/ModeSwitch.jsx'
import './App.css'

export const NOISE = [
  { id: 'white', label: 'white', color: '#d4d4d4', glow: 'rgba(212,212,212,0.35)',
    filterDefault: 2000, filterMin: 200, filterMax: 8000 },
  { id: 'pink',  label: 'pink',  color: '#ff7eb3', glow: 'rgba(255,126,179,0.4)',
    filterDefault: 900,  filterMin: 100, filterMax: 5000 },
  { id: 'blue',  label: 'blue',  color: '#66ccff', glow: 'rgba(102,204,255,0.4)',
    filterDefault: 3500, filterMin: 500, filterMax: 10000 },
]

export const TONES = [
  { id: 'bell',  label: 'bell',  color: '#ffd166', glow: 'rgba(255,209,102,0.4)', periodic: true,  rateDefault: 25, rateMin: 8,   rateMax: 90 },
  { id: 'chime', label: 'chime', color: '#ffe8a0', glow: 'rgba(255,232,160,0.4)', periodic: true,  rateDefault: 10, rateMin: 3,   rateMax: 40 },
  { id: 'gong',  label: 'gong',  color: '#ff9944', glow: 'rgba(255,153,68,0.4)',  periodic: true,  rateDefault: 55, rateMin: 20,  rateMax: 120 },
  { id: 'birds', label: 'birds', color: '#88ee88', glow: 'rgba(136,238,136,0.4)', periodic: true,  rateDefault: 14, rateMin: 5,   rateMax: 60 },
  { id: 'wind',  label: 'wind',  color: '#aaddcc', glow: 'rgba(170,221,204,0.4)', periodic: false },
  { id: 'water', label: 'water', color: '#44aaff', glow: 'rgba(68,170,255,0.4)',  periodic: false, hasType: true },
  { id: 'fire',  label: 'fire',  color: '#ff6633', glow: 'rgba(255,102,51,0.4)',  periodic: false, hasType: true },
  { id: 'earth', label: 'earth', color: '#cc8855', glow: 'rgba(204,136,85,0.4)',  periodic: false },
]

const WATER_TYPES = ['stream', 'rain', 'ocean']
const FIRE_TYPES  = ['candle', 'campfire', 'bonfire']

function getTypeName(id, angle) {
  const a = ((angle % 360) + 360) % 360
  const idx = a < 60 || a >= 300 ? 0 : a < 180 ? 1 : 2
  if (id === 'water') return WATER_TYPES[idx]
  if (id === 'fire')  return FIRE_TYPES[idx]
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

  const canvasRef       = useRef(null)
  const rafRef          = useRef(null)
  const dispDragRef     = useRef(false)
  const dispTotalMoved  = useRef(0)

  const anyOn = [...Object.values(noise), ...Object.values(tones)].some(s => s.on)
  const activeSounds = [
    ...NOISE.filter(s => noise[s.id].on).map(s => ({ id: s.id, glow: s.glow })),
    ...TONES.filter(s => tones[s.id].on).map(s => ({ id: s.id, glow: s.glow })),
  ]

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
    }
  }, [anyOn, randomizeActive])

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
            <span className="unit__model">frequency field</span>
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
                    {TONES.map(s => (
                      <SoundSlot
                        key={s.id} {...s}
                        active={tones[s.id].on}
                        volume={tones[s.id].volume}
                        param={s.hasType ? tones[s.id].typeAngle : (s.periodic ? tones[s.id].rate : undefined)}
                        paramLabel={s.hasType ? getTypeName(s.id, tones[s.id].typeAngle) : (s.periodic ? 'rate' : undefined)}
                        paramMin={s.hasType ? 0 : (s.periodic ? s.rateMin : undefined)}
                        paramMax={s.hasType ? 360 : (s.periodic ? s.rateMax : undefined)}
                        innerCircular={!!s.hasType}
                        onToggle={() => toggleTone(s.id)}
                        onVolume={v => setToneVol(s.id, v)}
                        onParam={s.hasType ? (a => setToneTypeCb(s.id, a)) : (s.periodic ? (r => setToneRate(s.id, r)) : undefined)}
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
          </div>
        </div>
      </div>
    </>
  )
}
