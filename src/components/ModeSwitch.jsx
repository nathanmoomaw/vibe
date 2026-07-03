import './ModeSwitch.css'

// Monochrome outline of 🎉 — a solid cone + a few chunky confetti flecks.
// Kept to a handful of bold filled shapes (no thin strokes or hairline dots)
// so it still reads clearly at the tiny footer-button size.
function PartyIcon() {
  return (
    <svg className="mode-switch__party-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 21 9 8 20 14Z" />
      <rect x="14.2" y="2.3" width="2.6" height="6.2" rx="1.3" transform="rotate(20 15.5 5.4)" />
      <rect x="19.2" y="6.6" width="2.6" height="6.2" rx="1.3" transform="rotate(55 20.5 9.7)" />
      <circle cx="21" cy="3.2" r="1.4" />
    </svg>
  )
}

export default function ModeSwitch({ mode, onChange }) {
  return (
    <div className="mode-switch" role="group" aria-label="display mode">
      <button
        className={`mode-switch__btn ${mode === 'party' ? 'mode-switch__btn--on' : ''}`}
        onClick={() => onChange('party')}
        aria-pressed={mode === 'party'}
        aria-label="party"
        title="party"
      >
        <PartyIcon />
      </button>
      <span className="mode-switch__sep">·</span>
      <button
        className={`mode-switch__btn ${mode === 'lo' ? 'mode-switch__btn--on' : ''}`}
        onClick={() => onChange('lo')}
        aria-pressed={mode === 'lo'}
      >
        lo
      </button>
    </div>
  )
}
