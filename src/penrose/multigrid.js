// Multigrid tilings (de Bruijn's method, generalised to any star of directions).
//
// N families of parallel lines; family k runs perpendicular to direction
// e_k (angle θ_k), line n of family k at  x·e_k + γ_k = n. Every crossing of
// a family-r line with a family-s line becomes one rhombus with sides e_r and
// e_s; its corners are lattice points K (one integer per family) projected
// down: P(K) = Σ K_j e_j. Five evenly spaced directions with Σγ = 0 give
// Penrose's tiling; anything else gives a different non-repeating rhombus
// tiling. We never use that case: the evenly spaced stars use offsets whose
// sum isn't 0, and the default star comes from the sky (planet longitudes).
//
// Drifting γ makes tiles flip in place ("phason flips") while the tiling
// stays valid; that's what the app animates and plays.

import { PLANETS, eclipticLon } from '../utils/planets.js'

const TAU = Math.PI * 2
const MIN_SEP = (9 * Math.PI) / 180   // families closer than this make slivers

// A star: directions + helpers derived from them
export function makeStar(id, angles, labels) {
  const n = angles.length
  const E = angles.map(a => [Math.cos(a), Math.sin(a)])
  // "hidden" push directions: doubled angles (for the evenly spaced stars
  // these sum to zero, like de Bruijn's perpendicular space)
  const P = angles.map(a => [Math.cos(2 * a), Math.sin(2 * a)])
  // how open each pair's rhomb is: 0 = sliver, 1 = square
  const open = angles.map(a => angles.map(b => Math.abs(Math.sin(a - b))))
  return { id, n, angles, E, P, open, labels }
}

export function regularStar(n) {
  return makeStar(String(n), Array.from({ length: n }, (_, k) => (Math.PI * k) / n * (n % 2 ? 2 : 1)))
}

// Directions from where the planets are in the sky right now. A line family
// is the same for θ and θ+180°, so fold longitudes onto a half turn, then
// drop any that sit too close to one already taken (it would only make
// slivers).
export function skyStar(date = new Date()) {
  const picks = []
  for (const p of PLANETS) {
    const a = ((eclipticLon(p.name, date) * Math.PI) / 180) % Math.PI
    const aa = a < 0 ? a + Math.PI : a
    const near = picks.some(q => {
      const d = Math.abs(q.a - aa) % Math.PI
      return Math.min(d, Math.PI - d) < MIN_SEP
    })
    if (!near) picks.push({ a: aa, name: p.name, symbol: p.symbol })
  }
  return makeStar('sky', picks.map(p => p.a), picks.map(p => p.symbol))
}

export const STAR_IDS = ['sky', '5', '7', '8']
export const starById = (id) => (id === 'sky' ? skyStar() : regularStar(Number(id)))

// Base offsets: spread, deliberately not summing to 0
export const baseGamma = (n) => Array.from({ length: n }, (_, k) => ((k * 0.618034 + 0.31) % 1) - 0.5)

// Rhombi whose crossing lies within `radius` (tiling units) of the origin.
// Returns flat records { r, s, pts: [x0,y0,x1,y1,x2,y2,x3,y3], cx, cy }.
export function rhombi(star, gamma, radius) {
  const { n, E } = star
  const out = []
  // tiling coords ≈ (n/2) × grid coords
  const gr = radius / (n / 2) + 1
  for (let r = 0; r < n; r++) for (let s = r + 1; s < n; s++) {
    const [ar, br] = E[r], [as, bs] = E[s]
    const det = ar * bs - br * as
    if (Math.abs(det) < 1e-6) continue
    const nrLo = Math.floor(-gr + gamma[r]), nrHi = Math.ceil(gr + gamma[r])
    const nsLo = Math.floor(-gr + gamma[s]), nsHi = Math.ceil(gr + gamma[s])
    for (let nr = nrLo; nr <= nrHi; nr++) for (let ns = nsLo; ns <= nsHi; ns++) {
      const u = nr - gamma[r], v = ns - gamma[s]
      const zx = (u * bs - v * br) / det
      const zy = (v * ar - u * as) / det
      if (zx * zx + zy * zy > gr * gr) continue
      let bx = 0, by = 0
      for (let j = 0; j < n; j++) {
        const kj = j === r ? nr : j === s ? ns : Math.ceil(zx * E[j][0] + zy * E[j][1] + gamma[j])
        bx += kj * E[j][0]
        by += kj * E[j][1]
      }
      const [erx, ery] = E[r], [esx, esy] = E[s]
      out.push({
        r, s,
        pts: [bx, by, bx + erx, by + ery, bx + erx + esx, by + ery + esy, bx + esx, by + esy],
        cx: bx + (erx + esx) / 2, cy: by + (ery + esy) / 2,
      })
    }
  }
  return out
}

// Is point (x, y) inside the rhomb? (convex quad, either winding)
export function inRhomb(pts, x, y) {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const x0 = pts[i * 2], y0 = pts[i * 2 + 1]
    const x1 = pts[((i + 1) % 4) * 2], y1 = pts[((i + 1) % 4) * 2 + 1]
    const c = (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0)
    if (c !== 0) { if (sign === 0) sign = Math.sign(c); else if (Math.sign(c) !== sign) return false }
  }
  return true
}

export { TAU }
