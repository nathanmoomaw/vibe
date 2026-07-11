import './ModeSwitch.css'

// Monochrome outline of 🎉 — a stroked horn with a bevelled tip (so it
// reads as a cone, not a blob) and a fanned confetti burst spraying out
// of its open end.
function PartyIcon() {
  return (
    <svg
      className="mode-switch__party-icon" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
    >
      <path d="M4 21 12 5 Q15.5 6 19 9Z" strokeLinejoin="bevel" />
      <path d="M15.5 2.5 17 0.5" />
      <path d="M22 5.5 23.5 4.3" />
      <path d="M21 12 23.5 11.5" />
      <circle cx="22.5" cy="8" r="0.9" fill="currentColor" stroke="none" />
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
