import { useState, useCallback } from 'react'
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

  const allStates = [...Object.values(noise), ...Object.values(tones)]
  const anyOn = allStates.some(s => s.on)
  const activeColors = [
    ...NOISE.filter(s => noise[s.id].on).map(s => s.glow),
    ...TONES.filter(s => tones[s.id].on).map(s => s.glow),
  ]

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
          {/* Faceplate */}
          <div className="unit__face">
            <div className="unit__screw unit__screw--tl" />
            <div className="unit__screw unit__screw--tr" />
            <h1 className="unit__title">vibe</h1>
            <p className="unit__sub">frequency field</p>
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

                <div className="unit__divider" />

                <section className="unit__section">
                  <div className="unit__section-label">tone</div>
                  <div className="unit__grid unit__grid--4">
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
              </>
            ) : (
              <LoView
                NOISE={NOISE}
                TONES={TONES}
                noise={noise}
                tones={tones}
                onToggleNoise={toggleNoise}
                onToggleTone={toggleTone}
                onNoiseVol={setNoiseVol}
                onToneVol={setToneVol}
              />
            )}
          </div>

          {/* Bottom strip */}
          <div className="unit__foot">
            <div className="unit__screw unit__screw--bl" />
            <ModeSwitch mode={mode} onChange={setMode} />
            <div className="unit__screw unit__screw--br" />
          </div>
        </div>
      </div>
    </>
  )
}
