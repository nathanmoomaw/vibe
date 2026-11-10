import { useCallback, useEffect, useRef, useState } from 'react'
import { startTone, setToneParam, fadeOutTone, strikeTone } from '../audio/tones.js'
import { fadeMaster, setPlaybackActive, registerMediaSessionStop } from '../audio/engine.js'
import { moonPhase, currentDecan } from '../utils/reading.js'
import {
  TRIGRAM_IMAGE, TRIGRAM_VOICE, NAMES, CUBE_EDGES,
  lower, upper, kingWen, lineOf, hamming, kingWenPartner,
  gray, grayIndex, changedLine, cubePoint, castFromMoment,
} from './hexagrams.js'
import './Chingy.css'

// chingy — the hexagram as a place in a 6-cube. A cast drops you on one of
// 64 vertices; the walk then follows the Gray code, one changing line at a
// time, through every hexagram and back. Each trigram has its own elemental
// voice, so a changed line is heard as one element turning into its pair.
// Touch a line to change it yourself; touch any vertex to travel there
// edge by edge (Hamming distance = how many steps).

const STEP_MS = 20000        // auto walk: one line every 20 s
const TRAVEL_MS = 1600       // manual travel: one edge every 1.6 s
const VOICE_VOL = 0.5
const TRAIL_LEN = 18
const POINTS = Array.from({ length: 64 }, (_, h) => cubePoint(h))

function voicesFor(h) {
  const lo = TRIGRAM_VOICE[lower(h)], up = TRIGRAM_VOICE[upper(h)]
  const m = new Map([[lo.tone, lo.angle]])
  m.set(up.tone, up.angle) // same element above and below: one voice, upper's form
  return m
}

function readingLines(h, cast, moved, step) {
  const up = upper(h), lo = lower(h)
  const yang = [0, 1, 2, 3, 4, 5].reduce((n, i) => n + lineOf(h, i), 0)
  const drift = hamming(h, cast)
  const lines = [`${TRIGRAM_IMAGE[up]} over ${TRIGRAM_IMAGE[lo]}`]
  if (moved != null) lines.push(`line ${moved + 1} turned ${lineOf(h, moved) ? 'yang' : 'yin'}`)
  lines.push(yang === 3 ? 'three and three — balanced' : `${yang} of 6 lines yang`)
  if (h === cast) lines.push(step > 0 ? 'back where you were cast' : 'your cast')
  else if (drift === 6) lines.push('the full opposite of your cast')
  else lines.push(`${drift} line${drift === 1 ? '' : 's'} from your cast`)
  return lines
}

export default function ChingyApp() {
  const [playing, setPlaying] = useState(false)
  const [hex, setHex] = useState(null)
  const [cast, setCast] = useState(null)
  const [moved, setMoved] = useState(null)
  const [trail, setTrail] = useState([])
  const [steps, setSteps] = useState(0)
  const voicesRef = useRef(new Map())
  const hexRef = useRef(null)
  const routeRef = useRef([])     // queued line flips for vertex travel
  const timerRef = useRef(null)

  const applyVoices = useCallback((h) => {
    const want = voicesFor(h)
    for (const tone of voicesRef.current.keys()) if (!want.has(tone)) fadeOutTone(tone)
    for (const [tone, angle] of want) {
      if (voicesRef.current.has(tone)) setToneParam(tone, angle)
      else startTone(tone, VOICE_VOL, angle)
    }
    voicesRef.current = want
  }, [])

  // Move to h; `line` is the line that changed (null for a cast)
  const goTo = useCallback((h, line) => {
    hexRef.current = h
    setHex(h)
    setMoved(line)
    setSteps(s => s + 1)
    setTrail(t => [...t, h].slice(-TRAIL_LEN))
    applyVoices(h)
    if (line != null) strikeTone(lineOf(h, line) ? 'bell' : 'chime', 0.32)
  }, [applyVoices])

  const flipLine = useCallback((i) => {
    if (hexRef.current == null) return
    goTo(hexRef.current ^ (1 << i), i)
  }, [goTo])

  // One clock drives both modes: drain a queued route fast, else Gray-walk
  // (the tick re-arms itself through tickRef, since a callback can't name itself)
  const tickRef = useRef(null)
  const schedule = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => tickRef.current?.(),
      routeRef.current.length ? TRAVEL_MS : STEP_MS)
  }, [])
  useEffect(() => {
    tickRef.current = () => {
      if (hexRef.current == null) return
      if (routeRef.current.length) {
        flipLine(routeRef.current.shift())
      } else {
        const next = gray((grayIndex(hexRef.current) + 1) % 64)
        goTo(next, changedLine(hexRef.current, next))
      }
      schedule()
    }
  }, [flipLine, goTo, schedule])

  const stop = useCallback(() => {
    clearTimeout(timerRef.current)
    routeRef.current = []
    fadeMaster(0.0001, 900, () => {
      for (const tone of voicesRef.current.keys()) fadeOutTone(tone, 0.2)
      voicesRef.current = new Map()
      fadeMaster(0.85, 50)
    })
    setPlaying(false)
  }, [])

  const begin = useCallback(() => {
    const h = castFromMoment(moonPhase(), currentDecan().decanIndex)
    setCast(h)
    setTrail([])
    setSteps(-1)
    goTo(h, null)
    setPlaying(true)
    schedule()
  }, [goTo, schedule])

  const travelTo = useCallback((target) => {
    const h = hexRef.current
    if (h == null || target === h) return
    const route = []
    for (let i = 5; i >= 0; i--) if (((h ^ target) >> i) & 1) route.push(i)
    routeRef.current = route
    flipLine(routeRef.current.shift())
    schedule()
  }, [flipLine, schedule])

  const onLine = useCallback((i) => {
    routeRef.current = []
    flipLine(i)
    schedule()
  }, [flipLine, schedule])

  useEffect(() => { setPlaybackActive(playing) }, [playing])
  useEffect(() => { registerMediaSessionStop(stop) }, [stop])
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const up = hex != null ? upper(hex) : null
  const lo = hex != null ? lower(hex) : null
  const kw = hex != null ? kingWen(hex) : null
  const partner = hex != null ? kingWen(kingWenPartner(hex)) : null

  return (
    <div className={`chingy ${playing ? 'chingy--on' : ''}`}
      style={hex != null ? {
        '--up': TRIGRAM_VOICE[up].color, '--lo': TRIGRAM_VOICE[lo].color,
      } : undefined}>
      <div className="chingy__aura" aria-hidden="true" />

      <svg className="chingy__cube" viewBox="-2.15 -2.15 4.3 4.3" aria-label="the 64 hexagrams as a 6-cube">
        <g className="chingy__edges">
          {CUBE_EDGES.map(([a, b, i]) => {
            const [x1, y1] = POINTS[a], [x2, y2] = POINTS[b]
            const lit = hex != null && (a === hex || b === hex)
            return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2}
              className={lit ? `chingy__edge chingy__edge--lit chingy__edge--l${i}` : 'chingy__edge'} />
          })}
        </g>
        {trail.length > 1 && (
          <polyline className="chingy__trail"
            points={trail.map(h => POINTS[h].join(',')).join(' ')} />
        )}
        {POINTS.map(([x, y], h) => (
          <g key={h} className="chingy__node-g" onClick={() => playing && travelTo(h)}>
            <circle cx={x} cy={y} r={0.09} className="chingy__hit" />
            <circle cx={x} cy={y} r={h === hex ? 0.075 : 0.03}
              className={`chingy__node${h === hex ? ' chingy__node--here' : ''}${h === cast ? ' chingy__node--cast' : ''}`} />
          </g>
        ))}
      </svg>

      <div className="chingy__panel">
        {hex == null ? (
          <button className="chingy__cast" onClick={begin}>
            <span className="chingy__cast-ring" />
            <span className="chingy__cast-lbl">cast</span>
          </button>
        ) : (
          <>
            <div className="chingy__hex" role="group" aria-label={`hexagram ${kw}`}>
              {[5, 4, 3, 2, 1, 0].map(i => {
                const yang = lineOf(hex, i) === 1
                return (
                  <button key={i}
                    className={`chingy__line ${yang ? 'is-yang' : 'is-yin'} ${i >= 3 ? 'is-up' : 'is-lo'} ${moved === i ? 'is-moving' : ''}`}
                    onClick={() => playing && onLine(i)}
                    aria-label={`line ${i + 1}, ${yang ? 'yang' : 'yin'}: tap to change`}>
                    <span /><span />
                  </button>
                )
              })}
            </div>
            <div className="chingy__num">{kw}</div>
            <div className="chingy__name">{NAMES[kw]}</div>
            <div className="chingy__tri">{up} <span>over</span> {lo}</div>
            <ul className="chingy__read">
              {readingLines(hex, cast, moved, steps).map(l => <li key={l}>{l}</li>)}
            </ul>
            <div className="chingy__meta">
              <span title="read as binary, line 6 first — Shao Yong / Leibniz">
                {[5, 4, 3, 2, 1, 0].map(i => lineOf(hex, i)).join('')} · {hex}
              </span>
              <span title="King Wen pairs: upside-down, or fully inverted if that's the same figure">
                pair {partner} · {NAMES[partner]}
              </span>
            </div>
          </>
        )}
      </div>

      {playing ? (
        <button className="chingy__stop" onClick={stop} aria-label="stop">■</button>
      ) : hex != null && (
        <button className="chingy__stop" onClick={begin} aria-label="cast again">↻</button>
      )}
    </div>
  )
}
