import { useEffect, useRef } from 'react'
import { getAnalyser } from '../audio/engine.js'
import './Background.css'

// ── Star catalog: [ra_deg, dec_deg, magnitude, twinkle_phase] ────────
const D2R = Math.PI / 180

const NAMED_STARS = [
  [101.3, -16.7, -1.46], [96.0, -52.7, -0.74], [213.9, 19.2, -0.05],
  [279.2,  38.8,  0.03], [ 79.2,  46.0,  0.08], [ 78.6,  -8.2,  0.12],
  [114.8,   5.2,  0.38], [ 24.4, -57.2,  0.46], [ 88.8,   7.4,  0.50],
  [210.9, -60.4,  0.61], [297.7,   8.9,  0.77], [ 68.9,  16.5,  0.85],
  [201.3, -11.2,  0.97], [247.4, -26.4,  1.06], [116.3,  28.0,  1.14],
  [344.4, -29.6,  1.16], [310.4,  45.3,  1.25], [191.9, -59.7,  1.25],
  [152.1,  12.0,  1.35], [104.7, -29.0,  1.50], [113.6,  31.9,  1.58],
  [263.4, -37.1,  1.62], [187.8, -57.1,  1.63], [ 81.3,   6.3,  1.64],
  [ 81.6,  28.6,  1.65], [138.3, -69.7,  1.68], [ 84.1,  -1.2,  1.70],
  [ 85.2,  -1.9,  1.74], [193.5,  56.0,  1.76], [ 51.1,  49.9,  1.79],
  [165.9,  61.8,  1.79], [107.1, -26.4,  1.83], [276.0, -34.4,  1.85],
  [206.9,  49.3,  1.86], [252.2, -69.0,  1.92], [ 99.4,  16.4,  1.93],
  [130.8, -54.7,  1.93], [306.4, -56.7,  1.94], [ 95.7, -18.0,  1.98],
  [141.9,  -8.7,  2.00], [ 38.0,  89.3,  1.97], [ 31.8,  23.5,  2.00],
  [ 10.9, -18.0,  2.04], [283.8, -26.3,  2.05], [ 86.9,  -9.7,  2.07],
  [  2.1,  29.1,  2.07], [222.7,  74.2,  2.08], [263.7,  12.6,  2.08],
  [ 56.9,  31.9,  2.07], [ 47.0,  41.0,  2.09], [177.3,  14.6,  2.14],
  [120.9, -40.0,  2.25], [139.3, -59.3,  2.21], [204.9, -53.5,  2.29],
  [218.9, -42.2,  2.30], [116.3,  28.0,  2.40], [163.1, -14.8,  2.59],
].map(([ra, dec, mag], i) => ({ ra, dec, mag, phase: i * 1.618 }))

// Faint background stars (golden-angle RA, uniform-sphere Dec)
const FAINT_STARS = Array.from({ length: 120 }, (_, i) => ({
  ra:    (i * 137.508) % 360,
  dec:   Math.asin(2 * ((i * 0.618034) % 1) - 1) / D2R,
  mag:   2.5 + (i % 30) / 12,
  phase: i * 0.937,
}))

const ALL_STARS = [...NAMED_STARS, ...FAINT_STARS]

// Default location: Los Angeles
const DEFAULT_LOC = { lat: 34.05, lon: -118.24 }

function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5
}

function computeVisibleStars(loc, date, width, height) {
  const jd = julianDate(date)
  const T  = (jd - 2451545.0) / 36525
  const gmst_deg = ((280.46061837 + 360.98564736629 * (jd - 2451545.0)
    + T * T * 0.000387933 - T * T * T / 38710000) % 360 + 360) % 360
  const lst = ((gmst_deg + loc.lon) % 360 + 360) % 360

  const lat_r = loc.lat * D2R
  const cx = width / 2, cy = height / 2
  const skyR = Math.min(width, height) * 0.46

  return ALL_STARS.flatMap(s => {
    const ha_r  = ((lst - s.ra + 360) % 360) * D2R
    const dec_r = s.dec * D2R
    const alt = Math.asin(
      Math.sin(dec_r) * Math.sin(lat_r) + Math.cos(dec_r) * Math.cos(lat_r) * Math.cos(ha_r)
    ) / D2R
    if (alt < -1) return []   // below horizon

    const az_r = Math.atan2(
      -Math.cos(dec_r) * Math.sin(ha_r),
      Math.sin(dec_r) * Math.cos(lat_r) - Math.cos(dec_r) * Math.sin(lat_r) * Math.cos(ha_r)
    )
    const dist = Math.max(0, (90 - alt) / 90) * skyR
    const sx = cx + dist * Math.sin(az_r)
    const sy = cy - dist * Math.cos(az_r)
    const r  = Math.max(0.35, 2.1 - s.mag * 0.45)
    const baseAlpha = Math.max(0.06, Math.min(0.9, 0.95 - s.mag * 0.22))
    return [{ sx, sy, r, baseAlpha, phase: s.phase }]
  })
}

// Per-sound pulse shape config
const SOUND_SHAPE = {
  white: { shape: 'halo',   petals: 0 },
  pink:  { shape: 'flower', petals: 4 },
  blue:  { shape: 'star',   points: 6 },
  bell:  { shape: 'halo',   petals: 0 },
  chime: { shape: 'star',   points: 5 },
  gong:  { shape: 'flower', petals: 6 },
  birds: { shape: 'star',   points: 8 },
  wind:  { shape: 'halo',   petals: 0 },
  water: { shape: 'flower', petals: 5 },
  fire:  { shape: 'flower', petals: 3 },
  earth: { shape: 'halo',   petals: 0 },
}

// ── Shape drawing functions ────────────────────────────────────────

function drawHalo(ctx, cx, cy, r, alpha, glow, age) {
  // Three layered rings: outer glow, mid ring, inner line
  const layers = [
    { dr: 18, w: 22, a: 0.18 },
    { dr:  6, w: 10, a: 0.35 },
    { dr:  0, w:  3, a: 0.75 },
  ]
  for (const { dr, w, a } of layers) {
    const la = alpha * a
    if (la < 0.004) continue
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(1, r + dr * (1 - age)), 0, Math.PI * 2)
    ctx.strokeStyle = glow.replace(/[\d.]+\)$/, `${la.toFixed(3)})`)
    ctx.lineWidth = w * (1 - age * 0.5)
    ctx.stroke()
  }
}

function drawFlower(ctx, cx, cy, r, petals, rotation, alpha, glow, age) {
  const steps = 480
  const lineW = Math.max(0.5, (1 - age) * 3)
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2
    const rr = r * Math.abs(Math.cos((petals / 2) * theta))
    const x = cx + rr * Math.cos(theta + rotation)
    const y = cy + rr * Math.sin(theta + rotation)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.strokeStyle = glow.replace(/[\d.]+\)$/, `${(alpha * 0.85).toFixed(3)})`)
  ctx.lineWidth = lineW
  ctx.stroke()

  // Soft glow shell around the flower
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2)
  ctx.strokeStyle = glow.replace(/[\d.]+\)$/, `${(alpha * 0.12).toFixed(3)})`)
  ctx.lineWidth = r * 0.3
  ctx.stroke()
}

function drawStar(ctx, cx, cy, r, points, rotation, alpha, glow, age) {
  const innerR = r * 0.42
  const lineW = Math.max(0.5, (1 - age) * 2.5)

  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 + rotation - Math.PI / 2
    const radius = i % 2 === 0 ? r : innerR
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.strokeStyle = glow.replace(/[\d.]+\)$/, `${(alpha * 0.9).toFixed(3)})`)
  ctx.lineWidth = lineW
  ctx.stroke()

  // Glow halo behind the star
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2)
  ctx.strokeStyle = glow.replace(/[\d.]+\)$/, `${(alpha * 0.1).toFixed(3)})`)
  ctx.lineWidth = r * 0.28
  ctx.stroke()
}

// ─────────────────────────────────────────────────────────────────

export default function Background({ anyOn, activeSounds }) {
  const canvasRef      = useRef(null)
  const stateRef       = useRef({ anyOn, activeSounds })
  const locationRef    = useRef(DEFAULT_LOC)
  const starsRef       = useRef([])
  const lastStarCalc   = useRef(0)
  const canvasSizeRef  = useRef({ w: 0, h: 0 })

  useEffect(() => { stateRef.current = { anyOn, activeSounds } }, [anyOn, activeSounds])

  // Geolocation — fall back to LA silently
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      locationRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude }
      lastStarCalc.current = 0  // force recompute
    }, () => {})
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const ripples = []
    let lastRipple = 0
    let fdata = null
    let raf

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      canvasSizeRef.current = { w: canvas.width, h: canvas.height }
      lastStarCalc.current = 0  // recompute on resize
    }
    resize()
    window.addEventListener('resize', resize)

    function draw(t) {
      raf = requestAnimationFrame(draw)
      const { width, height } = canvas
      const cx = width / 2, cy = height / 2
      const { anyOn, activeSounds } = stateRef.current

      // Audio energy
      let energy = 0
      if (anyOn) {
        const analyser = getAnalyser()
        if (!fdata) fdata = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(fdata)
        for (const v of fdata) energy += v
        energy = energy / fdata.length / 255
      } else {
        fdata = null
      }

      ctx.fillStyle = '#010206'
      ctx.fillRect(0, 0, width, height)

      // Center aura
      if (anyOn && activeSounds.length) {
        const auraR = Math.max(width, height) * 0.55
        const s = activeSounds[Math.floor(t / 4000) % activeSounds.length]
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR)
        const a = (0.04 + energy * 0.18).toFixed(3)
        const c = s.glow.replace(/[\d.]+\)$/, `${a})`)
        grad.addColorStop(0, c)
        grad.addColorStop(0.5, s.glow.replace(/[\d.]+\)$/, `${(a * 0.3).toFixed(3)})`))
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      }

      // Recompute real star positions every 60s or on first draw
      if (t - lastStarCalc.current > 60000 || starsRef.current.length === 0) {
        const { w, h } = canvasSizeRef.current
        starsRef.current = computeVisibleStars(locationRef.current, new Date(), w || width, h || height)
        lastStarCalc.current = t
      }

      // Draw real sky stars
      for (const s of starsRef.current) {
        const twink = Math.sin(t * 0.0008 + s.phase) * 0.14
        const alpha = Math.max(0, Math.min(1, s.baseAlpha + twink))
        ctx.beginPath()
        ctx.arc(s.sx, s.sy, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`
        ctx.fill()
      }

      // Spawn ripple
      const minInterval = anyOn ? Math.max(1800, 5000 - energy * 4000) : 99999
      if (anyOn && activeSounds.length && t - lastRipple > minInterval) {
        const src = activeSounds[Math.floor(Math.random() * activeSounds.length)]
        const cfg = SOUND_SHAPE[src.id] ?? { shape: 'halo' }
        ripples.push({
          born: t,
          glow: src.glow,
          maxR: Math.hypot(cx, cy) * 1.5,
          speed: 0.5 + Math.random() * 0.35,
          shape: cfg.shape,
          petals: cfg.petals ?? 4,
          points: cfg.points ?? 5,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() * 1.5 + 0.5) * (Math.random() < 0.5 ? 1 : -1),
        })
        lastRipple = t
      }

      // Draw + age ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i]
        const age = (t - rip.born) / (9000 / rip.speed)
        if (age >= 1) { ripples.splice(i, 1); continue }

        const r     = age * rip.maxR
        const alpha = (1 - age) * (0.55 + energy * 0.3)
        const rot   = rip.rotation + rip.rotSpeed * age * Math.PI

        ctx.save()
        if (rip.shape === 'halo') {
          drawHalo(ctx, cx, cy, r, alpha, rip.glow, age)
        } else if (rip.shape === 'flower') {
          drawFlower(ctx, cx, cy, r, rip.petals, rot, alpha, rip.glow, age)
        } else {
          drawStar(ctx, cx, cy, r, rip.points, rot, alpha, rip.glow, age)
        }
        ctx.restore()
      }
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="vibe-bg" />
}
