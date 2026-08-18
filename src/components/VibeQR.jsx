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

// Word-wrap `text` to fit `maxWidth` at the given font, same greedy
// algorithm regardless of caller — used to lay the name out across as many
// lines as it needs rather than guessing a fixed split point.
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur); cur = w
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

export function drawVibeQR(canvas, url, name, seed = 0, activeGlows = []) {
  const QR      = 260
  const sp      = 22
  const W       = QR + sp * 2
  const H       = QR + sp * 2

  canvas.width  = W
  canvas.height = H

  const gradient = activeGlows.length >= 2
    ? gradientFromGlows(activeGlows)
    : DEFAULT_GRADIENT

  const tmp = document.createElement('canvas')
  // 'M' (~15% recovery) normally — bumped to 'Q' (~25%) only when a name is
  // set, since that's what gives the center text plate below enough
  // redundancy budget to survive covering part of the code. 'H' (~30%) was
  // tried first but broke jsQR decoding outright for very short payloads
  // (empirically, independent of the plate) — 'Q' didn't have that problem.
  QRCode.toCanvas(tmp, url, {
    width: QR, margin: 2,
    color: { dark: '#000000', light: '#00000000' },
    errorCorrectionLevel: name?.trim() ? 'Q' : 'M',
  }, () => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#010206'
    ctx.fillRect(0, 0, W, H)

    const rng = mulberry32(hashStr(url) ^ Math.floor(seed * 0x7fffffff))

    // Spill streaks clipped to QR boundary — no bleed outside
    ctx.save()
    ctx.translate(sp, sp)
    ctx.beginPath(); ctx.rect(0, 0, QR, QR); ctx.clip()
    drawSpills(ctx, QR, QR, rng, gradient)
    ctx.restore()

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

    // Name, written INTO the code as a captcha-style watermark over its
    // center — module-diced text (tinting only already-dark pixels) turned
    // out illegible at typical module density, so instead this covers a
    // bounded center region entirely — the same "logo in the middle of a QR"
    // technique every QR-logo generator uses, which is why error correction
    // can absorb it losslessly, PROVIDED the covered area stays small.
    // Empirically (via jsQR against this exact renderer) even ~20% coverage
    // at level M failed to decode outright — 'Q' above buys headroom, and
    // this shrinks the text until its footprint is comfortably under ~6% of
    // the code's area before settling, rather than trusting a guessed size.
    // No veil, no plate, no border — the letters sit directly on the
    // pattern, legible only via their own glow/shadow and gradient color
    // contrast. Each character gets its own random rotation/scale/skew/
    // baseline wobble for a recaptcha-ish squiggle, pushed a notch past
    // puddle's own PresetQR distortion per request ("distort a bit more").
    if (name?.trim()) {
      const text = name.trim()
      ctx.save()
      ctx.translate(sp, sp)

      const AREA_BUDGET = QR * QR * 0.06
      const maxTextWidth = QR * 0.6
      let fs = 26
      let lines = [], plateW = 0, plateH = 0
      while (fs >= 8) {
        ctx.font = `800 ${fs}px 'SF Mono','Fira Code',monospace`
        lines = wrapLines(ctx, text, maxTextWidth)
        const lineH  = fs * 1.2
        const widest = Math.max(...lines.map(l => ctx.measureText(l).width))
        plateW = Math.min(maxTextWidth + fs * 1.2, widest + fs * 1.2)
        plateH = lineH * lines.length + fs * 0.7
        if (plateW * plateH <= AREA_BUDGET) break
        fs -= 1
      }
      ctx.font = `800 ${fs}px 'SF Mono','Fira Code',monospace`
      const lineH = fs * 1.2
      const px = (QR - plateW) / 2
      const py = (QR - plateH) / 2
      const cx2 = QR / 2

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      lines.forEach((line, li) => {
        const ty = py + fs * 0.85 + li * lineH
        const chars = [...line]
        const charWidths = chars.map(c => ctx.measureText(c).width)
        const totalW = charWidths.reduce((a, b) => a + b, 0)
        const waveAmp  = 2.5 + rng() * 3.5
        const waveFreq = 0.7 + rng() * 0.8
        const wavePhase = rng() * Math.PI * 2
        let x = cx2 - totalW / 2
        for (let ci = 0; ci < chars.length; ci++) {
          const w = charWidths[ci]
          const cxChar = x + w / 2
          const waveY = Math.sin(wavePhase + ((cxChar - cx2) / plateW) * Math.PI * 2 * waveFreq) * waveAmp
          const angle  = (rng() - 0.5) * 0.2    // ±~11° — a notch past puddle's own ±~12°... close, but still legible
          const scaleX = 0.88 + rng() * 0.2
          const scaleY = 0.88 + rng() * 0.18
          const skewX  = (rng() - 0.5) * 0.16
          const [tr, tg, tb] = lerpColor(gradient, lines.length > 1 ? li / (lines.length - 1) : 0.15)

          ctx.save()
          ctx.translate(cxChar, ty + waveY)
          ctx.rotate(angle)
          ctx.transform(scaleX, 0, skewX, scaleY, 0, 0)

          // Dark outline first — with no veil behind the text, glow alone
          // wasn't enough contrast once a glyph landed over a similarly-hued
          // patch of the pattern. A near-black stroke around each glyph's
          // own shape guarantees separation from the background regardless
          // of what color happens to sit behind it, independent of the glow.
          ctx.lineJoin = 'round'
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)'
          ctx.lineWidth = fs * 0.16
          ctx.strokeText(chars[ci], 0, 0)

          ctx.fillStyle = `rgb(${tr},${tg},${tb})`
          ctx.shadowColor = `rgba(${tr},${tg},${tb},0.95)`
          ctx.shadowBlur = 6
          ctx.fillText(chars[ci], 0, 0)
          ctx.restore()

          x += w
        }
      })
      ctx.shadowBlur = 0
      ctx.restore()
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
