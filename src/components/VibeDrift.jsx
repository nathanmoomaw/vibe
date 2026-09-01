import { useState, useEffect } from 'react'
import { DriftIcon } from './DriftIcon.jsx'
import { getDriftDepthMult, getDriftRateMult, setDriftDepthMult, setDriftRateMult } from '../audio/driftSettings.js'
import './VibeDrift.css'

export function VibeDrift({ onClose }) {
  const [depth, setDepth] = useState(() => getDriftDepthMult())
  const [rate, setRate] = useState(() => getDriftRateMult())

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="vdr__overlay" onClick={onClose}>
      <div className="vdr__modal" onClick={e => e.stopPropagation()}>
        <button className="vdr__close" onClick={onClose} aria-label="Close">×</button>
        <div className="vdr__title"><DriftIcon size={22} /> drift</div>
        <p className="vdr__blurb">
          how much every element's tone wanders on its own — organic wobble in
          frequency, rate, and character, instead of a perfectly static hold.
        </p>
        <div className="vdr__row">
          <label className="vdr__label" htmlFor="vdr-depth">depth</label>
          <input
            id="vdr-depth"
            className="vdr__slider"
            type="range"
            min="0" max="2" step="0.05"
            value={depth}
            onChange={e => {
              const v = parseFloat(e.target.value)
              setDepth(v)
              setDriftDepthMult(v)
            }}
          />
          <span className="vdr__value">{Math.round(depth * 100)}%</span>
        </div>
        <div className="vdr__row">
          <label className="vdr__label" htmlFor="vdr-rate">rate</label>
          <input
            id="vdr-rate"
            className="vdr__slider"
            type="range"
            min="0" max="2" step="0.05"
            value={rate}
            onChange={e => {
              const v = parseFloat(e.target.value)
              setRate(v)
              setDriftRateMult(v)
            }}
          />
          <span className="vdr__value">{Math.round(rate * 100)}%</span>
        </div>
        <p className="vdr__note">applies as sounds (re)start, not live mid-play</p>
      </div>
    </div>
  )
}
