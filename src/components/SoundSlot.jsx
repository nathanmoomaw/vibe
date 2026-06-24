import { useCallback } from 'react'
import { DualKnob } from './DualKnob.jsx'
import { Trigram } from './Trigram.jsx'
import './SoundSlot.css'

function fmtParam(v, label) {
  if (label === 'freq') return v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${Math.round(v)}`
  if (label === 'rate') return `${Math.round(v)}s`
  return `${Math.round(v)}`
}

export default function SoundSlot({
  id, label, color, glow,
  active, volume, param, paramLabel, paramMin, paramMax,
  onToggle, onVolume, onParam, innerCircular = false,
  elemental = false, trigramLines = null, trigramLabel = null,
}) {
  const handleVolume = useCallback((v) => onVolume(Math.round(v * 100) / 100), [onVolume])
  const handleParam  = useCallback((v) => onParam?.(v), [onParam])

  return (
    <div
      className={`slot ${active ? 'slot--on' : ''}`}
      style={{ '--glow': glow, '--color': color }}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={label}
      onClick={onToggle}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
    >
      {/* Label + indicator — clicking anywhere on card toggles */}
      <div className="slot__header">
        <span className="slot__label">{label}</span>
        {elemental && trigramLines ? (
          <>
            <Trigram
              lines={trigramLines}
              color={active ? color : 'rgba(255,255,255,0.15)'}
              size={22}
            />
            <span className={`slot__trigram-lbl ${active ? 'slot__trigram-lbl--on' : ''}`}
              style={active ? { '--color': color } : {}}>
              {trigramLabel}
            </span>
          </>
        ) : (
          <span className={`slot__dot ${active ? 'slot__dot--on' : ''}`} />
        )}
      </div>

      {/* Knob — stop click propagation so dragging knob doesn't toggle */}
      <div
        className={`slot__knob-wrap ${active ? 'slot__knob-wrap--on' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <DualKnob
          mode={onParam ? 'dual' : 'single'}
          mixValue={volume}
          paramValue={param ?? 0}
          onMixChange={handleVolume}
          onParamChange={handleParam}
          color={color}
          size={69}
          mixLabel={`${Math.round(volume * 100)}%`}
          paramLabel={param !== undefined ? (innerCircular ? paramLabel : fmtParam(param, paramLabel)) : undefined}
          minParam={paramMin ?? 0}
          maxParam={paramMax ?? 1}
          outerTip="vol"
          innerTip={paramLabel ?? 'param'}
          innerCircular={innerCircular}
        />
      </div>
    </div>
  )
}
