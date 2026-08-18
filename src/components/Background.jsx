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

// Faint fill stars: golden-angle RA, uniform-sphere Dec — increased density
const FAINT_RAW = Array.from({ length: 220 }, (_, i) => [
  (i * 137.508) % 360,
  Math.asin(2 * ((i * 0.618034) % 1) - 1) / D2R,
  2.5 + (i % 40) / 14,
])

// Pre-compute 3D Cartesian + rendering params once at module load
const STAR_3D = [...RAW_STARS, ...FAINT_RAW].map(([ra, dec, mag], i) => {
  const rr = ra  * D2R
  const dr = dec * D2R
  return {
    x: Math.cos(dr) * Math.cos(rr),
    y: Math.cos(dr) * Math.sin(rr),
    z: Math.sin(dr),
    r: Math.max(0.55, 2.7 - mag * 0.42),          // larger dots
    baseAlpha: Math.max(0.14, Math.min(1.0, 1.08 - mag * 0.20)), // brighter
    glow: mag < 1.0,                                // bright stars get a halo
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

// ── Hypnotic breathing rate ──────────────────────────────────────
// Cousto Cosmic Octave method (f = 1/T × 2ⁿ) run in reverse: octave-divide a
// sound's own frequency down into the ~0.08–0.25 Hz "breathing" band — the
// same principle as using Schumann resonance as an LFO rate rather than an
// audible tone. Periodic tones (bell/chime/gong) already cycle in that band
// naturally via their trigger rate, so their real cadence is used directly.
const BREATH_MIN_HZ = 0.08
const BREATH_MAX_HZ = 0.25

function toBreathHz(freq) {
  let f = freq
  while (f > BREATH_MAX_HZ) f /= 2
  while (f < BREATH_MIN_HZ) f *= 2
  return f
}

function breathHzFor(s) {
  if (s.rateSec) return 1 / s.rateSec      // periodic tone's own trigger cadence
  if (s.freq) return toBreathHz(s.freq)    // noise filter freq, octave-reduced
  return 0.12                              // elemental drones: calm default
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

// Selfie-filter style glint: a tapered 4-point sparkle, drawn twice (crossed)
// with a bright center — the "sparkle" look from Snapchat/beauty-app overlays,
// distinct from the console's diagonal shimmer sweep and the star twinkle.
function drawGlintSpike(ctx, len, width) {
  ctx.beginPath()
  ctx.moveTo(0, -len)
  ctx.quadraticCurveTo(width, 0, 0, len)
  ctx.quadraticCurveTo(-width, 0, 0, -len)
  ctx.fill()
}

function drawSparkle(ctx, x, y, r, alpha, color) {
  if (alpha < 0.01 || r < 0.5) return
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  drawGlintSpike(ctx, r, r * 0.16)
  ctx.rotate(Math.PI / 2)
  drawGlintSpike(ctx, r, r * 0.16)
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
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
    const sparkles = []
    const glitters = []
    let lastRipple = 0
    let fdata = null
    let raf

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Center-origin blur vignette ─────────────────────────────────────
    // The console has no background of its own, so whatever's drawn right
    // behind it (aura wash, ripples, stars) needs to read as soft and
    // unobtrusive rather than competing with the controls — but everything
    // outside the console's footprint should stay sharp. Each frame, the
    // region around screen-center gets copied out, blurred, and faded back
    // in through a radial mask (full strength through most of the radius,
    // gradually sharpening at the outer edge) instead of blurring the whole
    // canvas or hand-tuning blur per shape.
    const VIGNETTE_R = 290 // ≈ half the console's own max-width (580px)
    const vSrc = document.createElement('canvas')
    const vDst = document.createElement('canvas')
    vSrc.width = vSrc.height = vDst.width = vDst.height = VIGNETTE_R * 2
    const vSrcCtx = vSrc.getContext('2d')
    const vDstCtx = vDst.getContext('2d')
    const vMask = vDstCtx.createRadialGradient(VIGNETTE_R, VIGNETTE_R, 0, VIGNETTE_R, VIGNETTE_R, VIGNETTE_R)
    vMask.addColorStop(0,    'rgba(255,255,255,1)')
    vMask.addColorStop(0.6,  'rgba(255,255,255,0.95)')
    vMask.addColorStop(0.85, 'rgba(255,255,255,0.55)')
    vMask.addColorStop(1,    'rgba(255,255,255,0)')

    function drawVignette(cx, cy) {
      const sx = cx - VIGNETTE_R, sy = cy - VIGNETTE_R
      vSrcCtx.clearRect(0, 0, VIGNETTE_R * 2, VIGNETTE_R * 2)
      vSrcCtx.drawImage(canvas, sx, sy, VIGNETTE_R * 2, VIGNETTE_R * 2, 0, 0, VIGNETTE_R * 2, VIGNETTE_R * 2)

      vDstCtx.clearRect(0, 0, VIGNETTE_R * 2, VIGNETTE_R * 2)
      vDstCtx.filter = 'blur(32px)'
      vDstCtx.drawImage(vSrc, 0, 0)
      vDstCtx.filter = 'none'
      vDstCtx.globalCompositeOperation = 'destination-in'
      vDstCtx.fillStyle = vMask
      vDstCtx.fillRect(0, 0, VIGNETTE_R * 2, VIGNETTE_R * 2)
      vDstCtx.globalCompositeOperation = 'source-over'

      ctx.drawImage(vDst, sx, sy)
    }

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

      // Primary center aura — stronger intensity, breathing in time with the sound's own rate
      let avgBreathHz = 0.12
      if (anyOn && activeSounds.length) {
        const s = activeSounds[Math.floor(t / 3500) % activeSounds.length]
        const breath = 0.5 + 0.5 * Math.sin(t * 0.001 * breathHzFor(s) * 2 * Math.PI)
        const a = ((0.12 + energy * 0.34) * (0.65 + 0.35 * breath)).toFixed(3)
        const auraR = Math.max(width, height) * 0.72
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR)
        grad.addColorStop(0,   s.glow.replace(/[\d.]+\)$/, `${a})`))
        grad.addColorStop(0.5, s.glow.replace(/[\d.]+\)$/, `${(a * 0.38).toFixed(3)})`))
        grad.addColorStop(1,   'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)

        // Slow orbiting secondary wash — drifts off-center, cycles sounds at different rate,
        // breathing a half-cycle out of phase with the primary aura
        const s2 = activeSounds[Math.floor(t / 9000) % activeSounds.length]
        const breath2 = 0.5 + 0.5 * Math.sin(t * 0.001 * breathHzFor(s2) * 2 * Math.PI + Math.PI)
        const θ  = t * 0.000048
        const offX = cx + Math.cos(θ) * width * 0.18
        const offY = cy + Math.sin(θ) * height * 0.14
        const a2 = ((0.06 + energy * 0.14) * (0.65 + 0.35 * breath2)).toFixed(3)
        const grad2 = ctx.createRadialGradient(offX, offY, 0, offX, offY, Math.max(width, height) * 0.92)
        grad2.addColorStop(0,   s2.glow.replace(/[\d.]+\)$/, `${a2})`))
        grad2.addColorStop(0.55, s2.glow.replace(/[\d.]+\)$/, `${(a2 * 0.22).toFixed(3)})`))
        grad2.addColorStop(1,   'rgba(0,0,0,0)')
        ctx.fillStyle = grad2
        ctx.fillRect(0, 0, width, height)

        avgBreathHz = activeSounds.reduce((sum, s3) => sum + breathHzFor(s3), 0) / activeSounds.length
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

      // Trail: 24 seconds of sidereal rotation behind each star
      const TRAIL_ANGLE = (24 / 3600) * Math.PI * 2
      const θt = θ - TRAIL_ANGLE
      const cθt = Math.cos(θt), sθt = Math.sin(θt)

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

        // Limb darkening: reduced fade so edge stars stay visible
        const limbFade = Math.pow(y3, 0.20)

        const twink = Math.sin(t * 0.0008 + s.phase) * 0.16
        const alpha = Math.max(0, Math.min(1, (s.baseAlpha + twink) * limbFade))
        if (alpha < 0.01) continue

        // ── Motion trail: star's position 24s ago (sidereal only, wobble stable) ──
        const tx1 = s.x * cθt - s.y * sθt
        const ty1 = s.x * sθt + s.y * cθt
        const tx2 = tx1
        const ty2 = ty1 * cX - z1 * sX
        const tz2 = ty1 * sX + z1 * cX
        const tx3 = tx2 * cZ - ty2 * sZ
        const ty3 = tx2 * sZ + ty2 * cZ
        const tz3 = tz2

        if (ty3 > 0) {
          const tSx = cx + tx3 * globeR
          const tSy = cy - tz3 * globeR
          const dist = Math.hypot(sx - tSx, sy - tSy)
          if (dist > 0.3) {
            const tGrad = ctx.createLinearGradient(tSx, tSy, sx, sy)
            tGrad.addColorStop(0, 'rgba(200,210,255,0)')
            tGrad.addColorStop(1, `rgba(200,210,255,${(alpha * 0.28).toFixed(3)})`)
            ctx.beginPath()
            ctx.moveTo(tSx, tSy)
            ctx.lineTo(sx, sy)
            ctx.strokeStyle = tGrad
            ctx.lineWidth = s.r * 0.55
            ctx.stroke()
          }
        }

        // Glow halo for bright stars
        if (s.glow) {
          ctx.beginPath()
          ctx.arc(sx, sy, s.r * 2.8, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(220,230,255,${(alpha * 0.18).toFixed(3)})`
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`
        ctx.fill()
      }

      // Spawn ripple — cadence tracks the active sounds' own breathing rate
      const breathPeriodMs = 1000 / avgBreathHz
      const minInterval = anyOn ? Math.min(14000, Math.max(1800, breathPeriodMs * (1 - energy * 0.3))) : 99999
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

      // Selfie-filter sparkle overlay — scattered glints that pop and fade,
      // denser when a sound is actually playing (ties the flourish to energy
      // rather than firing at a constant background rate)
      const sparkleChance = anyOn ? 0.015 + energy * 0.05 : 0.003
      if (Math.random() < sparkleChance) {
        const src = activeSounds.length
          ? activeSounds[Math.floor(Math.random() * activeSounds.length)]
          : null
        sparkles.push({
          born: t,
          x: Math.random() * width,
          y: Math.random() * height,
          r: 5 + Math.random() * 12,
          life: 650 + Math.random() * 500,
          color: src ? src.glow.replace(/[\d.]+\)$/, '0.9)') : 'rgba(255,255,255,0.85)',
        })
      }
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const sp = sparkles[i]
        const age = (t - sp.born) / sp.life
        if (age >= 1) { sparkles.splice(i, 1); continue }
        // pop in, hold, fade out
        const scale = age < 0.25 ? age / 0.25 : age > 0.7 ? Math.max(0, 1 - (age - 0.7) / 0.3) : 1
        drawSparkle(ctx, sp.x, sp.y, sp.r * scale, scale * 0.85, sp.color)
      }

      // Falling glitter — small glints that spawn around the console/ring
      // footprint and drift downward with a light gravity accel, as if
      // shaken loose off the console rather than popping in place like the
      // sparkle overlay above.
      const glitterChance = anyOn ? 0.02 + energy * 0.035 : 0.004
      if (Math.random() < glitterChance) {
        const src = activeSounds.length
          ? activeSounds[Math.floor(Math.random() * activeSounds.length)]
          : null
        const angle = Math.random() * Math.PI * 2
        const originR = 90 + Math.random() * 280
        glitters.push({
          born: t,
          x: cx + Math.cos(angle) * originR,
          y: cy + Math.sin(angle) * originR * 0.75,
          vx: (Math.random() - 0.5) * 16,
          vy: 22 + Math.random() * 28,
          r: 1.5 + Math.random() * 2.5,
          life: 1600 + Math.random() * 1400,
          color: src ? src.glow.replace(/[\d.]+\)$/, '0.9)') : 'rgba(255,255,255,0.8)',
        })
      }
      for (let i = glitters.length - 1; i >= 0; i--) {
        const g = glitters[i]
        const age = (t - g.born) / g.life
        if (age >= 1) { glitters.splice(i, 1); continue }
        const dt = (age * g.life) / 1000
        const gx = g.x + g.vx * dt
        const gy = g.y + g.vy * dt + 5 * dt * dt
        const alpha = age < 0.12 ? age / 0.12 : Math.max(0, 1 - (age - 0.4) / 0.6)
        drawSparkle(ctx, gx, gy, g.r * (1 - age * 0.3), alpha * 0.75, g.color)
      }

      drawVignette(cx, cy)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="vibe-bg" />
}
