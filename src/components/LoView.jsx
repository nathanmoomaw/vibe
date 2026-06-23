import './LoView.css'

const BAR_LEN = 8

function bar(v) {
  const f = Math.round(v * BAR_LEN)
  return '█'.repeat(f) + '░'.repeat(BAR_LEN - f)
}

function LoRow({ id, label, on, volume, param, paramLabel, onToggle, onVolume, onParam }) {
  return (
    <div className="lo-row">
      <div className="lo-row__main">
        <button className="lo-row__toggle" onClick={onToggle}>
          [{on ? 'ON' : '--'}]
        </button>
        <span className={`lo-row__label ${on ? 'lo-row__label--on' : ''}`}>{label}</span>
        <span className="lo-row__bar" aria-hidden="true">{bar(volume)}</span>
        {param !== undefined && (
          <span className="lo-row__param">
            {String(Math.round(param)).padStart(4)}
            <span className="lo-row__unit">{paramLabel}</span>
          </span>
        )}
      </div>

      {on && (
        <div className="lo-row__sliders">
          <label className="lo-row__slider-wrap">
            <span className="lo-row__slider-lbl">vol</span>
            <input
              type="range" className="lo-row__slider"
              min="0" max="1" step="0.02"
              value={volume}
              onChange={e => onVolume(parseFloat(e.target.value))}
            />
          </label>
          {onParam && param !== undefined && (
            <label className="lo-row__slider-wrap">
              <span className="lo-row__slider-lbl">{paramLabel}</span>
              <input
                type="range" className="lo-row__slider"
                min={paramLabel === 'hz' ? 100 : 3}
                max={paramLabel === 'hz' ? 10000 : 120}
                step="1"
                value={param}
                onChange={e => onParam(parseFloat(e.target.value))}
              />
            </label>
          )}
        </div>
      )}
    </div>
  )
}

export default function LoView({
  NOISE, TONES, noise, tones,
  onToggleNoise, onToggleTone,
  onNoiseVol, onToneVol,
  onNoiseParam,
}) {
  return (
    <div className="lo">
      <div className="lo__section">
        <div className="lo__head">NOISE ──────────────────────</div>
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
            onParam={v => onNoiseParam?.(s.id, v)}
          />
        ))}
      </div>

      <div className="lo__section">
        <div className="lo__head">TONE ───────────────────────</div>
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
