import { useState, useEffect } from 'react'
import { moonPhase, fetchWeather, buildReading, MOON_LABEL } from '../utils/reading.js'
import './VibeReading.css'

const MOON_SYMBOL = {
  new: '🌑', waxingCrescent: '🌒', firstQuarter: '🌓', waxingGibbous: '🌔',
  full: '🌕', waningGibbous: '🌖', lastQuarter: '🌗', waningCrescent: '🌘',
}

function SoundTag({ id, color }) {
  return <span className="vrd__tag" style={{ borderColor: color + '55', color }}>{id}</span>
}

export function VibeReading({ onClose, onApply, activeSounds, NOISE, TONES }) {
  const [reading, setReading] = useState(null)
  const [loading, setLoading] = useState(true)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    setLoading(true)
    const phase = moonPhase()
    fetchWeather().then(weather => {
      setReading(buildReading(phase, weather))
      setLoading(false)
    })
  }, [])

  const recommendedSounds = reading ? [
    ...NOISE.filter(s => reading.noise[s.id]?.on).map(s => ({ id: s.id, color: s.color })),
    ...TONES.filter(s => reading.tones[s.id]?.on).map(s => ({ id: s.id, color: s.color })),
  ] : []

  function handleApply() {
    if (!reading) return
    onApply(reading.noise, reading.tones)
    setApplied(true)
    setTimeout(() => setApplied(false), 2000)
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toLowerCase()
  const hourStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()

  return (
    <div className="vrd__overlay" onClick={onClose}>
      <div className="vrd__modal" onClick={e => e.stopPropagation()}>
        <button className="vrd__close" onClick={onClose}>×</button>

        <div className="vrd__header">
          <div className="vrd__dateline">{dateStr} · {hourStr}</div>
          <div className="vrd__title">your vibe</div>
        </div>

        {loading ? (
          <div className="vrd__loading">reading the field…</div>
        ) : (
          <>
            <div className="vrd__moon">
              <span className="vrd__moon-icon">{MOON_SYMBOL[reading.moonState]}</span>
              <span className="vrd__moon-label">{MOON_LABEL[reading.moonState]}</span>
            </div>

            <div className="vrd__lines">
              {reading.lines.map((line, i) => (
                <p key={i} className="vrd__line" style={{ animationDelay: `${i * 0.18}s` }}>{line}</p>
              ))}
            </div>

            <div className="vrd__sounds">
              {recommendedSounds.map(s => (
                <SoundTag key={s.id} id={s.id} color={s.color} />
              ))}
            </div>

            <button
              className={`vrd__apply${applied ? ' vrd__apply--done' : ''}`}
              onClick={handleApply}
            >
              {applied ? 'applied ✓' : 'apply reading'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
