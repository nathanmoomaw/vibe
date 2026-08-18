import { useState } from 'react'
import { PRESETS } from '../utils/presets.js'
import { PillIcon } from './PillIcon.jsx'
import './VibePresets.css'

// Fixed scatter for the zero-gravity confetti bits drifting around the
// title pill — hand-picked spread/delay/duration rather than randomized
// per-render, so the field doesn't jump around on every hover re-render.
const CONFETTI_BITS = [
  { x: -58, y: -34, delay: 0.0, dur: 7.2 },
  { x: 46,  y: -46, delay: 1.4, dur: 8.4 },
  { x: 64,  y: 6,   delay: 2.6, dur: 6.6 },
  { x: -66, y: 18,  delay: 0.8, dur: 7.8 },
  { x: 8,   y: -58, delay: 3.4, dur: 9.0 },
  { x: -18, y: 42,  delay: 2.0, dur: 7.0 },
  { x: 34,  y: 40,  delay: 4.2, dur: 8.0 },
]

export function VibePresets({ onClose, onApply }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div className="vps__overlay" onClick={onClose}>
      <div className="vps__modal" onClick={e => e.stopPropagation()}>
        <button className="vps__close" onClick={onClose}>×</button>
        <div className="vps__title">
          <PillIcon size={120} rainbow />
          <div className="vps__confetti" aria-hidden="true">
            {CONFETTI_BITS.map((b, i) => (
              <span
                key={i}
                className="vps__confetti-bit"
                style={{
                  '--cx': `${b.x}px`,
                  '--cy': `${b.y}px`,
                  animationDelay: `${b.delay}s`,
                  animationDuration: `${b.dur}s`,
                }}
              >✨</span>
            ))}
          </div>
        </div>
        <p className="vps__blurb">{hovered?.blurb ?? ''}</p>
        <div className="vps__grid">
          {PRESETS.map(p => (
            <button
              key={p.id}
              className="vps__card"
              style={{ '--vps-hue': p.hue }}
              onClick={() => onApply(p)}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(h => (h === p ? null : h))}
              onFocus={() => setHovered(p)}
              onBlur={() => setHovered(h => (h === p ? null : h))}
            >
              <span
                className="vps__emoji"
                style={p.emojiFlip
                  ? { display: 'inline-block', transform: 'translateY(6px) rotate(180deg)' }
                  : undefined}
              >{p.emoji}</span>
              <span className="vps__label">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
