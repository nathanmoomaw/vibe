// Global multipliers on top of each element's own baked-in organic-drift
// depth/rate (audio/noise.js's per-color filter-frequency wobble, and
// audio/tones.js's shared wobble() helper used by wind/water/fire/earth).
// Read by those modules at chain-build time — a change here takes effect
// the next time a sound (re)starts, not live on whatever's already playing.
let depthMult = 1
let rateMult = 1

export function getDriftDepthMult() { return depthMult }
export function getDriftRateMult() { return rateMult }

export function setDriftDepthMult(v) { depthMult = Math.max(0, Math.min(2, v)) }
export function setDriftRateMult(v) { rateMult = Math.max(0, Math.min(2, v)) }
