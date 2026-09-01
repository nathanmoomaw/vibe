import { getContext, getMaster } from './engine.js'
import { getDriftDepthMult, getDriftRateMult } from './driftSettings.js'

function whiteBuffer(ctx, sec = 6) {
  const len = Math.floor(ctx.sampleRate * sec)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  return buf
}

function pinkBuffer(ctx, sec = 6) {
  const len = Math.floor(ctx.sampleRate * sec)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886*b0 + w*0.0555179
      b1 = 0.99332*b1 + w*0.0750759
      b2 = 0.96900*b2 + w*0.1538520
      b3 = 0.86650*b3 + w*0.3104856
      b4 = 0.55000*b4 + w*0.5329522
      b5 = -0.7616*b5  - w*0.0168980
      d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11
      b6 = w * 0.115926
    }
  }
  return buf
}

function blueBuffer(ctx, sec = 6) {
  const len = Math.floor(ctx.sampleRate * sec)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let prev = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      d[i] = (w - prev) * 0.5
      prev = w
    }
  }
  return buf
}

// Brown/red — leaky-integrated (random-walk) white noise, -6dB/octave. The
// deep, rumbling counterpart to pink.
function brownBuffer(ctx, sec = 6) {
  const len = Math.floor(ctx.sampleRate * sec)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
  }
  return buf
}

// Violet/purple — double-differenced white noise, +6dB/octave. Sharper and
// brighter than blue (single difference) — the hiss counterpart to white.
function violetBuffer(ctx, sec = 6) {
  const len = Math.floor(ctx.sampleRate * sec)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let p1 = 0, p2 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      const d1 = w - p1; p1 = w
      const d2 = d1 - p2; p2 = d1
      d[i] = d2 * 0.22
    }
  }
  return buf
}

// Grey — same broadband source as white; its perceptually-flat character
// comes from the downstream peaking cut in FILTER_TYPE/FILTER_GAIN below
// (ears are most sensitive ~2-5kHz, so that band gets pulled down).
const greyBuffer = whiteBuffer

const BUFFERS = { white: whiteBuffer, pink: pinkBuffer, blue: blueBuffer, brown: brownBuffer, violet: violetBuffer, grey: greyBuffer }
const FILTER_TYPE = { white: 'allpass', pink: 'lowpass', blue: 'highpass', brown: 'lowpass', violet: 'highpass', grey: 'peaking' }
const FILTER_GAIN = { grey: -7 } // dB — only 'peaking' reads this

// Each primary slot (white/pink/blue) continuously morphs into a paired
// color as its knob turns — see startNoise/setNoiseType.
export const NOISE_PAIR = { white: 'violet', pink: 'brown', blue: 'grey' }

// Base corner frequency per color. Primary three match App.jsx's original
// per-channel defaults (kept identical so existing presets/readings that
// target these Hz values sound the same as before); paired colors get their
// own sensible defaults for their register.
export const FILTER_DEFAULT = { white: 2000, pink: 900, blue: 3500, violet: 4500, brown: 300, grey: 3000 }

// Primary channels' original free-adjustment range, from when the knob
// itself set frequency directly. The knob now morphs color instead, but the
// Wǔ Yīn/OM tuning system (reading.js, presets.js) still targets specific
// Hz values across this full span — e.g. OM at 136.1Hz on pink, which sits
// nowhere near pink's 900Hz default. A percentage-of-default clamp collapses
// every note to the same boundary value; only an absolute range spanning
// each color's original register keeps the notes distinct.
const FILTER_MIN = { white: 200, pink: 100, blue: 500 }
const FILTER_MAX = { white: 8000, pink: 5000, blue: 10000 }

const active = {}

// Organic drift — a slow sine LFO summed onto each color's filter frequency
// (AudioParams sum connected signals with their own .value), so a held
// channel never sits at a perfectly static pitch. Rate is randomized per
// chain so they don't wobble in lockstep. Bounded periodic oscillation, not
// a random walk, so there's no accumulation risk over a long session.
const DRIFT_DEPTH_PCT = 0.035
const DRIFT_RATE_MIN = 0.015
const DRIFT_RATE_RANGE = 0.035

const FADE_IN_SEC = 0.5

// Frequency is no longer a free knob (the knob now morphs color) — but the
// reading/preset system still targets specific Wǔ Yīn/OM Hz values on the
// *primary* color only (readings only ever spoke of "pink"/"white"/"blue",
// never brown/violet/grey). setNoiseFreq clamps that target to the primary
// color's original range and leaves the paired color at its own default —
// "coarse" in that it's no longer a live-draggable knob, not in range.
function primaryFreq(id, tuneHz) {
  if (tuneHz == null) return FILTER_DEFAULT[id]
  return Math.max(FILTER_MIN[id], Math.min(FILTER_MAX[id], tuneHz))
}

// Continuous 2-way crossfade weights — same cosine formula used for the
// elemental trigram morph, so "turn the knob" reads consistently across
// noise and element cards.
function weights(angle) {
  const rad = ((angle % 360) + 360) % 360 * Math.PI / 180
  const t = 0.5 - 0.5 * Math.cos(rad)
  return [1 - t, t] // [primary weight, paired weight]
}

// driftOsc is shared per noise SLOT (see startNoise) rather than built fresh
// per color chain — primary and paired used to each roll their own drift
// oscillator, doubling that node whenever a paired chain was active for zero
// audible benefit (both still get their own depth-scaled driftGain, so each
// chain's wobble stays sized to its own center frequency; only the
// underlying LFO rate is now shared between the two).
function buildColorChain(ctx, colorId, freq, driftOsc) {
  const source = ctx.createBufferSource()
  source.buffer = BUFFERS[colorId](ctx)
  source.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = FILTER_TYPE[colorId]
  filter.frequency.value = freq
  filter.Q.value = 0.7
  if (FILTER_TYPE[colorId] === 'peaking') filter.gain.value = FILTER_GAIN[colorId] ?? 0

  const driftGain = ctx.createGain()
  driftGain.gain.value = freq * DRIFT_DEPTH_PCT * getDriftDepthMult()
  driftOsc.connect(driftGain)
  driftGain.connect(filter.frequency)

  const gain = ctx.createGain() // this color's blend-weight within the pair
  source.connect(filter)
  filter.connect(gain)
  source.start()

  return { colorId, source, filter, driftGain, gain }
}

function stopColorChain(c) {
  try { c.source.stop() } catch (_) {}
  try { c.driftGain.disconnect() } catch (_) {}
  try { c.gain.disconnect() } catch (_) {}
}

// Most channels never have their color knob touched — building the paired
// chain (buffer source + filter + drift oscillator + 2 gains) unconditionally
// silently doubled the always-on audio-graph node count for zero audible
// benefit in that common case. Only build it once the blend weight actually
// crosses this threshold, and leave it running for the rest of the session
// once built (avoids start/stop thrashing right around the threshold).
const PAIRED_WEIGHT_THRESHOLD = 0.02

function ensurePaired(id, initialWeight) {
  const s = active[id]
  if (!s || s.paired) return
  const ctx = getContext()
  s.paired = buildColorChain(ctx, s.pairedId, FILTER_DEFAULT[s.pairedId], s.driftOsc)
  s.paired.gain.gain.value = initialWeight
  s.paired.gain.connect(s.master)
}

export function startNoise(id, volume = 0.5, typeAngle = 0, tuneHz = null) {
  stopNoise(id)
  const ctx = getContext()
  const pairedId = NOISE_PAIR[id]

  const driftOsc = ctx.createOscillator()
  driftOsc.type = 'sine'
  driftOsc.frequency.value = (DRIFT_RATE_MIN + Math.random() * DRIFT_RATE_RANGE) * getDriftRateMult()
  driftOsc.start()

  const primary = buildColorChain(ctx, id, primaryFreq(id, tuneHz), driftOsc)
  const [wp, ws] = weights(typeAngle)
  primary.gain.gain.value = wp

  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(volume, ctx.currentTime + FADE_IN_SEC)
  primary.gain.connect(master)
  master.connect(getMaster())

  active[id] = { primary, paired: null, master, pairedId, driftOsc }
  if (ws > PAIRED_WEIGHT_THRESHOLD) ensurePaired(id, ws)
}

export function stopNoise(id) {
  const s = active[id]
  if (!s) return
  stopColorChain(s.primary)
  if (s.paired) stopColorChain(s.paired)
  try { s.driftOsc.stop() } catch (_) {}
  try { s.master.disconnect() } catch (_) {}
  delete active[id]
}

export function setNoiseVolume(id, v) {
  if (active[id]) active[id].master.gain.value = v
}

// Crossfades between the slot's primary and paired color as the knob turns.
export function setNoiseType(id, angle) {
  const s = active[id]
  if (!s) return
  const [wp, ws] = weights(angle)
  const now = getContext().currentTime
  s.primary.gain.gain.setTargetAtTime(wp, now, 0.06)
  if (!s.paired && ws > PAIRED_WEIGHT_THRESHOLD) ensurePaired(id, 0)
  if (s.paired) s.paired.gain.gain.setTargetAtTime(ws, now, 0.06)
}

// Wǔ Yīn/OM tuning target — targets the primary color only (see primaryFreq
// above); the paired color stays at its own default.
export function setNoiseFreq(id, hz) {
  const s = active[id]
  if (!s) return
  const freq = primaryFreq(id, hz)
  s.primary.filter.frequency.value = freq
  s.primary.driftGain.gain.value = freq * DRIFT_DEPTH_PCT * getDriftDepthMult()
}

// ── LFO ombak pulse (amplitude modulation at binaural beat target Hz) ──────
// Connects a sine oscillator to the noise channel's master gain AudioParam,
// creating a slow amplitude pulse at the given Hz (theta/alpha/delta range).
const lfoNodes = {}

export function setNoisePulse(id, beatHz) {
  const s = active[id]
  if (!s) return
  stopNoisePulse(id)
  const ctx = getContext()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.type = 'sine'
  lfo.frequency.value = beatHz
  lfoGain.gain.value = 0.045  // ±4.5% amplitude modulation depth — was 0.08, read as too "pulsy"
  lfo.connect(lfoGain)
  lfoGain.connect(s.master.gain)
  lfo.start()
  lfoNodes[id] = { lfo, lfoGain }
}

export function stopNoisePulse(id) {
  const n = lfoNodes[id]
  if (!n) return
  try { n.lfo.stop() } catch (_) {}
  try { n.lfoGain.disconnect() } catch (_) {}
  delete lfoNodes[id]
}

export function stopAllNoisePulses() {
  for (const id of Object.keys(lfoNodes)) stopNoisePulse(id)
}
