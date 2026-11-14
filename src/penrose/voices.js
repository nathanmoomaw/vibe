// penrose voices: five families, five notes of a pentatonic scale.
// Each family has a soft pad that swells with its drift, and a soft bell on
// the same note (two octaves up) that strikes when that family's tiles flip.
// Every note is in the same just-tuned pentatonic scale, so any mix of them
// is consonant: nothing the tiling does can play a wrong note.
import { getContext, getMaster } from '../audio/engine.js'

let ctx = null
let out = null        // volume (pre-master)
let bus = null        // pads + bells → out
let send = null       // → reverb
let wet = null        // reverb return
let pads = []         // [{ oscs, filter, gain }]
let notes = [0, 0, 0, 0, 0]
let lastStrike = [0, 0, 0, 0, 0]
let strikeTimes = []  // recent strikes (ctx time), for the rate cap
let maxRate = 3       // strikes per second, across all families

function makeImpulse(sec, decay) {
  const len = Math.round(ctx.sampleRate * sec)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

export const isRunning = () => !!out

export function startVoices(mood, volume) {
  if (out) return
  ctx = getContext()
  const now = ctx.currentTime
  out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, now)
  out.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 2.5)
  out.connect(getMaster())

  bus = ctx.createGain()
  bus.gain.value = 1
  bus.connect(out)

  const verb = ctx.createConvolver()
  verb.buffer = makeImpulse(4, 2.6)
  send = ctx.createGain()
  wet = ctx.createGain()
  bus.connect(send)
  send.connect(verb)
  verb.connect(wet)
  wet.connect(out)

  notes = mood.scale.map(r => mood.root * r)
  pads = notes.map((f) => {
    const gain = ctx.createGain()
    gain.gain.value = 0
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = mood.cutoff
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
      o.start(now)
      return { o, mult, det }
    })
    return { oscs, filter, gain }
  })
  setMood(mood, 0)
}

// Glide every pad to the new mood's notes and tone colour
export function setMood(mood, glideSec = 1.2) {
  maxRate = mood.maxRate
  if (!out) return
  const now = ctx.currentTime
  const tc = Math.max(0.01, glideSec / 3)
  notes = mood.scale.map(r => mood.root * r)
  pads.forEach((p, k) => {
    p.oscs.forEach(({ o, mult, det }) => o.frequency.setTargetAtTime(notes[k] * mult * det, now, tc))
    p.filter.frequency.setTargetAtTime(mood.cutoff, now, tc)
  })
  send.gain.setTargetAtTime(mood.wet, now, tc)
  wet.gain.setTargetAtTime(1, now, tc)
  bus.gain.setTargetAtTime(1 - mood.wet * 0.4, now, tc)
}

// levels: 0..1 per family (its drift swell); padLevel: the mood's pad loudness
export function setPads(levels, padLevel) {
  if (!out) return
  const now = ctx.currentTime
  pads.forEach((p, k) => {
    const l = levels[k]
    p.gain.gain.setTargetAtTime(padLevel * (0.04 + 0.96 * l * l) * 0.3, now, 0.6)
  })
}

export function setVolume(v) {
  if (!out) return
  out.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, 0.08)
}

// A soft bell on family k's note. vel 0..1, pan -1..1.
// Returns false when the rate cap or per-family gap swallowed it.
export function strike(k, vel, pan = 0) {
  if (!out) return false
  const now = ctx.currentTime
  strikeTimes = strikeTimes.filter(t => now - t < 1)
  if (strikeTimes.length >= maxRate || now - lastStrike[k] < 0.22) return false
  strikeTimes.push(now)
  lastStrike[k] = now

  const f = notes[k] * 4
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
  const o = out, ps = pads, c = ctx
  const now = c.currentTime
  o.gain.cancelScheduledValues(now)
  o.gain.setValueAtTime(Math.max(0.0001, o.gain.value), now)
  o.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec)
  ps.forEach(p => p.oscs.forEach(({ o: osc }) => osc.stop(now + fadeSec + 0.1)))
  setTimeout(() => o.disconnect(), (fadeSec + 0.3) * 1000)
  out = null; pads = []; strikeTimes = []
}
