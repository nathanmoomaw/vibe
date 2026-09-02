import { useEffect, useState } from 'react'
import { PLANETS, PLANET_QUALITY, ZODIAC_SIGNS, eclipticLon } from '../utils/planets.js'
import { getCoords } from '../utils/reading.js'
import './VibeAstro.css'

const CX = 200, CY = 200
const RING_OUTER = 180
const RING_INNER = 152
const SIGN_R = 166
const PLANET_R = 118

function toXY(lonDeg, r) {
  const a = (lonDeg * Math.PI / 180) - Math.PI / 2
  return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r }
}

export function VibeAstro({ onClose }) {
  const [coords, setCoords] = useState(null)
  const [now] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    getCoords().then(c => { if (!cancelled) setCoords(c) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const planetLons = PLANETS.map(p => ({ ...p, lon: eclipticLon(p.name, now) }))

  const locLabel = coords
    ? `${Math.abs(coords.lat).toFixed(1)}°${coords.lat >= 0 ? 'N' : 'S'}, ${Math.abs(coords.lon).toFixed(1)}°${coords.lon >= 0 ? 'E' : 'W'}`
    : 'locating…'

  return (
    <div className="vas__overlay">
      <button className="vas__close" onClick={onClose} aria-label="Close" title="close">×</button>
      <div className="vas__wrap">
        <svg className="vas__wheel" viewBox="0 0 400 400">
          <circle cx={CX} cy={CY} r={RING_OUTER} className="vas__ring" />
          <circle cx={CX} cy={CY} r={RING_INNER} className="vas__ring" />
          {ZODIAC_SIGNS.map((s, i) => {
            const boundaryLon = i * 30
            const outer = toXY(boundaryLon, RING_OUTER)
            const inner = toXY(boundaryLon, RING_INNER)
            const mid = toXY(boundaryLon + 15, SIGN_R)
            return (
              <g key={s.name}>
                <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className="vas__tick" />
                <text x={mid.x} y={mid.y} className="vas__sign" textAnchor="middle" dominantBaseline="middle">
                  <title>{s.name}</title>
                  {s.glyph}
                </text>
              </g>
            )
          })}
          {planetLons.map(p => {
            const pos = toXY(p.lon, PLANET_R)
            const signIdx = Math.floor(p.lon / 30) % 12
            const deg = Math.floor(p.lon - signIdx * 30)
            return (
              <text
                key={p.name}
                x={pos.x} y={pos.y}
                className="vas__planet"
                textAnchor="middle" dominantBaseline="middle"
              >
                <title>{`${p.name} — ${deg}° ${ZODIAC_SIGNS[signIdx].name}\n${PLANET_QUALITY[p.name]}`}</title>
                {p.symbol}
              </text>
            )
          })}
        </svg>
        <div className="vas__caption">
          present sky · {locLabel} · {now.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
