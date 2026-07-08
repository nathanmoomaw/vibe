import './ModeSwitch.css'

// Monochrome outline of 🎉 — a stroked cone with a few well-spaced confetti
// marks. Pure strokes (no thin filled slivers) so it stays crisp and doesn't
// smear into a blob at the tiny footer-button size.
function PartyIcon() {
  return (
    <svg
      className="mode-switch__party-icon" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M3.5 21 10 8 18.5 13Z" />
      <path d="M14.5 3.2 16 6.6" />
      <path d="M19.5 4.8 18.3 8" />
      <path d="M21 10.5 17.8 11.6" />
      <circle cx="20.6" cy="15.4" r="1" fill="currentColor" stroke="none" />
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
