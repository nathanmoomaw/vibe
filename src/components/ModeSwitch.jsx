import './ModeSwitch.css'

// Monochrome outline of 🎉 — cone + confetti streaks/specks, stroke-only to match the app's line-art style
function PartyIcon() {
  return (
    <svg className="mode-switch__party-icon" width="13" height="13" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 11 3 21l10-2.5" />
      <path d="M4 3v.01" />
      <path d="M21 7v.01" />
      <path d="M14 2v.01" />
      <path d="M21 19v.01" />
      <path d="M21 2c-1 .3-2 1-2 2.2 0 1-.8 1.8-1.8 1.8h-.4c-.9 0-1.7.6-1.9 1.5L14.5 9" />
      <path d="M21 13l-.9-.4c-.9-.3-1.9.2-2.1 1.2-.1.7-.7 1.2-1.4 1.2H16" />
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
