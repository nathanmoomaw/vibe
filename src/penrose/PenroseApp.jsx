import { useCallback, useEffect, useRef, useState } from 'react'
import { getAnalyser, setPlaybackActive, registerMediaSessionStop } from '../audio/engine.js'
import { rhombi, inRhomb, starById, baseGamma, STAR_IDS } from './multigrid.js'
import { MOODS, lerpMood } from './moods.js'
import { startVoices, stopVoices, setMood as setVoiceMood, setPads, setVolume as setVoiceVolume, setFamilies, setMuted as setVoiceMuted, setKey, strike } from './voices.js'
import './Penrose.css'

// A multigrid tiling, drawn and heard. Each family of grid lines is one note
// of a pentatonic scale. The default star of directions comes from where the
// planets are today, so the tiling is the sky's own; 5/7/8 are evenly spaced
// stars with offsets chosen so none of them is Penrose's tiling.
// Each family drifts slowly through the hidden dimensions: its drift swells
// that note's pad, and when its tiles flip, that note rings as a soft bell.
//
// Gestures: drag pushes the slice (tiles flip under your hand and play),
// tap a tile to ring its two notes, pinch or scroll to zoom, twist with two
// fingers or scroll sideways to turn the colours. Tap a dot to mute that
// voice. Buttons: mood, star, volume.

const PX_PER_UNIT = 34
const T_OFFSET = 40       // start mid-drift so the opening isn't flat
const AUDIO_EVERY_MS = 400
const PUSH = 0.0025       // hidden-space push per dragged pixel
const FLASH_MS = 900      // a flipped tile's glow
const MAX_STRIKE_TRIES = 4  // per frame; voices.js caps the real rate
const TAP_PX = 8, TAP_MS = 350

// Per-family drift: slow, mutually irrational periods so it never repeats
const frac = (x) => x - Math.floor(x)
const driftOf = (k) => ({
  w: 0.0065 + 0.0095 * frac(k * 0.618034 + 0.13),
  a: 0.8 + 0.45 * frac(k * 0.414214 + 0.5),
  p: k * 2.39996,
})
const swell = (d, t) => 0.5 + 0.5 * Math.sin(d.w * t + d.p)

// Scatter the family pairs (rhomb orientations) through the palette so
// neighbouring orientations don't share a colour
const pairPos = (n) => {
  const p = Array.from({ length: n }, () => [])
  let i = 0
  for (let r = 0; r < n; r++) for (let s = r + 1; s < n; s++) p[r][s] = frac(i++ * 0.618034) - 0.5
  return p
}
const familyHue = (k, n, hue, spread) => (((hue + (n > 1 ? k / (n - 1) - 0.5 : 0) * spread) % 360) + 360) % 360

// A tile is identified by its orientation and its base lattice corner; a
// phason flip changes the corner, so a flipped tile is a new key
const tileKey = (t) => `${t.r},${t.s}:${Math.round(t.pts[0] * 1e4)},${Math.round(t.pts[1] * 1e4)}`

// Spectre-style curved edges. Every edge becomes an S-curve that is
// point-symmetric about its midpoint, so it is the same curve whichever way
// it is traversed: the two tiles that share an edge share the curve exactly
// (no gaps or overlaps), and opposite edges of a rhombus are translates of
// each other, so they never cross. Bend is per line family, so it can move.
const CURVE = 0.2  // control-point offset, × edge length
function sEdge(ctx, pts, i, k) {
  const x0 = pts[i * 2], y0 = pts[i * 2 + 1]
  const j = ((i + 1) % 4) * 2
  const dx = pts[j] - x0, dy = pts[j + 1] - y0
  ctx.bezierCurveTo(x0 + dx / 3 - dy * k, y0 + dy / 3 + dx * k,
    x0 + dx * 2 / 3 + dy * k, y0 + dy * 2 / 3 - dx * k, pts[j], pts[j + 1])
}

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
  // birth moment for the natal star: ISO UTC, this browser only
  const [born, setBorn] = useState(() => {
    const b = load('penrose.born', null)
    return typeof b === 'string' && !Number.isNaN(Date.parse(b)) ? b : null
  })
  const [starId, setStarId] = useState(() => {
    const s = load('penrose.star', 'sky')
    return STAR_IDS.includes(s) && (s !== 'natal' || born) ? s : 'sky'
  })
  const [star, setStar] = useState(() => starById(starId, born))
  const [curved, setCurved] = useState(() => load('penrose.curved', true) !== false)
  const curvedRef = useRef(curved)
  const [birthForm, setBirthForm] = useState(false)
  const starRef = useRef(star)
  const [muted, setMutedState] = useState(() => Array(star.n).fill(false))
  const mutedRef = useRef(muted)
  const swellRef = useRef([])
  const pushRef = useRef([0, 0])
  const userRef = useRef({ zoom: 1, hue: 0 })    // pinch/scroll zoom, twist hue
  // view centre in tiling units; drag moves it 1:1, release keeps gliding
  const panRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, held: false, t: 0 })
  const frameRef = useRef(null)                  // last frame's geometry, for taps
  const flashRef = useRef(new Map())             // tile key → flash time (ms)
  const pointersRef = useRef(new Map())
  const gestureRef = useRef(null)
  const [levels, setLevels] = useState([])

  // Draw loop runs always (the tiling drifts silently before you start)
  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv.getContext('2d')
    let raf = 0, last = 0
    let vt = T_OFFSET            // drift time, runs at the mood's speed
    let view = { ...moodRef.current }   // visual params, easing toward the mood
    let prevKeys = null, prevStar = null
    let drift = [], gamma0 = [], pos = []
    const flashes = flashRef.current
    const freq = new Uint8Array(256)

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (now - last < 33) return   // ~30 fps is plenty for this drift
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      last = now
      const st = starRef.current
      if (st !== prevStar) {        // new star: fresh drift, no fake flips
        prevStar = st
        drift = Array.from({ length: st.n }, (_, k) => driftOf(k))
        gamma0 = baseGamma(st.n)
        pos = pairPos(st.n)
        prevKeys = null
        flashes.clear()
      }
      view = lerpMood(view, moodRef.current, Math.min(1, dt * 0.6))
      vt += dt * view.speed
      const pan = panRef.current
      if (!pan.held) {
        pan.x += pan.vx * dt; pan.y += pan.vy * dt
        const k = Math.exp(-dt * 2.2)
        pan.vx *= k; pan.vy *= k
      }
      const sw = drift.map(d => swell(d, vt))
      swellRef.current = sw

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = cv.clientWidth, h = cv.clientHeight
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr) }

      let level = 0
      if (playingRef.current) {
        getAnalyser().getByteFrequencyData(freq)
        for (let i = 0; i < 64; i++) level += freq[i]
        level = Math.min(1, level / (64 * 140))
      }

      const user = userRef.current
      const scale = PX_PER_UNIT * view.zoom * user.zoom * Math.max(0.8, Math.min(w, h) / 700)
      const radius = Math.hypot(w, h) / 2 / scale + 1.5
      const push = pushRef.current
      // Drift around the mean so Σγ stays at baseGamma's sum: on the 5-star a
      // whole-number Σγ is exactly Penrose's tiling, so it must never get there.
      // (Pushes keep Σγ too: Σ P_k = 0 on the evenly spaced stars.)
      const dr = drift.map(d => d.a * Math.sin(d.w * vt + d.p))
      const drMean = dr.reduce((a, b) => a + b, 0) / dr.length
      const gamma = gamma0.map((g, k) => g + dr[k] - drMean + push[0] * st.P[k][0] + push[1] * st.P[k][1])
      const tiles = rhombi(st, gamma, radius, pan.x, pan.y)
      const angle = vt * view.spin
      frameRef.current = { tiles, scale, angle, w, h, px: pan.x, py: pan.y }

      // Flips: tiles near the middle that weren't anywhere on screen last
      // frame, so scrolling or zooming into the middle doesn't count
      const keys = new Set()
      const fresh = []
      const inner = radius * 0.6
      for (const tile of tiles) {
        const key = tileKey(tile)
        tile.key = key
        keys.add(key)
        if (prevKeys && !prevKeys.has(key) && Math.hypot(tile.cx - pan.x, tile.cy - pan.y) < inner) {
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
          const rx = tile.cx - pan.x, ry = tile.cy - pan.y
          const d = Math.hypot(rx, ry) / inner
          strike(k, 0.35 + 0.65 * (1 - d), (rx * cos - ry * sin) / halfW)
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#03030a'
      ctx.fillRect(0, 0, w, h)
      ctx.translate(w / 2, h / 2)
      ctx.rotate(angle)
      ctx.scale(scale, scale)
      ctx.translate(-pan.x, -pan.y)
      ctx.lineJoin = 'round'
      ctx.lineWidth = 2 / scale

      // Colour by orientation across the mood's (wide) palette, slowly
      // circling the wheel; a tile brightens while its two families swell,
      // flashes when it has just flipped, and dims if a family is muted
      const baseHue = view.hue + user.hue + vt * 0.3
      const mute = mutedRef.current
      // Curved edges: each family's S-bend breathes with its swell
      const bend = curvedRef.current ? sw.map(v => CURVE * (0.65 + 0.35 * v)) : null
      for (const tile of tiles) {
        const { r, s, pts, cx, cy, key } = tile
        const open = st.open[r][s]
        const hue = (((baseHue + pos[r][s] * view.spread) % 360) + 360) % 360
        const glow = 0.5 * (sw[r] + sw[s])
        const born = flashes.get(key)
        const flash = born === undefined ? 0 : 1 - (now - born) / FLASH_MS
        const dist = Math.hypot(cx - pan.x, cy - pan.y) / radius
        const fade = Math.max(0, 1 - dist * dist)
        const quiet = mute[r] || mute[s] ? 0.35 : 1
        const a = Math.min(0.95, ((0.66 - 0.3 * open) * (0.45 + 0.55 * glow) * (1 + level * 0.6) * quiet + flash * 0.4) * fade)
        const sat = view.sat * (1.35 - 0.4 * open)
        const light = view.light + 12 - 14 * open + flash * 16
        ctx.beginPath()
        ctx.moveTo(pts[0], pts[1])
        if (bend) {
          // edges 0 and 2 run along family r, 1 and 3 along family s
          for (let i = 0; i < 4; i++) sEdge(ctx, pts, i, bend[i % 2 ? s : r])
        } else {
          ctx.lineTo(pts[2], pts[3]); ctx.lineTo(pts[4], pts[5]); ctx.lineTo(pts[6], pts[7])
        }
        ctx.closePath()
        ctx.fillStyle = `hsla(${hue.toFixed(0)},${Math.min(95, sat).toFixed(0)}%,${Math.min(92, light).toFixed(0)}%,${a.toFixed(3)})`
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
      setPads(sw)
    }, AUDIO_EVERY_MS)
    return () => clearInterval(id)
  }, [playing])

  // Slow key glides: every `modulate` seconds the harmony moves up a fifth,
  // then home again next time, so long listens don't sit in one key
  useEffect(() => {
    const secs = MOODS[moodIdx].modulate
    if (!playing || !secs) return
    let up = false
    const id = setInterval(() => { up = !up; setKey(up ? 3 / 2 : 1) }, secs * 1000)
    return () => { clearInterval(id); setKey(1, 3) }
  }, [playing, moodIdx])

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

  // Scroll: zoom (vertical, and trackpad pinch), turn colours (sideways)
  useEffect(() => {
    const cv = canvasRef.current
    const onWheel = (e) => {
      e.preventDefault()
      const u = userRef.current
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) u.hue += e.deltaX * 0.3
      else u.zoom = Math.max(0.45, Math.min(2.6, u.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))))
    }
    cv.addEventListener('wheel', onWheel, { passive: false })
    return () => cv.removeEventListener('wheel', onWheel)
  }, [])

  const begin = useCallback(() => {
    startVoices(moodRef.current, volume * volume, starRef.current.n)
    mutedRef.current.forEach((m, k) => setVoiceMuted(k, m))
    playingRef.current = true
    setPlaying(true)
  }, [volume])

  const stop = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    setLevels([])
    stopVoices(1.2)
  }, [])

  // Spacebar stops the sound, or starts it again (same mood/star), like the
  // main console. Not while typing in the birth-time form.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      if (playingRef.current) stop()
      else begin()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [begin, stop])

  useEffect(() => { setPlaybackActive(playing) }, [playing])
  useEffect(() => { registerMediaSessionStop(stop) }, [stop])
  useEffect(() => () => stopVoices(0.2), [])

  const nextMood = () => setMoodIdx(i => (i + 1) % MOODS.length)
  const switchStar = (id, b = born) => {
    const st = starById(id, b)
    const m = Array(st.n).fill(false)
    starRef.current = st
    mutedRef.current = m
    setStarId(id)
    setStar(st)
    setMutedState(m)
    setFamilies(st.n)
    m.forEach((_, k) => setVoiceMuted(k, false))
    save('penrose.star', id)
  }
  const toggleCurved = () => {
    const v = !curved
    curvedRef.current = v
    setCurved(v)
    save('penrose.curved', v)
  }

  const nextStar = () => {
    const id = STAR_IDS[(STAR_IDS.indexOf(starId) + 1) % STAR_IDS.length]
    if (id === 'natal' && !born) { setBirthForm(true); return }
    switchStar(id)
  }
  // datetime-local is wall-clock time; the offset says where that clock was
  const saveBirth = (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const [d, t] = String(f.get('when')).split('T')
    if (!d || !t) return
    const [Y, M, D] = d.split('-').map(Number)
    const [h, mi] = t.split(':').map(Number)
    const off = Number(f.get('offset')) || 0
    const iso = new Date(Date.UTC(Y, M - 1, D, h, mi) - off * 3600000).toISOString()
    save('penrose.born', iso)
    setBorn(iso)
    setBirthForm(false)
    switchStar('natal', iso)
  }
  const forgetBirth = () => {
    try { localStorage.removeItem('penrose.born') } catch { /* private mode */ }
    setBorn(null)
    setBirthForm(false)
    if (starId === 'natal') switchStar('sky', null)
  }
  const toggleMute = (k) => {
    const m = mutedRef.current.slice()
    m[k] = !m[k]
    mutedRef.current = m
    setMutedState(m)
    setVoiceMuted(k, m[k])
  }

  // Tap a tile: flash it and ring its two notes
  const tapAt = (clientX, clientY) => {
    const f = frameRef.current
    if (!f) return
    const rect = canvasRef.current.getBoundingClientRect()
    const dx = clientX - rect.left - f.w / 2, dy = clientY - rect.top - f.h / 2
    const c = Math.cos(f.angle), s = Math.sin(f.angle)
    const x = (dx * c + dy * s) / f.scale + f.px, y = (-dx * s + dy * c) / f.scale + f.py
    const tile = f.tiles.find(t => inRhomb(t.pts, x, y))
    if (!tile) return
    flashRef.current.set(tile.key, performance.now())
    const pan = dx / (f.w / 2)
    strike(tile.r, 0.8, pan, true)
    setTimeout(() => strike(tile.s, 0.6, pan, true), 140)
  }

  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    Object.assign(panRef.current, { held: true, vx: 0, vy: 0, t: performance.now() })
    const ps = pointersRef.current
    ps.set(e.pointerId, [e.clientX, e.clientY])
    if (ps.size === 1) {
      gestureRef.current = { kind: 'drag', last: [e.clientX, e.clientY], start: [e.clientX, e.clientY], t0: performance.now(), moved: false }
    } else if (ps.size === 2) {
      const [a, b] = [...ps.values()]
      const u = userRef.current
      gestureRef.current = { kind: 'pinch', d0: Math.hypot(b[0] - a[0], b[1] - a[1]), a0: Math.atan2(b[1] - a[1], b[0] - a[0]), zoom0: u.zoom, hue0: u.hue }
    }
  }
  const onMove = (e) => {
    const ps = pointersRef.current
    if (!ps.has(e.pointerId)) return
    ps.set(e.pointerId, [e.clientX, e.clientY])
    const g = gestureRef.current
    if (!g) return
    if (g.kind === 'pinch' && ps.size >= 2) {
      const [a, b] = [...ps.values()]
      const u = userRef.current
      u.zoom = Math.max(0.45, Math.min(2.6, g.zoom0 * Math.hypot(b[0] - a[0], b[1] - a[1]) / g.d0))
      let da = Math.atan2(b[1] - a[1], b[0] - a[0]) - g.a0
      if (da > Math.PI) da -= 2 * Math.PI
      if (da < -Math.PI) da += 2 * Math.PI
      u.hue = g.hue0 + (da * 180) / Math.PI * 1.5
    } else if (g.kind === 'drag') {
      const [x, y] = g.last
      const ddx = e.clientX - x, ddy = e.clientY - y
      pushRef.current = [pushRef.current[0] + ddx * PUSH, pushRef.current[1] + ddy * PUSH]
      // slide the tiles with the finger: screen delta → tiling units (undo
      // the view's spin and scale), and track velocity for the glide
      const f = frameRef.current
      if (f) {
        const c = Math.cos(f.angle), sn = Math.sin(f.angle)
        const tx = (ddx * c + ddy * sn) / f.scale, ty = (-ddx * sn + ddy * c) / f.scale
        const pan = panRef.current
        pan.x -= tx; pan.y -= ty
        const now = performance.now(), dts = Math.max(0.008, (now - pan.t) / 1000)
        pan.vx = 0.7 * pan.vx + 0.3 * (-tx / dts); pan.vy = 0.7 * pan.vy + 0.3 * (-ty / dts)
        pan.t = now
      }
      g.last = [e.clientX, e.clientY]
      if (Math.hypot(e.clientX - g.start[0], e.clientY - g.start[1]) > TAP_PX) g.moved = true
    }
  }
  const onUp = (e) => {
    const ps = pointersRef.current
    const g = gestureRef.current
    if (g?.kind === 'drag' && !g.moved && performance.now() - g.t0 < TAP_MS && e.type === 'pointerup') tapAt(e.clientX, e.clientY)
    ps.delete(e.pointerId)
    // after a pinch, a remaining finger carries on as a drag (never a tap)
    if (ps.size === 1) {
      const [p] = ps.values()
      gestureRef.current = { kind: 'drag', last: p, start: p, t0: 0, moved: true }
    } else if (ps.size === 0) {
      gestureRef.current = null
      const pan = panRef.current
      pan.held = false
      // a pause before letting go means no glide
      if (performance.now() - pan.t > 80) { pan.vx = 0; pan.vy = 0 }
    }
  }

  const mood = MOODS[moodIdx]
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

      <div className="penrose__top">
        <button className="penrose__pill" onClick={nextMood} aria-label={`mood: ${mood.id}, tap for next`}>
          {mood.id}
        </button>
        <button className="penrose__pill" onClick={nextStar}
          aria-label={`star: ${starId === 'sky' ? "today's sky" : starId === 'natal' ? 'your birth sky' : `${starId} directions`}, tap for next`}>
          ✶ {starId}
        </button>
        <button className="penrose__pill penrose__pill--small" onClick={toggleCurved}
          aria-label={curved ? 'curved edges on, tap for straight' : 'straight edges, tap for curved'}>
          {curved ? '∿' : '◇'}
        </button>
        {starId === 'natal' && (
          <button className="penrose__pill penrose__pill--small" onClick={() => setBirthForm(true)} aria-label="change birth time">✎</button>
        )}
      </div>
      {starId === 'natal' && <p className="penrose__note">your birth time stays in this browser, never sent anywhere.</p>}

      {birthForm && (
        <form className="penrose__birth" onSubmit={saveBirth}>
          <p>your birth sky: each planet where it stood when you were born becomes one line of the tiling. kept in this browser only, never sent anywhere.</p>
          <label>born <input type="datetime-local" name="when" required
            defaultValue={born ? new Date(born).toISOString().slice(0, 16) : ''} /></label>
          <label>UTC offset there (hours) <input type="number" name="offset" step="0.25" min="-12" max="14"
            defaultValue={born ? 0 : -new Date().getTimezoneOffset() / 60} /></label>
          <div className="penrose__birth-actions">
            <button type="submit">set</button>
            <button type="button" onClick={() => setBirthForm(false)}>cancel</button>
            {born && <button type="button" onClick={forgetBirth}>forget</button>}
          </div>
        </form>
      )}

      <div className="penrose__voices">
        {Array.from({ length: star.n }, (_, k) => {
          const hue = familyHue(k, star.n, mood.hue, Math.min(300, mood.spread))
          const name = star.labels?.[k] ?? `voice ${k + 1}`
          return (
            <button key={`${star.id}-${k}`} className={`penrose__voice${muted[k] ? ' is-muted' : ''}`}
              onClick={() => toggleMute(k)} aria-pressed={!muted[k]}
              aria-label={`${name}: ${muted[k] ? 'muted, tap to unmute' : 'on, tap to mute'}`}
              style={{ '--c': `hsl(${hue.toFixed(0)},70%,62%)`, '--l': levels[k] ?? 0 }}>
              {star.labels && <span className="penrose__glyph">{star.labels[k]}</span>}
            </button>
          )
        })}
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
