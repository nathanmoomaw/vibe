import { useCallback } from 'react'
import { DualKnob } from './DualKnob.jsx'
import './SoundSlot.css'

function fmtParam(v, label) {
  if (label === 'freq') return v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${Math.round(v)}`
  if (label === 'rate') return `${Math.round(v)}s`
  return `${Math.round(v)}`
}

export default function SoundSlot({
  id, label, color, glow,
  active, volume, param, paramLabel, paramMin, paramMax,
  onToggle, onVolume, onParam,
}) {
  const handleVolume = useCallback((v) => onVolume(Math.round(v * 100) / 100), [onVolume])
  const handleParam  = useCallback((v) => onParam?.(v), [onParam])

  return (
    <div
      className={`slot ${active ? 'slot--on' : ''}`}
      style={{ '--glow': glow, '--color': color }}
      data-id={id}
    >
      <button
        className="slot__toggle"
        onClick={onToggle}
        aria-pressed={active}
        aria-label={label}
      >
        <span className="slot__label">{label}</span>
        <span className={`slot__dot ${active ? 'slot__dot--on' : ''}`} />
      </button>

      <div className={`slot__knob-wrap ${active ? 'slot__knob-wrap--on' : ''}`}>
        <DualKnob
          mode={onParam ? 'dual' : 'single'}
          mixValue={volume}
          paramValue={param ?? 0}
          onMixChange={handleVolume}
          onParamChange={handleParam}
          color={color}
          size={46}
          mixLabel={`${Math.round(volume * 100)}%`}
          paramLabel={param !== undefined ? fmtParam(param, paramLabel) : undefined}
          minParam={paramMin ?? 0}
          maxParam={paramMax ?? 1}
        />
      </div>
    </div>
  )
}
