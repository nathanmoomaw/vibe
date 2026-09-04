import { useEffect, useState } from 'react'
import { PLANETS, PLANET_QUALITY, ZODIAC_SIGNS, eclipticLon } from '../utils/planets.js'
import { getCoords } from '../utils/reading.js'
import './VibeAstro.css'

const CX = 200, CY = 200
const RING_OUTER = 180
const RING_INNER = 152
const SIGN_R = 166
const PLANET_R = 118
const ASPECT_R = 108 // just inside the planet glyphs, so lines don't run under them

function toXY(lonDeg, r) {
  const a = (lonDeg * Math.PI / 180) - Math.PI / 2
  return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r }
}

// Classic major aspects — angular separation (mod 360, folded to 0-180) within
// an orb of the exact angle. Harmonious ones (sextile/trine) drawn in the same
// soft blue as the wheel's own ring/ticks; tense ones (square/opposition) in a
// warm red-orange, echoing the console's own calming-vs-tense color language;
// conjunction (same degree) in a neutral warm white.
const ASPECTS = [
  { name: 'conjunction', angle: 0,   orb: 8, className: 'vas__aspect--conjunction' },
  { name: 'sextile',     angle: 60,  orb: 4, className: 'vas__aspect--soft' },
  { name: 'square',      angle: 90,  orb: 6, className: 'vas__aspect--tense' },
  { name: 'trine',       angle: 120, orb: 6, className: 'vas__aspect--soft' },
  { name: 'opposition',  angle: 180, orb: 8, className: 'vas__aspect--tense' },
]

function findAspect(lonA, lonB) {
  const diff = Math.abs(lonA - lonB) % 360
  const sep = diff > 180 ? 360 - diff : diff
  for (const a of ASPECTS) {
    if (Math.abs(sep - a.angle) <= a.orb) return a
  }
  return null
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

  // Dismissable by clicking anywhere that isn't an actual console control —
  // the wheel itself, its glyphs, and the page background all count as
  // "outside". The console (`.unit`) is deliberately excluded so knobs/
  // buttons/drag areas underneath keep working without also closing this.
  useEffect(() => {
    const h = e => { if (!e.target.closest('.unit')) onClose() }
    document.addEventListener('pointerdown', h, true)
    return () => document.removeEventListener('pointerdown', h, true)
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
          {planetLons.flatMap((p, i) =>
            planetLons.slice(i + 1).map(q => {
              const aspect = findAspect(p.lon, q.lon)
              if (!aspect) return null
              const a = toXY(p.lon, ASPECT_R), b = toXY(q.lon, ASPECT_R)
              return (
                <line
                  key={`${p.name}-${q.name}`}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  className={`vas__aspect ${aspect.className}`}
                >
                  <title>{`${p.name} ${aspect.name} ${q.name}`}</title>
                </line>
              )
            })
          )}
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
