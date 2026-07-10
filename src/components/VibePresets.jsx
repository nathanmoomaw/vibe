import { PRESETS } from '../utils/presets.js'
import { PillIcon } from './PillIcon.jsx'
import './VibePresets.css'

export function VibePresets({ onClose, onApply }) {
  return (
    <div className="vps__overlay" onClick={onClose}>
      <div className="vps__modal" onClick={e => e.stopPropagation()}>
        <button className="vps__close" onClick={onClose}>×</button>
        <div className="vps__title"><PillIcon size={30} /></div>
        <div className="vps__grid">
          {PRESETS.map(p => (
            <button key={p.id} className="vps__card" onClick={() => onApply(p)}>
              <span className="vps__emoji">{p.emoji}</span>
              <span className="vps__label">{p.label}</span>
              <p className="vps__blurb">{p.blurb}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
