import { useState, useEffect } from 'react'
import { moonPhase, fetchWeather, buildReading, MOON_LABEL } from '../utils/reading.js'
import './VibeReading.css'

const MOON_SYMBOL = {
  new: '🌑', waxingCrescent: '🌒', firstQuarter: '🌓', waxingGibbous: '🌔',
  full: '🌕', waningGibbous: '🌖', lastQuarter: '🌗', waningCrescent: '🌘',
}

function SoundCard({ card, color, label }) {
  return (
    <div className="vrd__card" style={{ '--card-color': color }}>
      <div className="vrd__card-header">
        <span className="vrd__card-dot" style={{ background: color }} />
        <span className="vrd__card-name" style={{ color }}>{label}</span>
        <span className="vrd__card-type">{card.type}</span>
      </div>
      <p className="vrd__card-reason">{card.reason}</p>
    </div>
  )
}

export function VibeReading({ onClose, onApply, NOISE, TONES }) {
  const [reading, setReading] = useState(null)
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState(0)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    setLoading(true)
    const phase = moonPhase()
    fetchWeather().then(weather => {
      setReading(buildReading(phase, weather))
      setLoading(false)
    })
  }, [])

  // Merge soundCards with NOISE/TONES color + label data
  const allSlots = reading ? reading.soundCards.map(card => {
    const meta = card.type === 'noise'
      ? NOISE.find(s => s.id === card.id)
      : TONES.find(s => s.id === card.id)
    return { ...card, color: meta?.color ?? '#888', label: meta?.label ?? card.id }
  }) : []

  const allRevealed = allSlots.length > 0 && revealed >= allSlots.length

  function handleReveal() {
    setRevealed(r => Math.min(r + 1, allSlots.length))
  }

  function handleApply() {
    if (!reading) return
    onApply(reading.noise, reading.tones, reading.pulseHz)
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
              <div className="vrd__moon-meta">
                <span className="vrd__moon-label">{MOON_LABEL[reading.moonState]}</span>
                <span className="vrd__tidal-label">{reading.tidal.label}</span>
                <span className="vrd__intent-label">∿ {reading.intentLabel}</span>
              </div>
            </div>

            <div className="vrd__lines">
              {reading.lines.map((line, i) => (
                <p key={i} className="vrd__line" style={{ animationDelay: `${i * 0.18}s` }}>{line}</p>
              ))}
            </div>

            {/* Revealed sound cards */}
            {revealed > 0 && (
              <div className="vrd__cards">
                {allSlots.slice(0, revealed).map((card, i) => (
                  <SoundCard key={card.id} card={card} color={card.color} label={card.label} />
                ))}
              </div>
            )}

            {/* Reveal next / apply */}
            {!allRevealed ? (
              <button className="vrd__reveal-btn" onClick={handleReveal}>
                {revealed === 0 ? 'reveal the prescription ↓' : `next · ${allSlots.length - revealed} remaining`}
              </button>
            ) : (
              <button
                className={`vrd__apply${applied ? ' vrd__apply--done' : ''}`}
                onClick={handleApply}
              >
                {applied ? 'applied ✓' : 'apply reading'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
