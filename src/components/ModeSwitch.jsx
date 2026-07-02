import './ModeSwitch.css'

// Monochrome outline of 🎉 — cone throwing confetti, dots as zero-length round-capped strokes
function PartyIcon() {
  return (
    <svg className="mode-switch__party-icon" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.8 11.3 2 22l10.7-3.79" />
      <path d="M4 3h.01" />
      <path d="M22 8h.01" />
      <path d="M15 2h.01" />
      <path d="M22 20h.01" />
      <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" />
      <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17" />
      <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7" />
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
