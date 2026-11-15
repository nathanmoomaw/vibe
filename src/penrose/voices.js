// Tiling voices: each line family is one note of a just-tuned pentatonic
// scale (families past the fifth wrap into the octave below, then above).
// Each family has a soft pad that swells with its drift, and a soft bell on
// its note (two octaves up) that strikes when that family's tiles flip.
// Every note is in the same pentatonic, so any mix of them is consonant:
// nothing the tiling does can play a wrong note.
import { getContext, getMaster } from '../audio/engine.js'

let ctx = null
let out = null        // volume (pre-master)
let bus = null        // pads + bells → out
let send = null       // → reverb
let wet = null        // reverb return
let pads = []         // [{ oscs, filter, gain }]
let mood = null
let notes = []
let keyRatio = 1    // 1 = home key, 3/2 = a fifth up (slow key glides)
let muted = []
let lastStrike = []
let strikeTimes = []  // recent strikes (ctx time), for the rate cap

const OCTAVE = [1, 0.5, 2]   // family k → octave of its scale degree
const noteFor = (m, k) => m.root * keyRatio * m.scale[k % 5] * OCTAVE[Math.floor(k / 5) % 3]

function makeImpulse(sec, decay) {
  const len = Math.round(ctx.sampleRate * sec)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

function makePad(f, cutoff, at) {
  const gain = ctx.createGain()
  gain.gain.value = 0
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  filter.Q.value = 0.3
  filter.connect(gain)
  gain.connect(bus)
  // a sine, a slightly detuned triangle (slow beating = gentle motion),
  // and a quiet octave for air
  const oscs = [['sine', 1, 1, 0.55], ['triangle', 1, 1.0035, 0.3], ['sine', 2, 1, 0.08]].map(([type, mult, det, lvl]) => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = f * mult * det
    const g = ctx.createGain()
    g.gain.value = lvl
    o.connect(g)
    g.connect(filter)
    o.start(at)
    return { o, mult, det }
  })
  return { oscs, filter, gain }
}

function dropPad(p, sec) {
  const now = ctx.currentTime
  p.gain.gain.cancelScheduledValues(now)
  p.gain.gain.setTargetAtTime(0, now, sec / 4)
  p.oscs.forEach(({ o }) => o.stop(now + sec + 0.1))
  setTimeout(() => p.gain.disconnect(), (sec + 0.3) * 1000)
}

// (Re)build one pad per family; old pads fade out as the new ones swell in
function buildPads(n) {
  pads.forEach(p => dropPad(p, 1.5))
  const now = ctx.currentTime
  notes = Array.from({ length: n }, (_, k) => noteFor(mood, k))
  pads = notes.map(f => makePad(f, mood.cutoff, now))
  muted = Array.from({ length: n }, (_, k) => muted[k] ?? false)
  lastStrike = Array(n).fill(0)
}

export function startVoices(m, volume, n) {
  if (out) return
  ctx = getContext()
  mood = m
  const now = ctx.currentTime
  out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, now)
  out.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 2.5)
  out.connect(getMaster())

  bus = ctx.createGain()
  bus.connect(out)
  const verb = ctx.createConvolver()
  verb.buffer = makeImpulse(4, 2.6)
  send = ctx.createGain()
  wet = ctx.createGain()
  bus.connect(send)
  send.connect(verb)
  verb.connect(wet)
  wet.connect(out)

  buildPads(n)
  setMood(m, 0)
}

export function setFamilies(n) {
  if (!out || n === pads.length) return
  buildPads(n)
}

// Glide every pad to the new mood's notes and tone colour
export function setMood(m, glideSec = 1.2) {
  mood = m
  if (!out) return
  const now = ctx.currentTime
  const tc = Math.max(0.01, glideSec / 3)
  notes = pads.map((_, k) => noteFor(m, k))
  pads.forEach((p, k) => {
    p.oscs.forEach(({ o, mult, det }) => o.frequency.setTargetAtTime(notes[k] * mult * det, now, tc))
    p.filter.frequency.setTargetAtTime(m.cutoff, now, tc)
  })
  send.gain.setTargetAtTime(m.wet, now, tc)
  wet.gain.setTargetAtTime(1, now, tc)
  bus.gain.setTargetAtTime(1 - m.wet * 0.4, now, tc)
}

export function setMuted(k, on) { muted[k] = on }

// levels: 0..1 per family (its drift swell)
export function setPads(levels) {
  if (!out) return
  const now = ctx.currentTime
  // more families → each a little quieter, so the sum stays even
  const share = Math.sqrt(5 / Math.max(5, pads.length))
  pads.forEach((p, k) => {
    const l = muted[k] ? 0 : levels[k] ?? 0
    p.gain.gain.setTargetAtTime(mood.pad * share * (muted[k] ? 0 : 0.04 + 0.96 * l * l) * 0.3, now, 0.6)
  })
}

export function setVolume(v) {
  if (!out) return
  out.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, 0.08)
}

// A soft bell on family k's note. vel 0..1, pan -1..1. `force` (a tap)
// skips the rate cap. Returns false when muted or capped.
// The mode note just above or below f (same octave register), from the
// current key (keyRatio moves the whole mode when the key glides)
function passingNote(f) {
  const base = mood.root * keyRatio
  const cands = []
  for (const oct of [1, 2, 4, 8]) for (const r of mood.mode) cands.push(base * r * oct)
  const above = cands.filter(c => c > f * 1.01).sort((a, b) => a - b)[0]
  const below = cands.filter(c => c < f * 0.99).sort((a, b) => b - a)[0]
  const pick = Math.random() < 0.5 ? above ?? below : below ?? above
  return pick ?? f
}

export function strike(k, vel, pan = 0, force = false) {
  if (!out || muted[k] || notes[k] === undefined) return false
  const now = ctx.currentTime
  strikeTimes = strikeTimes.filter(t => now - t < 1)
  if (!force && (strikeTimes.length >= mood.maxRate || now - lastStrike[k] < 0.22)) return false
  strikeTimes.push(now)
  lastStrike[k] = now

  // Sometimes ring a neighbouring note of the mood's 7-note mode instead (a
  // semitone or tone away): a passing note, gone before it can clash
  let f = notes[k] * 4
  if (!force && Math.random() < (mood.color ?? 0)) f = passingNote(f)
  const v = 0.09 + 0.22 * Math.min(1, vel)
  const car = ctx.createOscillator()
  const mod = ctx.createOscillator()
  const modGain = ctx.createGain()
  const env = ctx.createGain()
  const panner = ctx.createStereoPanner()
  car.type = 'sine'
  car.frequency.value = f
  // harmonic modulator (×2) with a fast-decaying index: a bright touch at the
  // start that melts into a pure tone, no clang
  mod.type = 'sine'
  mod.frequency.value = f * 2
  modGain.gain.setValueAtTime(f * 0.9, now)
  modGain.gain.exponentialRampToValueAtTime(f * 0.02, now + 0.6)
  env.gain.setValueAtTime(0.0001, now)
  env.gain.linearRampToValueAtTime(v, now + 0.006)
  env.gain.exponentialRampToValueAtTime(0.0001, now + 3.2)
  panner.pan.value = Math.max(-1, Math.min(1, pan)) * 0.7
  mod.connect(modGain)
  modGain.connect(car.frequency)
  car.connect(env)
  env.connect(panner)
  panner.connect(bus)
  mod.start(now); car.start(now)
  mod.stop(now + 3.4); car.stop(now + 3.4)
  car.onended = () => panner.disconnect()
  return true
}

export function stopVoices(fadeSec = 1.2) {
  if (!out) return
  const o = out, c = ctx
  const now = c.currentTime
  o.gain.cancelScheduledValues(now)
  o.gain.setValueAtTime(Math.max(0.0001, o.gain.value), now)
  o.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec)
  pads.forEach(p => p.oscs.forEach(({ o: osc }) => osc.stop(now + fadeSec + 0.1)))
  setTimeout(() => o.disconnect(), (fadeSec + 0.3) * 1000)
  out = null; pads = []; strikeTimes = []
}

// Glide the whole key (pads now, bells from here on) to `ratio` × the mood's
// root, slowly so it reads as the harmony moving, not a jump
export function setKey(ratio, glideSec = 8) {
  keyRatio = ratio
  if (out && mood) setMood(mood, glideSec)
}
