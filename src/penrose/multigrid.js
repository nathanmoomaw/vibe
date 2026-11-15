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
  // A grid point z lands near tile point M·z, M = Σ e_k e_kᵀ. Evenly spaced
  // stars have M = (n/2)·I; uneven ones (sky, natal) stretch more one way
  // than the other, so coverage needs the smallest eigenvalue, and panning
  // needs M⁻¹ to find the grid point under a tile-space centre.
  let a = 0, b = 0, c = 0
  for (const [x, y] of E) { a += x * x; b += x * y; c += y * y }
  const det = a * c - b * b
  const lmin = (a + c) / 2 - Math.sqrt(((a - c) / 2) ** 2 + b * b)
  const Minv = [c / det, -b / det, a / det]   // symmetric: [xx, xy, yy]
  // A tile sits at M·z + Σγe plus Σ(fraction_j)·e_j, |that| ≤ √(n·λmax);
  // in grid units that's the search margin rhombi() needs
  const lmax = a + c - lmin
  const margin = Math.sqrt(n * lmax) / lmin + 1
  return { id, n, angles, E, P, open, labels, lmin, Minv, margin }
}

export function regularStar(n) {
  return makeStar(String(n), Array.from({ length: n }, (_, k) => (Math.PI * k) / n * (n % 2 ? 2 : 1)))
}

// Directions from where the planets are in the sky right now. A line family
// is the same for θ and θ+180°, so fold longitudes onto a half turn, then
// drop any that sit too close to one already taken (it would only make
// slivers).
export function skyStar(date = new Date(), id = 'sky') {
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
  // Planets can bunch up (1990-01-24: three lines within 34°), which makes
  // slivers and a huge grid to search. Fill any gap over 75° with a quiet
  // extra line ('·') at its middle, so every sky tiles well.
  const MAX_GAP = Math.PI / 2.4
  for (;;) {
    const sorted = [...picks].sort((p, q) => p.a - q.a)
    let gap = 0, at = 0
    sorted.forEach((p, i) => {
      const next = i + 1 < sorted.length ? sorted[i + 1].a : sorted[0].a + Math.PI
      if (next - p.a > gap) { gap = next - p.a; at = p.a }
    })
    if (gap <= MAX_GAP) break
    picks.push({ a: (at + gap / 2) % Math.PI, name: 'fill', symbol: '·' })
  }
  return makeStar(id, picks.map(p => p.a), picks.map(p => p.symbol))
}

// 'natal' = the sky at a birth moment (ISO UTC string, kept in the viewer's
// browser only, never in the code); the person's own tiling
export const STAR_IDS = ['sky', '5', '7', '8', 'natal']
export const starById = (id, born) =>
  id === 'sky' ? skyStar()
    : id === 'natal' ? (born ? skyStar(new Date(born), 'natal') : null)
      : regularStar(Number(id))

// Base offsets: spread, deliberately not summing to 0
export const baseGamma = (n) => Array.from({ length: n }, (_, k) => ((k * 0.618034 + 0.31) % 1) - 0.5)

// Rhombi whose centre lies within `radius` (tiling units) of (cx0, cy0).
// Tiles keep their place in the plane, so panning the centre slides the same
// tiles across rather than making new ones.
// Returns flat records { r, s, pts: [x0,y0,x1,y1,x2,y2,x3,y3], cx, cy }.
export function rhombi(star, gamma, radius, cx0 = 0, cy0 = 0) {
  const { n, E, lmin, Minv, margin } = star
  const out = []
  // grid point under the centre: tile point ≈ M·z + Σ γ_j e_j
  let ox = cx0, oy = cy0
  for (let j = 0; j < n; j++) { ox -= gamma[j] * E[j][0]; oy -= gamma[j] * E[j][1] }
  const z0x = Minv[0] * ox + Minv[1] * oy, z0y = Minv[1] * ox + Minv[2] * oy
  // a grid circle of this radius covers the tile circle in every direction
  const gr = radius / lmin + margin
  const r2 = radius * radius
  for (let r = 0; r < n; r++) for (let s = r + 1; s < n; s++) {
    const [ar, br] = E[r], [as, bs] = E[s]
    const det = ar * bs - br * as
    if (Math.abs(det) < 1e-6) continue
    const pr = z0x * ar + z0y * br + gamma[r], ps = z0x * as + z0y * bs + gamma[s]
    const nrLo = Math.floor(pr - gr), nrHi = Math.ceil(pr + gr)
    const nsLo = Math.floor(ps - gr), nsHi = Math.ceil(ps + gr)
    for (let nr = nrLo; nr <= nrHi; nr++) for (let ns = nsLo; ns <= nsHi; ns++) {
      const u = nr - gamma[r], v = ns - gamma[s]
      const zx = (u * bs - v * br) / det
      const zy = (v * ar - u * as) / det
      if ((zx - z0x) ** 2 + (zy - z0y) ** 2 > gr * gr) continue
      let bx = 0, by = 0
      for (let j = 0; j < n; j++) {
        const kj = j === r ? nr : j === s ? ns : Math.ceil(zx * E[j][0] + zy * E[j][1] + gamma[j])
        bx += kj * E[j][0]
        by += kj * E[j][1]
      }
      const [erx, ery] = E[r], [esx, esy] = E[s]
      const cx = bx + (erx + esx) / 2, cy = by + (ery + esy) / 2
      if ((cx - cx0) ** 2 + (cy - cy0) ** 2 > r2) continue
      out.push({
        r, s,
        pts: [bx, by, bx + erx, by + ery, bx + erx + esx, by + ery + esy, bx + esx, by + esy],
        cx, cy,
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
