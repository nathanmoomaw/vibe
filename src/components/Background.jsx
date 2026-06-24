import { useEffect, useRef } from 'react'
import { getAnalyser } from '../audio/engine.js'
import './Background.css'

const STARS = Array.from({ length: 180 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.4 + 0.2,
  o: Math.random() * 0.45 + 0.05,
  twinkle: Math.random() * Math.PI * 2,
}))

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
  const canvasRef = useRef(null)
  const stateRef  = useRef({ anyOn, activeSounds })

  useEffect(() => { stateRef.current = { anyOn, activeSounds } }, [anyOn, activeSounds])

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

      // Stars
      for (const s of STARS) {
        const twink = Math.sin(t * 0.0008 + s.twinkle) * 0.15
        ctx.beginPath()
        ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, s.o + twink)})`
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
