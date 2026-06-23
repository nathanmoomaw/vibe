import { useState, useCallback } from 'react'
import './SoundSlot.css'

export default function SoundSlot({
  id,
  label,
  color,
  glow,
  active,
  volume,
  param,
  paramLabel,
  paramMin,
  paramMax,
  onToggle,
  onVolume,
  onParam,
}) {
  const [dragging, setDragging] = useState(false)

  const handleParamChange = useCallback((e) => {
    onParam?.(parseFloat(e.target.value))
  }, [onParam])

  const handleVolumeChange = useCallback((e) => {
    onVolume(parseFloat(e.target.value))
  }, [onVolume])

  const glowStyle = active
    ? { '--glow': glow, '--color': color }
    : { '--glow': 'transparent', '--color': '#444' }

  return (
    <div
      className={`slot ${active ? 'slot--on' : ''}`}
      style={glowStyle}
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

      <div className={`slot__controls ${active ? 'slot__controls--visible' : ''}`}>
        <label className="slot__knob-wrap">
          <span className="slot__knob-label">vol</span>
          <input
            type="range"
            className="slot__knob"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
          />
        </label>

        {onParam && (
          <label className="slot__knob-wrap">
            <span className="slot__knob-label">{paramLabel ?? 'freq'}</span>
            <input
              type="range"
              className="slot__knob"
              min={paramMin ?? 100}
              max={paramMax ?? 8000}
              step="1"
              value={param}
              onChange={handleParamChange}
            />
          </label>
        )}
      </div>
    </div>
  )
}
