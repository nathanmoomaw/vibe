import { PRESETS } from '../utils/presets.js'
import './VibePresets.css'

export function VibePresets({ onClose, onApply }) {
  return (
    <div className="vps__overlay" onClick={onClose}>
      <div className="vps__modal" onClick={e => e.stopPropagation()}>
        <button className="vps__close" onClick={onClose}>×</button>
        <div className="vps__title">presets</div>
        <div className="vps__grid">
          {PRESETS.map(p => (
            <button
              key={p.id}
              className="vps__card info-tip"
              data-tip={p.blurb}
              onClick={() => onApply(p)}
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
