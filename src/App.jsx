import { useState, useCallback, useEffect, useRef } from 'react'
import { getAnalyser } from './audio/engine.js'
import { startNoise, stopNoise, setNoiseVolume, setNoiseFreq } from './audio/noise.js'
import { startTone, stopTone, setToneVolume } from './audio/tones.js'
import SoundSlot from './components/SoundSlot.jsx'
import './App.css'

const NOISE = [
  { id: 'white', label: 'white', color: '#d4d4d4', glow: 'rgba(212,212,212,0.35)',
    filterDefault: 2000, filterMin: 200, filterMax: 8000 },
  { id: 'pink',  label: 'pink',  color: '#ff7eb3', glow: 'rgba(255,126,179,0.4)',
    filterDefault: 900, filterMin: 100, filterMax: 5000 },
  { id: 'blue',  label: 'blue',  color: '#66ccff', glow: 'rgba(102,204,255,0.4)',
    filterDefault: 3500, filterMin: 500, filterMax: 10000 },
]

const TONES = [
  { id: 'bell',  label: 'bell',  color: '#ffd166', glow: 'rgba(255,209,102,0.4)', periodic: true,  rateDefault: 25, rateMin: 8,  rateMax: 90 },
  { id: 'chime', label: 'chime', color: '#ffe8a0', glow: 'rgba(255,232,160,0.4)', periodic: true,  rateDefault: 10, rateMin: 3,  rateMax: 40 },
  { id: 'gong',  label: 'gong',  color: '#ff9944', glow: 'rgba(255,153,68,0.4)',  periodic: true,  rateDefault: 55, rateMin: 20, rateMax: 120 },
  { id: 'birds', label: 'birds', color: '#88ee88', glow: 'rgba(136,238,136,0.4)', periodic: true,  rateDefault: 14, rateMin: 5,  rateMax: 60 },
  { id: 'wind',  label: 'wind',  color: '#aaddcc', glow: 'rgba(170,221,204,0.4)', periodic: false },
  { id: 'water', label: 'water', color: '#44aaff', glow: 'rgba(68,170,255,0.4)',  periodic: false },
  { id: 'earth', label: 'earth', color: '#cc8855', glow: 'rgba(204,136,85,0.4)',  periodic: false },
]

function initState(slots, extra) {
  return Object.fromEntries(slots.map(s => [s.id, { on: false, volume: 0.5, ...extra(s) }]))
}

export default function App() {
  const [noise, setNoise] = useState(() =>
    initState(NOISE, s => ({ freq: s.filterDefault }))
  )
  const [tones, setTones] = useState(() =>
    initState(TONES, s => ({ rate: s.rateDefault ?? 20 }))
  )

  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  // Visualizer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const anyActive = [...Object.values(noise), ...Object.values(tones)].some(s => s.on)
    if (!anyActive) {
      cancelAnimationFrame(rafRef.current)
      const ctx2d = canvas.getContext('2d')
      ctx2d.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    const analyser = getAnalyser()
    const data = new Uint8Array(analyser.frequencyBinCount)

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      const ctx2d = canvas.getContext('2d')
      const { width, height } = canvas
      ctx2d.clearRect(0, 0, width, height)

      const bars = 48
      const step = Math.floor(data.length / bars)
      const barW = width / bars

      for (let i = 0; i < bars; i++) {
        const val = data[i * step] / 255
        const h = val * height * 0.9
        const hue = 200 + i * 3
        ctx2d.fillStyle = `hsla(${hue}, 70%, 60%, ${0.4 + val * 0.5})`
        ctx2d.fillRect(i * barW, height - h, barW - 1, h)
      }
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [noise, tones])

  // Noise handlers
  const toggleNoise = useCallback((id) => {
    setNoise(prev => {
      const s = prev[id]
      if (s.on) {
        stopNoise(id)
      } else {
        startNoise(id, s.volume, s.freq)
      }
      return { ...prev, [id]: { ...s, on: !s.on } }
    })
  }, [])

  const setNoiseVol = useCallback((id, v) => {
    setNoise(prev => {
      setNoiseVolume(id, v)
      return { ...prev, [id]: { ...prev[id], volume: v } }
    })
  }, [])

  const setNoiseFreqCb = useCallback((id, hz) => {
    setNoise(prev => {
      setNoiseFreq(id, hz)
      return { ...prev, [id]: { ...prev[id], freq: hz } }
    })
  }, [])

  // Tone handlers
  const toggleTone = useCallback((id) => {
    setTones(prev => {
      const s = prev[id]
      if (s.on) {
        stopTone(id)
      } else {
        startTone(id, s.volume, s.rate)
      }
      return { ...prev, [id]: { ...s, on: !s.on } }
    })
  }, [])

  const setToneVol = useCallback((id, v) => {
    setTones(prev => {
      setToneVolume(id, v)
      return { ...prev, [id]: { ...prev[id], volume: v } }
    })
  }, [])

  const setToneRate = useCallback((id, r) => {
    setTones(prev => {
      const s = prev[id]
      if (s.on) { stopTone(id); startTone(id, s.volume, r) }
      return { ...prev, [id]: { ...s, rate: r } }
    })
  }, [])

  const anyOn = [...Object.values(noise), ...Object.values(tones)].some(s => s.on)

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">vibe</h1>
        <p className="app__sub">frequency field</p>
      </header>

      <canvas
        ref={canvasRef}
        className={`app__viz ${anyOn ? 'app__viz--on' : ''}`}
        width={600}
        height={60}
      />

      <section className="app__section">
        <h2 className="app__section-label">noise</h2>
        <div className="app__grid app__grid--noise">
          {NOISE.map(s => (
            <SoundSlot
              key={s.id}
              {...s}
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

      <section className="app__section">
        <h2 className="app__section-label">tone</h2>
        <div className="app__grid app__grid--tones">
          {TONES.map(s => (
            <SoundSlot
              key={s.id}
              {...s}
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

      <footer className="app__footer">
        <span>♦</span>
      </footer>
    </div>
  )
}
