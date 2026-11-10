import { useCallback, useEffect, useRef, useState } from 'react'
import { startTone, setToneParam, setToneVolume, updateToneRate, fadeOutTone, stopTone } from '../audio/tones.js'
import { getAnalyser, fadeMaster, setPlaybackActive, registerMediaSessionStop } from '../audio/engine.js'
import { rhombi, isThick, E_PERP } from './pentagrid.js'
import './Penrose.css'

// penrose — a slice of the 5-D lattice, drawn and heard. Five grid families
// make the tiling; each family is one of the five phases, and each has its
// own slow drift through the hidden dimensions. Its drift shows as tiles
// flipping in place and is heard as that phase's voice swelling and fading.
// Neighbouring families make the thick rhombs (the generating cycle:
// wood → fire → earth → metal → water → wood); families two apart make the
// thin ones (the controlling cycle). Drag to push the slice yourself.

const PHASES = [
  { id: 'wood',  voice: 'wind',  color: [102, 204, 136] },
  { id: 'fire',  voice: 'fire',  color: [255, 110, 60] },
  { id: 'earth', voice: 'earth', color: [214, 150, 92] },
  { id: 'metal', voice: 'bell',  color: [232, 226, 210] },
  { id: 'water', voice: 'water', color: [68, 170, 255] },
]
// Per-family drift: slow and mutually irrational so it never repeats
const DRIFT = [
  { w: 0.0131, a: 0.9, p: 0.0 },
  { w: 0.0089, a: 1.1, p: 1.7 },
  { w: 0.0157, a: 0.8, p: 3.1 },
  { w: 0.0071, a: 1.2, p: 4.4 },
  { w: 0.0113, a: 1.0, p: 5.6 },
]
const BASE_GAMMA = [0.2, 0.2, 0.2, 0.2, -0.8]  // Σ = 0 → true Penrose
const PX_PER_UNIT = 34
const T_OFFSET = 40     // start mid-drift so the opening isn't flat
const AUDIO_EVERY_MS = 400
const PUSH = 0.004   // hidden-space push per dragged pixel

// Same sine as that family's γ drift, so what flips is what swells
const swell = (k, t) => 0.5 + 0.5 * Math.sin(DRIFT[k].w * t + DRIFT[k].p)

function gammaAt(t, push) {
  const g = BASE_GAMMA.map((b, k) => b + DRIFT[k].a * Math.sin(DRIFT[k].w * t + DRIFT[k].p))
  const mean = g.reduce((a, b) => a + b, 0) / 5
  return g.map((v, k) => v - mean + push[0] * E_PERP[k][0] + push[1] * E_PERP[k][1])
}

// hue per rhomb orientation (family pair r<s), spread round the wheel
const PAIR_HUE = (() => {
  const h = Array.from({ length: 5 }, () => [])
  let i = 0
  for (let r = 0; r < 5; r++) for (let s = r + 1; s < 5; s++) h[r][s] = (i++ * 108) % 360
  return h
})()

export default function PenroseApp() {
  const canvasRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(false)
  const swellRef = useRef([0, 0, 0, 0, 0])
  const pushRef = useRef([0, 0])
  const dragRef = useRef(null)
  const [levels, setLevels] = useState([0, 0, 0, 0, 0])

  // Draw loop runs always (the tiling drifts silently before you start)
  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv.getContext('2d')
    let raf = 0, last = 0
    const freq = new Uint8Array(256)
    const t0 = performance.now()

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (now - last < 33) return   // ~30 fps is plenty for this drift
      last = now
      const t = (now - t0) / 1000 + T_OFFSET
      swellRef.current = PHASES.map((_, k) => swell(k, t))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = cv.clientWidth, h = cv.clientHeight
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr) }

      let level = 0
      if (playingRef.current) {
        getAnalyser().getByteFrequencyData(freq)
        for (let i = 0; i < 64; i++) level += freq[i]
        level = Math.min(1, level / (64 * 140))
      }

      const scale = PX_PER_UNIT * Math.max(0.8, Math.min(w, h) / 700)
      const radius = Math.hypot(w, h) / 2 / scale + 1.5
      const gamma = gammaAt(t, pushRef.current)
      const tiles = rhombi(gamma, radius)
      const sw = swellRef.current

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#03030a'
      ctx.fillRect(0, 0, w, h)
      ctx.translate(w / 2, h / 2)
      ctx.rotate(t * 0.006)
      ctx.scale(scale, scale)
      ctx.lineJoin = 'round'
      ctx.lineWidth = 2 / scale

      // Each of the 10 family pairs is one rhomb orientation; give each its
      // own hue (slowly turning), so the five-fold structure shows as colour.
      // A tile brightens while its two phases swell.
      const hueTurn = t * 1.5
      for (const tile of tiles) {
        const { r, s, pts, cx, cy } = tile
        const thick = isThick(r, s)
        const hue = (PAIR_HUE[r][s] + hueTurn) % 360
        const glow = 0.5 * (sw[r] + sw[s])
        const dist = Math.hypot(cx, cy) / radius
        const fade = Math.max(0, 1 - dist * dist)
        const a = (thick ? 0.22 : 0.5) * (0.3 + 0.7 * glow) * fade * (1 + level * 0.7)
        ctx.beginPath()
        ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3])
        ctx.lineTo(pts[4], pts[5]); ctx.lineTo(pts[6], pts[7]); ctx.closePath()
        ctx.fillStyle = `hsla(${hue.toFixed(0)},${thick ? 42 : 62}%,${thick ? 46 : 64}%,${a.toFixed(3)})`
        ctx.fill()
        ctx.strokeStyle = `rgba(3,3,10,${(0.55 * fade + 0.2).toFixed(3)})`
        ctx.stroke()
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Voices follow the same drift that moves the tiles
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const sw = swellRef.current
      setLevels(sw)
      PHASES.forEach((ph, k) => {
        if (ph.voice === 'bell') { updateToneRate('bell', 14 + 30 * (1 - sw[k])); return }
        setToneVolume(ph.voice, 0.08 + 0.42 * sw[k])
        // wind's setParam also drives its own gain, which would fight the swell
        if (ph.voice !== 'wind') setToneParam(ph.voice, 90 * sw[k])
      })
    }, AUDIO_EVERY_MS)
    return () => clearInterval(id)
  }, [playing])

  const begin = useCallback(() => {
    PHASES.forEach(ph => startTone(ph.voice, ph.voice === 'bell' ? 0.3 : 0.2, ph.voice === 'bell' ? 30 : 0))
    playingRef.current = true
    setPlaying(true)
  }, [])

  const stop = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    setLevels([0, 0, 0, 0, 0])
    fadeMaster(0.0001, 900, () => {
      PHASES.forEach(ph => (ph.voice === 'bell' ? stopTone('bell') : fadeOutTone(ph.voice, 0.2)))
      fadeMaster(0.85, 50)
    })
  }, [])

  useEffect(() => { setPlaybackActive(playing) }, [playing])
  useEffect(() => { registerMediaSessionStop(stop) }, [stop])

  const onDown = (e) => { dragRef.current = [e.clientX, e.clientY]; e.currentTarget.setPointerCapture(e.pointerId) }
  const onMove = (e) => {
    if (!dragRef.current) return
    const [x, y] = dragRef.current
    pushRef.current = [pushRef.current[0] + (e.clientX - x) * PUSH, pushRef.current[1] + (e.clientY - y) * PUSH]
    dragRef.current = [e.clientX, e.clientY]
  }
  const onUp = () => { dragRef.current = null }

  return (
    <div className="penrose">
      <canvas ref={canvasRef} className="penrose__canvas"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />

      {!playing && (
        <button className="penrose__start" onClick={begin} aria-label="start">
          <svg viewBox="-1.1 -1.1 2.2 2.2">
            <polygon points={[0, 1, 2, 3, 4].map(k => {
              const a = -Math.PI / 2 + k * 2 * Math.PI / 5
              return `${Math.cos(a)},${Math.sin(a)}`
            }).join(' ')} />
          </svg>
        </button>
      )}

      <div className="penrose__phases" aria-hidden="true">
        {PHASES.map((ph, k) => (
          <span key={ph.id} title={ph.id}
            style={{ '--c': `rgb(${ph.color.join(',')})`, '--l': levels[k] }} />
        ))}
      </div>

      {playing && <button className="penrose__stop" onClick={stop} aria-label="stop">■</button>}
    </div>
  )
}
