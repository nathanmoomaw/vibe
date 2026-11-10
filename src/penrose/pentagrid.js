// de Bruijn (1981) pentagrid → Penrose rhombus tiling.
//
// Five families of parallel lines, family k perpendicular to e_k (angle 72°·k),
// line n of family k at  x·e_k + γ_k = n.  Every crossing of a family-r line
// with a family-s line becomes one rhombus. Its corners are the 5-D lattice
// points K (one integer per family) of the four grid cells meeting there,
// projected down: P(K) = Σ K_j e_j. That's the same tiling as a slice of the
// 5-D cubic lattice cut by a plane; the offsets γ choose where the plane sits.
// With Σγ = 0 it's a true Penrose tiling for any γ, so drifting γ (keeping
// the sum at 0) walks the slice through the hidden 3 dimensions and tiles
// flip in place ("phason flips") while the pattern stays Penrose.

export const E = Array.from({ length: 5 }, (_, k) => {
  const a = (2 * Math.PI * k) / 5
  return [Math.cos(a), Math.sin(a)]
})

// Direction in the hidden ("perpendicular") space for family k: doubled
// angles. Σ over k of these is zero, so a push along them keeps Σγ = 0.
export const E_PERP = Array.from({ length: 5 }, (_, k) => {
  const a = (4 * Math.PI * k) / 5
  return [Math.cos(a), Math.sin(a)]
})

// Thick (72°) rhombs come from neighbouring families, thin (36°) from
// families two apart.
export const isThick = (r, s) => { const d = s - r; return d === 1 || d === 4 }

// Rhombi whose crossing lies within `radius` (tiling units) of the origin.
// Returns flat records { r, s, pts: [x0,y0,x1,y1,x2,y2,x3,y3], cx, cy }.
export function rhombi(gamma, radius) {
  const out = []
  // tiling coords ≈ 2.5 × grid coords, so grid crossings within radius/2.5
  const gr = radius / 2.5 + 1
  for (let r = 0; r < 5; r++) for (let s = r + 1; s < 5; s++) {
    const [ar, br] = E[r], [as, bs] = E[s]
    const det = ar * bs - br * as
    const nrLo = Math.floor(-gr + gamma[r]), nrHi = Math.ceil(gr + gamma[r])
    const nsLo = Math.floor(-gr + gamma[s]), nsHi = Math.ceil(gr + gamma[s])
    for (let nr = nrLo; nr <= nrHi; nr++) for (let ns = nsLo; ns <= nsHi; ns++) {
      // solve z·e_r = nr − γ_r, z·e_s = ns − γ_s
      const u = nr - gamma[r], v = ns - gamma[s]
      const zx = (u * bs - v * br) / det
      const zy = (v * ar - u * as) / det
      if (zx * zx + zy * zy > gr * gr) continue
      // base lattice point: other families take the cell the crossing is in
      let bx = 0, by = 0
      for (let j = 0; j < 5; j++) {
        const kj = j === r ? nr : j === s ? ns : Math.ceil(zx * E[j][0] + zy * E[j][1] + gamma[j])
        bx += kj * E[j][0]
        by += kj * E[j][1]
      }
      const [erx, ery] = E[r], [esx, esy] = E[s]
      const pts = [
        bx, by,
        bx + erx, by + ery,
        bx + erx + esx, by + ery + esy,
        bx + esx, by + esy,
      ]
      out.push({ r, s, pts, cx: bx + (erx + esx) / 2, cy: by + (ery + esy) / 2 })
    }
  }
  return out
}
