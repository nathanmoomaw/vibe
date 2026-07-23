import { useState } from 'react'
import { PRESETS } from '../utils/presets.js'
import { PillIcon } from './PillIcon.jsx'
import './VibePresets.css'

export function VibePresets({ onClose, onApply }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div className="vps__overlay" onClick={onClose}>
      <div className="vps__modal" onClick={e => e.stopPropagation()}>
        <button className="vps__close" onClick={onClose}>×</button>
        <div className="vps__title"><PillIcon size={120} rainbow /></div>
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
              <span className="vps__emoji">{p.emoji}</span>
              <span className="vps__label">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
