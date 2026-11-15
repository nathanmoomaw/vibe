import test from 'node:test'
import assert from 'node:assert/strict'
import {
  regularStar,
  skyStar,
  baseGamma,
  rhombi,
  inRhomb,
} from '../src/penrose/multigrid.js'

const covered = (tiles, x, y) => {
  let c = 0
  for (const t of tiles) if (inRhomb(t.pts, x, y)) c++
  return c
}

const samplePoints = (radius, cx = 0, cy = 0) => {
  const pts = []
  for (const f of [0.3, 0.6, 0.9]) {
    const r = radius * f
    for (let deg = 0; deg <= 355; deg += 5) {
      const a = (deg * Math.PI) / 180
      // tiny irrational offset: a point exactly on a tile edge is rejected by
      // both neighbours through float rounding, which isn't a gap
      pts.push([cx + r * Math.cos(a) + 1e-3 * Math.SQRT2, cy + r * Math.sin(a) + 1e-3 * Math.SQRT1_2])
    }
  }
  return pts
}

test('regular and sky stars cover the disk with no gaps and no overlaps around origin and panned centre', () => {
  const stars = [
    regularStar(5),
    regularStar(7),
    regularStar(8),
    skyStar(new Date('2026-11-14T12:00:00Z')),
    skyStar(new Date('1990-01-24T12:00:00Z')),
  ]
  const radius = 20
  for (const star of stars) {
    const g = baseGamma(star.n)
    for (const [cx, cy] of [[0, 0], [37.3, -12.9]]) {
      const tiles = rhombi(star, g, radius, cx, cy)
      for (const [x, y] of samplePoints(radius, cx, cy)) {
        assert.equal(covered(tiles, x, y), 1, `star ${star.id} at (${x}, ${y}) around (${cx}, ${cy})`)
      }
    }
  }
})

test('panning keeps tiles in place across overlapping views', () => {
  const star = regularStar(7)
  const g = baseGamma(star.n)
  const key = (t) => `${t.r},${t.s}:${Math.round(t.pts[0] * 1e4)},${Math.round(t.pts[1] * 1e4)}`
  const firstKeys = new Set(rhombi(star, g, 20, 0, 0).map(key))
  const second = rhombi(star, g, 20, 3, 1)
  let checked = 0
  for (const t of second) {
    if (Math.hypot(t.cx - 1.5, t.cy - 0.5) <= 10) {
      assert.ok(firstKeys.has(key(t)), `missing tile ${key(t)}`)
      checked++
    }
  }
  assert.ok(checked > 0)
})

test('smallest eigenvalue matches reference values', () => {
  const sky = skyStar(new Date('2026-11-14T12:00:00Z'))
  assert.ok(Math.abs(sky.lmin - 2.375900) < 1e-4, `sky lmin=${sky.lmin}`)
  for (const n of [5, 7, 8]) {
    const s = regularStar(n)
    assert.ok(Math.abs(s.lmin - n / 2) < 1e-9, `regular(${n}) lmin=${s.lmin}`)
  }
})

test('sky stars are well conditioned across a century', () => {
  const validLabels = new Set(['☉', '☽', '☿', '♀', '♂', '♃', '♄', '♅', '♆', '·'])
  const start = Date.UTC(1950, 0, 1)
  const end = Date.UTC(2050, 0, 1)
  const step = 5 * 86400 * 1000
  for (let t = start; t <= end; t += step) {
    const star = skyStar(new Date(t))
    assert.ok(star.lmin >= 1.1, `lmin=${star.lmin} at ${new Date(t).toISOString()}`)
    assert.ok(star.n <= 10, `n=${star.n}`)
    for (const label of star.labels) {
      assert.ok(validLabels.has(label), `unexpected label ${label}`)
    }
  }
})

test('five direction star offsets never sum near an integer', () => {
  const sum = baseGamma(5).reduce((a, b) => a + b, 0)
  const distToInt = Math.abs(sum - Math.round(sum))
  assert.ok(distToInt >= 0.05, `sum=${sum}, dist=${distToInt}`)
})

test('cost guard on tightly bunched 1990 sky', () => {
  const star = skyStar(new Date('1990-01-24T12:00:00Z'))
  const tiles = rhombi(star, baseGamma(star.n), 20)
  assert.ok(tiles.length < 4000, `too many tiles: ${tiles.length}`)
})
