import { useEffect, useRef } from 'react'
import { getAnalyser } from '../audio/engine.js'
import './Background.css'

// ── 3D Celestial Globe ────────────────────────────────────────────
// Stars stored as fixed Cartesian coords on a unit sphere (RA/Dec → XYZ).
// Each frame the sphere is rotated (sidereal + slow wobble) and projected
// orthographically.  Camera sits at +Y looking toward −Y, so:
//   screenX = cx + X * globeR
//   screenY = cy − Z * globeR
//   Visible: Y > 0  (front hemisphere facing camera)

const D2R = Math.PI / 180

const RAW_STARS = [
  // [ra_deg, dec_deg, mag]
  [101.3,-16.7,-1.46],[96.0,-52.7,-0.74],[213.9,19.2,-0.05],
  [279.2,38.8,0.03],[79.2,46.0,0.08],[78.6,-8.2,0.12],
  [114.8,5.2,0.38],[24.4,-57.2,0.46],[88.8,7.4,0.50],
  [210.9,-60.4,0.61],[297.7,8.9,0.77],[68.9,16.5,0.85],
  [201.3,-11.2,0.97],[247.4,-26.4,1.06],[116.3,28.0,1.14],
  [344.4,-29.6,1.16],[310.4,45.3,1.25],[191.9,-59.7,1.25],
  [152.1,12.0,1.35],[104.7,-29.0,1.50],[113.6,31.9,1.58],
  [263.4,-37.1,1.62],[187.8,-57.1,1.63],[81.3,6.3,1.64],
  [81.6,28.6,1.65],[138.3,-69.7,1.68],[84.1,-1.2,1.70],
  [85.2,-1.9,1.74],[193.5,56.0,1.76],[51.1,49.9,1.79],
  [165.9,61.8,1.79],[107.1,-26.4,1.83],[276.0,-34.4,1.85],
  [206.9,49.3,1.86],[252.2,-69.0,1.92],[99.4,16.4,1.93],
  [130.8,-54.7,1.93],[306.4,-56.7,1.94],[95.7,-18.0,1.98],
  [141.9,-8.7,2.00],[38.0,89.3,1.97],[31.8,23.5,2.00],
  [10.9,-18.0,2.04],[283.8,-26.3,2.05],[86.9,-9.7,2.07],
  [2.1,29.1,2.07],[222.7,74.2,2.08],[263.7,12.6,2.08],
  [56.9,31.9,2.07],[47.0,41.0,2.09],[177.3,14.6,2.14],
  [120.9,-40.0,2.25],[139.3,-59.3,2.21],[204.9,-53.5,2.29],
  [218.9,-42.2,2.30],[116.3,28.0,2.40],[163.1,-14.8,2.59],
]

// Faint fill stars: golden-angle RA, uniform-sphere Dec
const FAINT_RAW = Array.from({ length: 130 }, (_, i) => [
  (i * 137.508) % 360,
  Math.asin(2 * ((i * 0.618034) % 1) - 1) / D2R,
  2.5 + (i % 30) / 12,
])

// Pre-compute 3D Cartesian + rendering params once at module load
const STAR_3D = [...RAW_STARS, ...FAINT_RAW].map(([ra, dec, mag], i) => {
  const rr = ra  * D2R
  const dr = dec * D2R
  return {
    x: Math.cos(dr) * Math.cos(rr),
    y: Math.cos(dr) * Math.sin(rr),
    z: Math.sin(dr),
    r: Math.max(0.35, 2.1 - mag * 0.45),
    baseAlpha: Math.max(0.06, Math.min(0.88, 0.92 - mag * 0.21)),
    phase: (i < RAW_STARS.length ? i * 1.618 : i * 0.937),
  }
})

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

      // Primary center aura — stronger intensity
      if (anyOn && activeSounds.length) {
        const s = activeSounds[Math.floor(t / 3500) % activeSounds.length]
        const a = (0.12 + energy * 0.34).toFixed(3)
        const auraR = Math.max(width, height) * 0.72
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR)
        grad.addColorStop(0,   s.glow.replace(/[\d.]+\)$/, `${a})`))
        grad.addColorStop(0.5, s.glow.replace(/[\d.]+\)$/, `${(a * 0.38).toFixed(3)})`))
        grad.addColorStop(1,   'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)

        // Slow orbiting secondary wash — drifts off-center, cycles sounds at different rate
        const s2 = activeSounds[Math.floor(t / 9000) % activeSounds.length]
        const θ  = t * 0.000048
        const offX = cx + Math.cos(θ) * width * 0.18
        const offY = cy + Math.sin(θ) * height * 0.14
        const a2 = (0.06 + energy * 0.14).toFixed(3)
        const grad2 = ctx.createRadialGradient(offX, offY, 0, offX, offY, Math.max(width, height) * 0.92)
        grad2.addColorStop(0,   s2.glow.replace(/[\d.]+\)$/, `${a2})`))
        grad2.addColorStop(0.55, s2.glow.replace(/[\d.]+\)$/, `${(a2 * 0.22).toFixed(3)})`))
        grad2.addColorStop(1,   'rgba(0,0,0,0)')
        ctx.fillStyle = grad2
        ctx.fillRect(0, 0, width, height)
      }

      // ── 3D Celestial Globe ─────────────────────────────────────────
      // Main rotation: 1 full revolution per hour (visibly slow drift).
      // Two slow wobble axes give the floating-in-space feel.
      // Camera at +Y, looking −Y → project X onto screenX, Z onto screenY.
      const θ    = (t / 3600000) * Math.PI * 2          // 1 rev/hour
      const wobX = Math.sin(t * 0.0000262) * 0.055      // ±3.1°, ~240s period
      const wobZ = Math.cos(t * 0.0000151) * 0.038      // ±2.2°, ~416s period

      const cθ = Math.cos(θ), sθ = Math.sin(θ)
      const cX = Math.cos(wobX), sX = Math.sin(wobX)
      const cZ = Math.cos(wobZ), sZ = Math.sin(wobZ)

      // Globe radius large enough to cover full screen — stars fill edge-to-edge
      const globeR = Math.hypot(cx, cy) * 1.62

      for (const s of STAR_3D) {
        // Step 1: sidereal rotation around Z-axis (NCP)
        const x1 = s.x * cθ - s.y * sθ
        const y1 = s.x * sθ + s.y * cθ
        const z1 = s.z

        // Step 2: slow wobble tilt around X-axis
        const x2 = x1
        const y2 = y1 * cX - z1 * sX
        const z2 = y1 * sX + z1 * cX

        // Step 3: slow wobble tilt around Z-axis
        const x3 = x2 * cZ - y2 * sZ
        const y3 = x2 * sZ + y2 * cZ
        const z3 = z2

        if (y3 < 0) continue   // on the back face of the globe

        const sx = cx + x3 * globeR
        const sy = cy - z3 * globeR

        // Cull off-screen with small margin
        if (sx < -3 || sx > width + 3 || sy < -3 || sy > height + 3) continue

        // Limb darkening: stars near the horizon of the visible hemisphere fade out
        const limbFade = Math.pow(y3, 0.38)

        const twink = Math.sin(t * 0.0008 + s.phase) * 0.12
        const alpha = Math.max(0, Math.min(1, (s.baseAlpha + twink) * limbFade))
        if (alpha < 0.018) continue

        ctx.beginPath()
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2)
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
