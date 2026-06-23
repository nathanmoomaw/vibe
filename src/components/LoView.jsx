import './LoView.css'

const BAR_LEN = 10

function bar(v) {
  const f = Math.round(v * BAR_LEN)
  return '█'.repeat(f) + '░'.repeat(BAR_LEN - f)
}

function LoRow({ id, label, on, volume, param, paramLabel, onToggle, onVolume, onParam }) {
  return (
    <div className="lo-row">
      <button className="lo-row__toggle" onClick={onToggle}>
        [{on ? 'ON' : '--'}]
      </button>
      <span className={`lo-row__label ${on ? 'lo-row__label--on' : ''}`}>{label}</span>
      <span className="lo-row__bar">{bar(volume)}</span>
      {param !== undefined && (
        <span className="lo-row__param">
          {String(Math.round(param)).padStart(4)}
          <span className="lo-row__param-unit">{paramLabel}</span>
        </span>
      )}
    </div>
  )
}

export default function LoView({
  NOISE, TONES, noise, tones,
  onToggleNoise, onToggleTone,
  onNoiseVol, onToneVol,
}) {
  return (
    <div className="lo">
      <div className="lo__section">
        <div className="lo__head">NOISE ─────────────────</div>
        {NOISE.map(s => (
          <LoRow
            key={s.id}
            id={s.id}
            label={s.id}
            on={noise[s.id].on}
            volume={noise[s.id].volume}
            param={noise[s.id].freq}
            paramLabel="hz"
            onToggle={() => onToggleNoise(s.id)}
            onVolume={v => onNoiseVol(s.id, v)}
          />
        ))}
      </div>

      <div className="lo__section">
        <div className="lo__head">TONE ──────────────────</div>
        {TONES.map(s => (
          <LoRow
            key={s.id}
            id={s.id}
            label={s.id}
            on={tones[s.id].on}
            volume={tones[s.id].volume}
            param={s.periodic ? tones[s.id].rate : undefined}
            paramLabel={s.periodic ? 's' : undefined}
            onToggle={() => onToggleTone(s.id)}
            onVolume={v => onToneVol(s.id, v)}
          />
        ))}
      </div>
    </div>
  )
}
