import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import QRCode from 'qrcode'
import './VibeQR.css'

// ── Iridescent gradient palette ──────────────────────────────────────
const DEFAULT_GRADIENT = [
  { offset: 0,    color: [100,  40, 255] },
  { offset: 0.15, color: [  0, 180, 255] },
  { offset: 0.3,  color: [ 30, 255, 200] },
  { offset: 0.48, color: [255, 100, 200] },
  { offset: 0.65, color: [255, 155,  40] },
  { offset: 0.82, color: [ 40, 200, 255] },
  { offset: 1,    color: [100,  40, 255] },
]

function lerpColor(stops, t) {
  t = Math.max(0, Math.min(1, t))
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].offset && t <= stops[i + 1].offset) {
      const u = (t - stops[i].offset) / (stops[i + 1].offset - stops[i].offset)
      return stops[i].color.map((c, j) => Math.round(c + (stops[i + 1].color[j] - c) * u))
    }
  }
  return stops[stops.length - 1].color
}

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return h
}

function gradientFromGlows(glows) {
  const rgb = glows.map(c => {
    const m = c.match(/[\d.]+/g)
    return m ? [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])] : [100, 40, 255]
  })
  return rgb.map((c, i) => ({ offset: i / (rgb.length - 1 || 1), color: c }))
}

function drawSpills(ctx, w, h, rng, gradient) {
  for (let i = 0; i < 7 + Math.floor(rng() * 5); i++) {
    const side = Math.floor(rng() * 4)
    const tp   = 0.15 + rng() * 0.7
    const len  = 6 + rng() * 16
    const wid  = 3 + rng() * 8

    let sx, sy, ex, ey
    if      (side === 0) { sx = tp*w; sy = 0;  ex = sx + (rng()-0.5)*wid; ey = -len }
    else if (side === 1) { sx = w;    sy = tp*h; ex = w+len; ey = sy+(rng()-0.5)*wid }
    else if (side === 2) { sx = tp*w; sy = h;  ex = sx + (rng()-0.5)*wid; ey = h+len }
    else                 { sx = 0;    sy = tp*h; ex = -len; ey = sy+(rng()-0.5)*wid }

    const cp1x = sx+(ex-sx)*0.3+(rng()-0.5)*wid
    const cp1y = sy+(ey-sy)*0.3+(rng()-0.5)*wid
    const cp2x = sx+(ex-sx)*0.7+(rng()-0.5)*wid*0.5
    const cp2y = sy+(ey-sy)*0.7+(rng()-0.5)*wid*0.5

    const t = (sx + sy) / (w + h)
    const [r, g, b] = lerpColor(gradient, t)

    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey)
    ctx.bezierCurveTo(ex+(rng()-0.5)*3, ey+(rng()-0.5)*3,
                      cp1x+wid*0.2, cp1y+wid*0.2, sx, sy)
    ctx.closePath()
    ctx.fillStyle = `rgba(${r},${g},${b},${0.45 + rng()*0.45})`
    ctx.fill()
  }
}

export function drawVibeQR(canvas, url, name, seed = 0, activeGlows = []) {
  const QR      = 260
  const sp      = 22
  const nameH   = name?.trim() ? 34 : 0   // extra canvas height below QR for name
  const W       = QR + sp * 2
  const H       = QR + sp * 2 + nameH

  canvas.width  = W
  canvas.height = H

  const gradient = activeGlows.length >= 2
    ? gradientFromGlows(activeGlows)
    : DEFAULT_GRADIENT

  const tmp = document.createElement('canvas')
  // Always use 'M' — 'H' (30% redundancy) makes QR denser and harder to scan
  QRCode.toCanvas(tmp, url, {
    width: QR, margin: 2,
    color: { dark: '#000000', light: '#00000000' },
    errorCorrectionLevel: 'M',
  }, () => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#010206'
    ctx.fillRect(0, 0, W, H)

    const rng = mulberry32(hashStr(url) ^ Math.floor(seed * 0x7fffffff))

    // Spill edges behind QR
    ctx.save(); ctx.translate(sp, sp); drawSpills(ctx, QR, QR, rng, gradient); ctx.restore()

    // Read raw QR pixel data BEFORE compositing with dark background.
    // tmp has transparent light modules (alpha=0) and opaque dark modules (alpha=255).
    // This is the correct way to identify which pixels are QR dark modules.
    const rawCtx  = tmp.getContext('2d')
    const rawData = rawCtx.getImageData(0, 0, QR, QR)
    const d       = rawData.data
    const off     = seed % 1

    for (let y = 0; y < QR; y++) {
      for (let x = 0; x < QR; x++) {
        const i = (y * QR + x) * 4
        if (d[i + 3] > 128) {                 // dark module — apply gradient color
          const cx_ = x / QR - 0.5
          const cy_ = y / QR - 0.5
          const ang  = Math.atan2(cy_, cx_) / (Math.PI * 2) + 0.5
          const dist = Math.sqrt(cx_*cx_ + cy_*cy_) * 2
          const t    = (ang * 0.55 + dist * 0.45 + (x + y) / (QR * 3) + off) % 1
          const [r, g, b] = lerpColor(gradient, t)
          d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = 255
        } else {                               // light module — stay transparent (shows bg)
          d[i+3] = 0
        }
      }
    }

    // Render colored modules onto a temp canvas, then composite onto main
    const coloredQR    = document.createElement('canvas')
    coloredQR.width    = QR
    coloredQR.height   = QR
    coloredQR.getContext('2d').putImageData(rawData, 0, 0)
    ctx.drawImage(coloredQR, sp, sp)

    // Edge glow (screen composite so it doesn't obscure modules)
    const [r0, g0, b0] = lerpColor(gradient, 0)
    const [r1, g1, b1] = lerpColor(gradient, 0.5)
    ctx.save(); ctx.translate(sp, sp)
    const gGrad = ctx.createRadialGradient(QR/2, QR/2, QR*0.3, QR/2, QR/2, QR*0.65)
    gGrad.addColorStop(0,   `rgba(${r0},${g0},${b0},0)`)
    gGrad.addColorStop(0.7, `rgba(${r1},${g1},${b1},0.06)`)
    gGrad.addColorStop(1,   `rgba(${r0},${g0},${b0},0.14)`)
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = gGrad
    ctx.fillRect(-sp, -sp, W, H)
    ctx.globalCompositeOperation = 'source-over'
    ctx.restore()

    // Spill on top (lighter)
    ctx.save(); ctx.translate(sp, sp)
    ctx.globalAlpha = 0.32; drawSpills(ctx, QR, QR, rng, gradient); ctx.globalAlpha = 1
    ctx.restore()

    // Name label BELOW the QR in the extra space — never overlaps modules
    if (name?.trim() && nameH > 0) {
      const txt = name.trim()
      const fs  = Math.min(14, Math.max(9, Math.floor(W / (txt.length * 0.9))))
      ctx.font = `bold ${fs}px 'SF Mono','Fira Code',monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const ty = sp + QR + nameH / 2
      const [cr, cg, cb] = lerpColor(gradient, 0.22)
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`
      ctx.shadowColor = `rgba(${cr},${cg},${cb},0.85)`
      ctx.shadowBlur = 7
      ctx.fillText(txt, W / 2, ty)
      ctx.shadowBlur = 0
    }
  })
}

export function VibeQR({ baseUrl, name: initName, activeSounds, onClose }) {
  const canvasRef = useRef(null)
  const [name, setName]   = useState(initName || '')
  const [copied, setCopied] = useState(false)
  const [seed, setSeed]   = useState(() => Math.random())

  const fullUrl = useMemo(() => {
    const u = new URL(baseUrl)
    if (name.trim()) u.searchParams.set('p', name.trim())
    return u.toString()
  }, [baseUrl, name])

  useEffect(() => {
    if (!canvasRef.current) return
    const glows = (activeSounds || []).map(s => s.glow)
    drawVibeQR(canvasRef.current, fullUrl, name, seed, glows)
  }, [fullUrl, name, seed, activeSounds])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }, [fullUrl])

  const handleSave = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const pad = 24
    const dl = document.createElement('canvas')
    dl.width = c.width + pad*2; dl.height = c.height + pad*2
    const ctx = dl.getContext('2d')
    ctx.fillStyle = '#010206'; ctx.fillRect(0, 0, dl.width, dl.height)
    ctx.drawImage(c, pad, pad)
    const a = document.createElement('a')
    a.download = `vibe${name ? '-' + name.trim().replace(/\s+/g, '-').toLowerCase() : ''}.png`
    a.href = dl.toDataURL('image/png')
    a.click()
  }, [name])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="vqr__overlay" onClick={onClose}>
      <div className="vqr__modal" onClick={e => e.stopPropagation()}>
        <button className="vqr__close" onClick={onClose} aria-label="Close">×</button>
        <button className="vqr__shake" onClick={() => setSeed(Math.random())} title="Restyle">⚡</button>
        <canvas ref={canvasRef} className="vqr__canvas" />
        <input
          className="vqr__name"
          type="text"
          placeholder="name this vibe…"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={36}
          autoFocus
        />
        <div className="vqr__actions">
          <button className="vqr__btn" onClick={handleCopy}>{copied ? 'copied!' : 'copy link'}</button>
          <button className="vqr__btn" onClick={handleSave}>save</button>
        </div>
      </div>
    </div>
  )
}
