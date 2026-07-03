import { useCallback, useRef, useState } from 'react'
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
  elemental = false, trigramLines = null, trigramOutline = null, trigramLabel = null,
  idle = false,
}) {
  const handleVolume = useCallback((v) => onVolume(Math.round(v * 100) / 100), [onVolume])
  const handleParam  = useCallback((v) => onParam?.(v), [onParam])

  // Stable per-instance random offset so idle glints don't all fire in sync
  const [glintDelay] = useState(() => -(Math.random() * 28))

  // Dragging the trigram vertically adjusts the same param as the slot's inner knob.
  // A press+release with minimal movement is a tap instead — toggles the sound —
  // so ending a drag never accidentally flips it on/off.
  const trigramDragging   = useRef(false)
  const trigramMoved      = useRef(false)
  const trigramStartPos   = useRef({ x: 0, y: 0 })
  const trigramStartParam = useRef(0)

  const onTrigramPointerDown = useCallback((e) => {
    trigramDragging.current = true
    trigramMoved.current = false
    trigramStartPos.current = { x: e.clientX, y: e.clientY }
    trigramStartParam.current = param ?? 0
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
  }, [param])

  const onTrigramPointerMove = useCallback((e) => {
    if (!trigramDragging.current) return
    if (!trigramMoved.current) {
      const dx = e.clientX - trigramStartPos.current.x
      const dy = e.clientY - trigramStartPos.current.y
      if (Math.hypot(dx, dy) > 4) trigramMoved.current = true
    }
    if (trigramMoved.current && onParam) {
      const max = paramMax ?? 360
      const delta = (e.movementY / 200) * max
      const next = ((trigramStartParam.current - delta) % max + max) % max
      trigramStartParam.current = next
      onParam(next)
    }
    e.stopPropagation()
  }, [onParam, paramMax])

  const onTrigramPointerUp = useCallback((e) => {
    const wasTap = trigramDragging.current && !trigramMoved.current
    trigramDragging.current = false
    trigramMoved.current = false
    if (wasTap) onToggle()
    e.stopPropagation()
  }, [onToggle])

  return (
    <div
      className={`slot ${active ? 'slot--on' : ''}${idle ? ' slot--idle-glint' : ''}`}
      style={{ '--glow': glow, '--color': color, '--glint-delay': `${glintDelay}s` }}
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
            <div
              className="slot__trigram-drag"
              onPointerDown={onTrigramPointerDown}
              onPointerMove={onTrigramPointerMove}
              onPointerUp={onTrigramPointerUp}
              onPointerCancel={onTrigramPointerUp}
              onClick={e => e.stopPropagation()}
              style={{ touchAction: 'none', cursor: active ? (onParam ? 'ns-resize' : undefined) : 'pointer' }}
            >
              <Trigram
                lines={trigramLines}
                outline={trigramOutline}
                color={active ? color : 'rgba(255,255,255,0.15)'}
                size={30}
              />
            </div>
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
