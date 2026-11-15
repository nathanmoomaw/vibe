import test from 'node:test'
import assert from 'node:assert/strict'
import { eclipticLon, PLANETS } from '../src/utils/planets.js'

function angDiff(a, b) {
  return ((((a - b) % 360) + 540) % 360) - 180
}

const TOL = { Sun: 0.05, Moon: 0.75 }   // degrees; every planet 0.15
const tolFor = (name) => TOL[name] ?? 0.15

const REFERENCE_CASES = [
  {
    iso: '2026-11-14T12:00:00Z',
    bodies: {
      Sun: 232.129, Moon: 289.497, Mercury: 215.096, Venus: 202.871,
      Mars: 145.100, Jupiter: 145.742, Saturn: 8.551, Uranus: 64.152, Neptune: 1.839,
    },
  },
  {
    iso: '1985-03-21T06:00:00Z',
    bodies: {
      Sun: 0.569, Moon: 357.324, Mercury: 17.827, Venus: 21.133,
      Mars: 34.380, Jupiter: 309.009, Saturn: 237.970, Uranus: 257.986, Neptune: 273.557,
    },
  },
  {
    iso: '2040-01-01T00:00:00Z',
    bodies: {
      Moon: 116.787, Mercury: 277.741, Venus: 243.745, Mars: 102.494, Saturn: 191.656,
    },
  },
]

for (const { iso, bodies } of REFERENCE_CASES) {
  test(`Wolfram|Alpha reference positions at ${iso}`, () => {
    const date = new Date(iso)
    for (const [name, expected] of Object.entries(bodies)) {
      const actual = eclipticLon(name, date)
      const diff = Math.abs(angDiff(actual, expected))
      const tol = tolFor(name)
      assert.ok(
        diff <= tol,
        `${name} at ${iso}: expected ${expected}°, got ${actual.toFixed(4)}° (diff ${diff.toFixed(4)}° > ${tol}°)`
      )
    }
  })
}

// Deterministic 2000 dates via LCG (seed 12345) between 1900-01-01 and 2050-01-01 UTC (the JPL table is valid 1800-2050)
const T_START = Date.UTC(1900, 0, 1)
const T_SPAN = Date.UTC(2050, 0, 1) - T_START
const SAMPLE_DATES = []
let state = 12345
for (let i = 0; i < 2000; i++) {
  state = (state * 1664525 + 1013904223) >>> 0
  const frac = state / 0x100000000
  SAMPLE_DATES.push(new Date(T_START + Math.floor(frac * T_SPAN)))
}

test('all planets return finite longitudes in [0, 360) across 2000 dates', () => {
  for (const date of SAMPLE_DATES) {
    for (const { name } of PLANETS) {
      const lon = eclipticLon(name, date)
      assert.ok(
        Number.isFinite(lon) && lon >= 0 && lon < 360,
        `${name} out of range at ${date.toISOString()}: ${lon}`
      )
    }
  }
})

test('Mercury and Venus stay within maximum solar elongation across 2000 dates', () => {
  for (const date of SAMPLE_DATES) {
    const sun = eclipticLon('Sun', date)
    const mercuryElong = Math.abs(angDiff(eclipticLon('Mercury', date), sun))
    const venusElong = Math.abs(angDiff(eclipticLon('Venus', date), sun))
    assert.ok(mercuryElong <= 28.5, `Mercury elongation ${mercuryElong.toFixed(2)}° > 28.5° at ${date.toISOString()}`)
    assert.ok(venusElong <= 47.5, `Venus elongation ${venusElong.toFixed(2)}° > 47.5° at ${date.toISOString()}`)
  }
})

test('hourly longitude step is continuous for all bodies across 2000 dates', () => {
  for (const date of SAMPLE_DATES) {
    const nextHour = new Date(date.getTime() + 3600000)
    for (const { name } of PLANETS) {
      const step = Math.abs(angDiff(eclipticLon(name, nextHour), eclipticLon(name, date)))
      const limit = name === 'Moon' ? 0.8 : 0.1
      assert.ok(step < limit, `${name} 1h step ${step.toFixed(4)}° >= ${limit}° at ${date.toISOString()}`)
    }
  }
})

test('Sun advances between 0.95 and 1.03 degrees per day across 2000 dates', () => {
  for (const date of SAMPLE_DATES) {
    const nextDay = new Date(date.getTime() + 86400000)
    const step = angDiff(eclipticLon('Sun', nextDay), eclipticLon('Sun', date))
    assert.ok(
      step >= 0.95 && step <= 1.03,
      `Sun daily advance ${step.toFixed(4)}° outside [0.95°, 1.03°] at ${date.toISOString()}`
    )
  }
})
