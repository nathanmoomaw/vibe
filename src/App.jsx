import { useState, useCallback, useEffect, useRef } from 'react'
import { getAnalyser } from './audio/engine.js'
import { startNoise, stopNoise, setNoiseVolume, setNoiseFreq } from './audio/noise.js'
import { startTone, stopTone, setToneVolume } from './audio/tones.js'
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
  { id: 'water', label: 'water', color: '#44aaff', glow: 'rgba(68,170,255,0.4)',  periodic: false },
  { id: 'earth', label: 'earth', color: '#cc8855', glow: 'rgba(204,136,85,0.4)',  periodic: false },
]

function initState(slots, extra) {
  return Object.fromEntries(slots.map(s => [s.id, { on: false, volume: 0.5, ...extra(s) }]))
}

export default function App() {
  const [mode, setMode] = useState('party')
  const [noise, setNoise] = useState(() => initState(NOISE, s => ({ freq: s.filterDefault })))
  const [tones, setTones] = useState(() => initState(TONES, s => ({ rate: s.rateDefault ?? 20 })))

  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  const anyOn = [...Object.values(noise), ...Object.values(tones)].some(s => s.on)
  const activeColors = [
    ...NOISE.filter(s => noise[s.id].on).map(s => s.glow),
    ...TONES.filter(s => tones[s.id].on).map(s => s.glow),
  ]

  // Radial spectrum visualizer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!anyOn) {
      cancelAnimationFrame(rafRef.current)
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
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

      // Center dot
      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
      ctx.beginPath()
      ctx.arc(cx, cy, minR * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${0.05 + avg * 0.12})`
      ctx.fill()
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [anyOn])

  // Noise handlers
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

  // Tone handlers
  const toggleTone = useCallback((id) => {
    setTones(prev => {
      const s = prev[id]
      s.on ? stopTone(id) : startTone(id, s.volume, s.rate)
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

  return (
    <>
      {mode === 'party' && <Background anyOn={anyOn} activeColors={activeColors} />}

      <div className={`shell shell--${mode}`}>
        <div className="unit">

          {/* Speaker display — circular radial spectrum */}
          <div className="unit__display-ring">
            <canvas
              ref={canvasRef}
              className="unit__viz"
              width={200}
              height={200}
            />
            {!anyOn && <div className="unit__display-idle">vibe</div>}
          </div>

          {/* Faceplate label */}
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
