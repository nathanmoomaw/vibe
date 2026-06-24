import { useRef, useCallback, memo } from 'react'
import './DualKnob.css'

const MIN_ANGLE = -135
const MAX_ANGLE = 135
const ANGLE_RANGE = 270
const INNER_RATIO = 0.55

export const DualKnob = memo(function DualKnob({
  mixValue,
  paramValue = 0,
  onMixChange,
  onParamChange = () => {},
  color = '#66ccff',
  size = 48,
  minParam = 0,
  maxParam = 1,
  mixLabel,
  paramLabel,
  outerTip = 'vol',
  innerTip = 'param',
  mode = 'dual', // 'dual' | 'single'
}) {
  const knobRef = useRef(null)
  const innerNotchRef = useRef(null)
  const arcFillRef = useRef(null)
  const ghostRef = useRef(null)
  const ghostThumbRef = useRef(null)
  const draggingZone = useRef(null)
  const startMix = useRef(0)
  const startParam = useRef(0)

  const paramRange = maxParam - minParam
  const paramRatio = Math.max(0, Math.min(1, (paramValue - minParam) / paramRange))
  const paramAngle = MIN_ANGLE + paramRatio * ANGLE_RANGE
  const mixAngle = mixValue * ANGLE_RANGE

  const strokeWidth = size * 0.115
  const ringRadius = (size / 2) - strokeWidth / 2 - 1
  const circumference = 2 * Math.PI * ringRadius
  const trackArcLength = (ANGLE_RANGE / 360) * circumference
  const fillArcLength = (mixAngle / 360) * circumference

  const applyHoverZone = useCallback((zone) => {
    if (knobRef.current) knobRef.current.dataset.zone = zone ?? ''
  }, [])

  const applyMixVisuals = useCallback((v) => {
    const newFill = (v * ANGLE_RANGE / 360) * circumference
    if (arcFillRef.current) arcFillRef.current.style.strokeDasharray = `${newFill} ${circumference}`
    if (ghostThumbRef.current && draggingZone.current === 'outer')
      ghostThumbRef.current.style.top = `${(1 - v) * 100}%`
  }, [circumference])

  const applyParamVisuals = useCallback((v) => {
    const ratio = (v - minParam) / paramRange
    const deg = MIN_ANGLE + ratio * ANGLE_RANGE
    if (innerNotchRef.current) innerNotchRef.current.style.transform = `rotate(${deg}deg)`
    if (ghostThumbRef.current && draggingZone.current === 'inner')
      ghostThumbRef.current.style.top = `${(1 - ratio) * 100}%`
  }, [minParam, paramRange])

  const getZone = useCallback((e) => {
    if (mode === 'single') return 'outer'
    const knob = knobRef.current
    if (!knob) return 'outer'
    const rect = knob.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    return Math.sqrt(dx * dx + dy * dy) < (rect.width / 2) * INNER_RATIO ? 'inner' : 'outer'
  }, [mode])

  const onPointerDown = useCallback((e) => {
    const zone = getZone(e)
    draggingZone.current = zone
    applyHoverZone(zone)
    startMix.current = mixValue
    startParam.current = paramValue
    e.currentTarget.setPointerCapture(e.pointerId)
    if (ghostRef.current) ghostRef.current.classList.add('vk__ghost--on')
  }, [mixValue, paramValue, getZone, applyHoverZone])

  const onPointerMove = useCallback((e) => {
    if (!draggingZone.current) { applyHoverZone(getZone(e)); return }
    if (draggingZone.current === 'inner') {
      const next = Math.max(minParam, Math.min(maxParam,
        startParam.current - (e.movementY / 200) * paramRange))
      startParam.current = next
      applyParamVisuals(next)
      onParamChange(next)
    } else {
      const next = Math.max(0, Math.min(1, startMix.current - e.movementY / 200))
      startMix.current = next
      applyMixVisuals(next)
      onMixChange(next)
    }
  }, [minParam, maxParam, paramRange, onMixChange, onParamChange, applyMixVisuals, applyParamVisuals, getZone, applyHoverZone])

  const onPointerUp = useCallback(() => {
    draggingZone.current = null
    if (ghostRef.current) ghostRef.current.classList.remove('vk__ghost--on')
    applyHoverZone(null)
  }, [applyHoverZone])

  return (
    <div className="vk" style={{ '--vk-size': `${size}px`, '--vk-color': color }}>
      <div
        ref={knobRef}
        className="vk__body"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={(e) => { if (!draggingZone.current) applyHoverZone(getZone(e)) }}
        onPointerLeave={() => { if (!draggingZone.current) applyHoverZone(null) }}
        style={{ touchAction: 'none' }}
      >
        <svg className="vk__svg" viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
          <circle className="vk__track" cx={size/2} cy={size/2} r={ringRadius}
            fill="none" strokeWidth={strokeWidth}
            strokeDasharray={`${trackArcLength} ${circumference}`} />
          <circle ref={arcFillRef} className="vk__fill" cx={size/2} cy={size/2} r={ringRadius}
            fill="none" strokeWidth={strokeWidth}
            strokeDasharray={`${fillArcLength} ${circumference}`} />
          <circle className="vk__outer-ring" cx={size/2} cy={size/2} r={(size/2)-1.5} fill="none" />
          {mode === 'dual' && (
            <circle className="vk__sep" cx={size/2} cy={size/2} r={(size/2)*INNER_RATIO} fill="none" />
          )}
        </svg>

        <div className={`vk__inner${mode === 'single' ? ' vk__inner--single' : ''}`}>
          {mode === 'dual' && (
            <div ref={innerNotchRef} className="vk__notch-ring"
              style={{ transform: `rotate(${paramAngle}deg)` }}>
              <div className="vk__notch" />
            </div>
          )}
        </div>

        <div className="vk__ghost" ref={ghostRef}>
          <div className="vk__ghost-track" />
          <div className="vk__ghost-thumb" ref={ghostThumbRef}
            style={{ top: `${(1-(draggingZone.current==='inner' ? paramRatio : mixValue))*100}%` }} />
        </div>

        {/* Zone hover tips */}
        <div className="vk__tip vk__tip--outer">{outerTip}</div>
        {mode === 'dual' && <div className="vk__tip vk__tip--inner">{innerTip}</div>}
      </div>

      <div className="vk__labels">
        <span className="vk__lbl vk__lbl--mix">{mixLabel ?? `${Math.round(mixValue*100)}%`}</span>
        {mode === 'dual' && paramLabel && (
          <span className="vk__lbl vk__lbl--param">{paramLabel}</span>
        )}
      </div>
    </div>
  )
})
