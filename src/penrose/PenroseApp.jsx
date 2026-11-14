import { useCallback, useEffect, useRef, useState } from 'react'
import { getAnalyser, setPlaybackActive, registerMediaSessionStop } from '../audio/engine.js'
import { rhombi, isThick, E_PERP } from './pentagrid.js'
import { MOODS, lerpMood } from './moods.js'
import { startVoices, stopVoices, setMood as setVoiceMood, setPads, setVolume as setVoiceVolume, strike } from './voices.js'
import './Penrose.css'

// penrose — a slice of the 5-D lattice, drawn and heard. Five grid families
// make the tiling; each family is one note of a pentatonic scale. Each family
// drifts slowly through the hidden dimensions: its drift swells that note's
// pad, and when its tiles flip, that note rings as a soft bell. Drag to push
// the slice yourself: tiles flip under your hand and play. The mood button
// changes key, tone, speed, tile size and colour.

const PHASES = [
  { id: 'wood',  color: [102, 204, 136] },
  { id: 'fire',  color: [255, 110, 60] },
  { id: 'earth', color: [214, 150, 92] },
  { id: 'metal', color: [232, 226, 210] },
  { id: 'water', color: [68, 170, 255] },
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
const T_OFFSET = 40       // start mid-drift so the opening isn't flat
const AUDIO_EVERY_MS = 400
const PUSH = 0.0025       // hidden-space push per dragged pixel
const FLASH_MS = 900      // a flipped tile's glow
const MAX_STRIKE_TRIES = 4  // per frame; voices.js caps the real rate

// Same sine as that family's γ drift, so what flips is what swells
const swell = (k, t) => 0.5 + 0.5 * Math.sin(DRIFT[k].w * t + DRIFT[k].p)

function gammaAt(t, push) {
  const g = BASE_GAMMA.map((b, k) => b + DRIFT[k].a * Math.sin(DRIFT[k].w * t + DRIFT[k].p))
  const mean = g.reduce((a, b) => a + b, 0) / 5
  return g.map((v, k) => v - mean + push[0] * E_PERP[k][0] + push[1] * E_PERP[k][1])
}

// Each of the 10 family pairs (rhomb orientations) gets a slot in the mood's
// palette, scattered so neighbouring orientations don't share a colour
const PAIR_POS = (() => {
  const p = Array.from({ length: 5 }, () => [])
  let i = 0
  for (let r = 0; r < 5; r++) for (let s = r + 1; s < 5; s++) p[r][s] = ((i++ * 3) % 10) / 9 - 0.5
  return p
})()

// A tile is identified by its orientation and its base lattice corner; a
// phason flip changes the corner, so a flipped tile is a new key
const tileKey = (t) => `${t.r}${t.s}:${Math.round(t.pts[0] * 1e4)},${Math.round(t.pts[1] * 1e4)}`

const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } }
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

export default function PenroseApp() {
  const canvasRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(false)
  const [moodIdx, setMoodIdx] = useState(() => {
    const i = load('penrose.mood', 0)
    return Number.isInteger(i) && i >= 0 && i < MOODS.length ? i : 0
  })
  const moodRef = useRef(MOODS[moodIdx])
  const [volume, setVolume] = useState(() => {
    const v = load('penrose.volume', 0.7)
    return typeof v === 'number' && v >= 0 && v <= 1 ? v : 0.7
  })
  const swellRef = useRef([0, 0, 0, 0, 0])
  const pushRef = useRef([0, 0])
  const dragRef = useRef(null)
  const [levels, setLevels] = useState([0, 0, 0, 0, 0])

  // Draw loop runs always (the tiling drifts silently before you start)
  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv.getContext('2d')
    let raf = 0, last = 0
    let vt = T_OFFSET            // drift time, runs at the mood's speed
    let view = { ...moodRef.current }   // visual params, easing toward the mood
    let prevKeys = null
    const flashes = new Map()    // tile key → flip time (ms)
    const freq = new Uint8Array(256)

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (now - last < 33) return   // ~30 fps is plenty for this drift
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      last = now
      view = lerpMood(view, moodRef.current, Math.min(1, dt * 0.6))
      vt += dt * view.speed
      swellRef.current = PHASES.map((_, k) => swell(k, vt))

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = cv.clientWidth, h = cv.clientHeight
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr) }

      let level = 0
      if (playingRef.current) {
        getAnalyser().getByteFrequencyData(freq)
        for (let i = 0; i < 64; i++) level += freq[i]
        level = Math.min(1, level / (64 * 140))
      }

      const scale = PX_PER_UNIT * view.zoom * Math.max(0.8, Math.min(w, h) / 700)
      const radius = Math.hypot(w, h) / 2 / scale + 1.5
      const tiles = rhombi(gammaAt(vt, pushRef.current), radius)
      const sw = swellRef.current
      const angle = vt * view.spin

      // Flips: tiles near the middle that weren't there last frame. The
      // previous set covers the whole screen, so tiles merely scrolling or
      // zooming into the middle don't count.
      const keys = new Set()
      const fresh = []
      const inner = radius * 0.6
      for (const tile of tiles) {
        const key = tileKey(tile)
        tile.key = key
        keys.add(key)
        if (prevKeys && !prevKeys.has(key) && Math.hypot(tile.cx, tile.cy) < inner) {
          flashes.set(key, now)
          fresh.push(tile)
        }
      }
      prevKeys = keys
      for (const [k, t0] of flashes) if (now - t0 > FLASH_MS) flashes.delete(k)

      if (playingRef.current && fresh.length) {
        const cos = Math.cos(angle), sin = Math.sin(angle)
        const halfW = w / 2 / scale
        for (let i = 0; i < Math.min(MAX_STRIKE_TRIES, fresh.length); i++) {
          const tile = fresh[(Math.random() * fresh.length) | 0]
          const k = Math.random() < 0.5 ? tile.r : tile.s
          const d = Math.hypot(tile.cx, tile.cy) / inner
          const x = tile.cx * cos - tile.cy * sin
          strike(k, 0.35 + 0.65 * (1 - d), x / halfW)
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#03030a'
      ctx.fillRect(0, 0, w, h)
      ctx.translate(w / 2, h / 2)
      ctx.rotate(angle)
      ctx.scale(scale, scale)
      ctx.lineJoin = 'round'
      ctx.lineWidth = 2 / scale

      // Colour by orientation within the mood's palette; a tile brightens
      // while its two families swell, and flashes when it has just flipped
      const wobble = Math.sin(vt * 0.02) * 12
      for (const tile of tiles) {
        const { r, s, pts, cx, cy, key } = tile
        const thick = isThick(r, s)
        const hue = (view.hue + PAIR_POS[r][s] * view.spread + wobble + 360) % 360
        const glow = 0.5 * (sw[r] + sw[s])
        const born = flashes.get(key)
        const flash = born === undefined ? 0 : 1 - (now - born) / FLASH_MS
        const dist = Math.hypot(cx, cy) / radius
        const fade = Math.max(0, 1 - dist * dist)
        const a = Math.min(0.95, ((thick ? 0.22 : 0.5) * (0.3 + 0.7 * glow) * (1 + level * 0.7) + flash * 0.45) * fade)
        const sat = thick ? view.sat * 0.85 : view.sat * 1.25
        const light = (thick ? view.light - 6 : view.light + 10) + flash * 18
        ctx.beginPath()
        ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3])
        ctx.lineTo(pts[4], pts[5]); ctx.lineTo(pts[6], pts[7]); ctx.closePath()
        ctx.fillStyle = `hsla(${hue.toFixed(0)},${sat.toFixed(0)}%,${Math.min(92, light).toFixed(0)}%,${a.toFixed(3)})`
        ctx.fill()
        ctx.strokeStyle = `rgba(3,3,10,${(0.55 * fade + 0.2).toFixed(3)})`
        ctx.stroke()
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Pads follow the same drift that flips the tiles
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const sw = swellRef.current
      setLevels(sw)
      setPads(sw, moodRef.current.pad)
    }, AUDIO_EVERY_MS)
    return () => clearInterval(id)
  }, [playing])

  useEffect(() => {
    moodRef.current = MOODS[moodIdx]
    setVoiceMood(MOODS[moodIdx])
    save('penrose.mood', moodIdx)
  }, [moodIdx])

  // Perceived loudness is roughly the square of the gain
  useEffect(() => {
    setVoiceVolume(volume * volume)
    save('penrose.volume', volume)
  }, [volume])

  const begin = useCallback(() => {
    startVoices(moodRef.current, volume * volume)
    playingRef.current = true
    setPlaying(true)
  }, [volume])

  const stop = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    setLevels([0, 0, 0, 0, 0])
    stopVoices(1.2)
  }, [])

  useEffect(() => { setPlaybackActive(playing) }, [playing])
  useEffect(() => { registerMediaSessionStop(stop) }, [stop])
  useEffect(() => () => stopVoices(0.2), [])

  const nextMood = () => setMoodIdx(i => (i + 1) % MOODS.length)

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

      <button className="penrose__mood" onClick={nextMood} aria-label={`mood: ${MOODS[moodIdx].id}, tap for next`}>
        {MOODS[moodIdx].id}
      </button>

      <div className="penrose__phases" aria-hidden="true">
        {PHASES.map((ph, k) => (
          <span key={ph.id} title={ph.id}
            style={{ '--c': `rgb(${ph.color.join(',')})`, '--l': levels[k] }} />
        ))}
      </div>

      {playing && (
        <>
          <button className="penrose__stop" onClick={stop} aria-label="stop">■</button>
          <input className="penrose__volume" type="range" min="0" max="1" step="0.01"
            value={volume} onChange={e => setVolume(Number(e.target.value))} aria-label="volume" />
        </>
      )}
    </div>
  )
}
