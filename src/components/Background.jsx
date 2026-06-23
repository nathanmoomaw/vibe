import { useEffect, useRef } from 'react'
import { getAnalyser } from '../audio/engine.js'
import './Background.css'

// Static star field
const STARS = Array.from({ length: 180 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.4 + 0.2,
  o: Math.random() * 0.45 + 0.05,
  twinkle: Math.random() * Math.PI * 2,
}))

export default function Background({ anyOn, activeColors }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ anyOn, activeColors })

  // Keep ref in sync without restarting the loop
  useEffect(() => { stateRef.current = { anyOn, activeColors } }, [anyOn, activeColors])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const ripples = []
    let lastRipple = 0
    let fdata = null
    let raf

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function draw(t) {
      raf = requestAnimationFrame(draw)
      const { width, height } = canvas
      const cx = width / 2
      const cy = height / 2
      const { anyOn, activeColors } = stateRef.current

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

      // Base background
      ctx.fillStyle = '#010206'
      ctx.fillRect(0, 0, width, height)

      // Center aura — radial gradient that breathes with energy
      if (anyOn && activeColors.length) {
        const auraR = Math.max(width, height) * 0.55
        const colorIdx = Math.floor(t / 4000) % activeColors.length
        const nextIdx = (colorIdx + 1) % activeColors.length
        const lerp = (t % 4000) / 4000
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR)
        const a = (0.04 + energy * 0.18).toFixed(3)
        // parse glow rgba and rebuild with new alpha
        const c = activeColors[colorIdx].replace(/[\d.]+\)$/, `${a})`)
        grad.addColorStop(0, c)
        grad.addColorStop(0.5, c.replace(/[\d.]+\)$/, `${(a * 0.3).toFixed(3)})`))
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      }

      // Stars with subtle twinkle
      for (const s of STARS) {
        const twink = Math.sin(t * 0.0008 + s.twinkle) * 0.15
        ctx.beginPath()
        ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, s.o + twink)})`
        ctx.fill()
      }

      // Spawn ripples
      const minInterval = anyOn ? Math.max(300, 1400 - energy * 2000) : 99999
      if (anyOn && activeColors.length && t - lastRipple > minInterval) {
        const color = activeColors[Math.floor(Math.random() * activeColors.length)]
        ripples.push({
          born: t,
          color,
          maxR: Math.hypot(cx, cy) * 1.5,
          speed: 0.9 + Math.random() * 0.6,
        })
        lastRipple = t
      }

      // Draw + age ripples
      const diag = Math.hypot(cx, cy)
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i]
        const age = (t - rip.born) / (4000 / rip.speed)
        if (age >= 1) { ripples.splice(i, 1); continue }
        const r = age * rip.maxR
        const alpha = (1 - age) * (0.5 + energy * 0.3)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = rip.color.replace(/[\d.]+\)$/, `${alpha.toFixed(3)})`)
        ctx.lineWidth = Math.max(0.3, (1 - age) * 2.5)
        ctx.stroke()
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
