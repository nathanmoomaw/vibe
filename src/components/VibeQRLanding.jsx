import { useRef, useEffect } from 'react'
import { drawVibeQR } from './VibeQR.jsx'
import './VibeQRLanding.css'

// Shown instead of auto-starting playback when a `?v=` link is opened cold
// (QR scan, pasted link) — a bare page load carries no real user gesture, so
// calling startNoise/startTone there hits a suspended AudioContext and
// silently produces no sound. This re-renders the same QR (content-wise;
// the distortion reseeds) at half strength as a placeholder, and any click
// anywhere on it — the "vibe" button or the backdrop alike — is a genuine
// gesture, so it's what actually starts playback.
export function VibeQRLanding({ url, name, onStart }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    drawVibeQR(canvasRef.current, url, name, Math.random(), [])
  }, [url, name])

  return (
    <div className="vql__overlay" onClick={onStart}>
      <div className="vql__modal">
        <canvas ref={canvasRef} className="vql__canvas" />
        <button className="vql__btn" onClick={onStart}>vibe</button>
      </div>
    </div>
  )
}
