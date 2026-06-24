import { getContext, getMaster } from './engine.js'

// Shared reverb tail
function makeReverb(ctx, sec = 2.5, decay = 2) {
  const conv = ctx.createConvolver()
  const len = Math.floor(ctx.sampleRate * sec)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  conv.buffer = buf
  return conv
}

// --- Periodic triggers (bell, chime, gong, birds) ---

function triggerBell(ctx, out, vol, freq = 440) {
  const now = ctx.currentTime
  const carrier = ctx.createOscillator()
  const mod = ctx.createOscillator()
  const modGain = ctx.createGain()
  const env = ctx.createGain()

  carrier.type = 'sine'
  carrier.frequency.value = freq
  mod.type = 'sine'
  mod.frequency.value = freq * 2.756
  modGain.gain.value = freq * 3

  env.gain.setValueAtTime(0.001, now)
  env.gain.linearRampToValueAtTime(vol * 0.8, now + 0.008)
  env.gain.exponentialRampToValueAtTime(0.001, now + 4.0)

  mod.connect(modGain)
  modGain.connect(carrier.frequency)
  carrier.connect(env)
  env.connect(out)

  mod.start(now);  mod.stop(now + 4.5)
  carrier.start(now); carrier.stop(now + 4.5)
}

function triggerChime(ctx, out, vol) {
  const scale = [523, 587, 659, 698, 784, 880, 988, 1047]
  const freq = scale[Math.floor(Math.random() * scale.length)]
  triggerBell(ctx, out, vol * 0.7, freq * (0.98 + Math.random() * 0.04))
}

function triggerGong(ctx, out, vol) {
  const now = ctx.currentTime
  const freq = 55 + Math.random() * 35

  const carrier = ctx.createOscillator()
  const m1 = ctx.createOscillator()
  const m2 = ctx.createOscillator()
  const mg1 = ctx.createGain()
  const mg2 = ctx.createGain()
  const env = ctx.createGain()

  carrier.type = 'sine'
  carrier.frequency.value = freq
  m1.type = 'sine'; m1.frequency.value = freq * 3.5
  m2.type = 'sine'; m2.frequency.value = freq * 7.1

  mg1.gain.value = freq * 10
  mg2.gain.value = freq * 4

  env.gain.setValueAtTime(0.001, now)
  env.gain.linearRampToValueAtTime(vol, now + 0.04)
  env.gain.exponentialRampToValueAtTime(0.001, now + 9.0)

  m1.connect(mg1); mg1.connect(carrier.frequency)
  m2.connect(mg2); mg2.connect(carrier.frequency)
  carrier.connect(env); env.connect(out)

  m1.start(now); m1.stop(now + 9.5)
  m2.start(now); m2.stop(now + 9.5)
  carrier.start(now); carrier.stop(now + 9.5)
}

function triggerBirds(ctx, out, vol) {
  const count = 2 + Math.floor(Math.random() * 4)
  for (let n = 0; n < count; n++) {
    const t = n * (0.04 + Math.random() * 0.12)
    const f0 = 1800 + Math.random() * 3200
    const f1 = f0 * (0.6 + Math.random() * 0.8)
    const dur = 0.04 + Math.random() * 0.18

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f0, now + t)
    osc.frequency.exponentialRampToValueAtTime(f1, now + t + dur)
    env.gain.setValueAtTime(0.001, now + t)
    env.gain.linearRampToValueAtTime(vol * 0.35, now + t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.001, now + t + dur)
    osc.connect(env); env.connect(out)
    osc.start(now + t); osc.stop(now + t + dur + 0.05)
  }
}

// --- Continuous sources (wind, water, earth) ---

function makeWind(ctx) {
  const len = Math.floor(ctx.sampleRate * 8)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = buf; src.loop = true

  const bpf = ctx.createBiquadFilter()
  bpf.type = 'bandpass'; bpf.frequency.value = 700; bpf.Q.value = 0.4

  const lfo = ctx.createOscillator()
  const lfoG = ctx.createGain()
  lfo.type = 'sine'; lfo.frequency.value = 0.08
  lfoG.gain.value = 400
  lfo.connect(lfoG); lfoG.connect(bpf.frequency)

  const aLfo = ctx.createOscillator()
  const aLfoG = ctx.createGain()
  aLfo.frequency.value = 0.15; aLfoG.gain.value = 0.25
  aLfo.connect(aLfoG)

  const gain = ctx.createGain(); gain.gain.value = 0.65
  aLfoG.connect(gain.gain)
  src.connect(bpf); bpf.connect(gain)
  src.start(); lfo.start(); aLfo.start()

  return { gain, filter: bpf, stop() { try { src.stop(); lfo.stop(); aLfo.stop() } catch(_){} } }
}

function makeWater(ctx) {
  const len = Math.floor(ctx.sampleRate * 6)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980
      d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926
    }
  }
  const src = ctx.createBufferSource()
  src.buffer = buf; src.loop = true

  const hpf = ctx.createBiquadFilter()
  hpf.type = 'highpass'; hpf.frequency.value = 300

  const bpf = ctx.createBiquadFilter()
  bpf.type = 'bandpass'; bpf.frequency.value = 1800; bpf.Q.value = 0.6

  const lfo = ctx.createOscillator()
  const lfoG = ctx.createGain()
  lfo.frequency.value = 0.5; lfoG.gain.value = 700
  lfo.connect(lfoG); lfoG.connect(bpf.frequency)

  const gain = ctx.createGain(); gain.gain.value = 0.7
  src.connect(hpf); hpf.connect(bpf); bpf.connect(gain)
  src.start(); lfo.start()

  return { gain, filter: bpf, stop() { try { src.stop(); lfo.stop() } catch(_){} } }
}

function makeEarth(ctx) {
  const len = Math.floor(ctx.sampleRate * 8)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = buf; src.loop = true

  const lpf = ctx.createBiquadFilter()
  lpf.type = 'lowpass'; lpf.frequency.value = 90; lpf.Q.value = 1.5

  const sub = ctx.createOscillator()
  const subG = ctx.createGain()
  sub.type = 'sine'; sub.frequency.value = 38; subG.gain.value = 0.4

  const aLfo = ctx.createOscillator()
  const aLfoG = ctx.createGain()
  aLfo.frequency.value = 0.04; aLfoG.gain.value = 0.2
  aLfo.connect(aLfoG)

  const gain = ctx.createGain(); gain.gain.value = 0.7
  aLfoG.connect(gain.gain)
  src.connect(lpf); lpf.connect(gain)
  sub.connect(subG); subG.connect(gain)
  src.start(); sub.start(); aLfo.start()

  return { gain, filter: lpf, stop() { try { src.stop(); sub.stop(); aLfo.stop() } catch(_){} } }
}

// --- Public API ---

const TRIGGER_FN = { bell: triggerBell, chime: triggerChime, gong: triggerGong, birds: triggerBirds }
const CONTINUOUS_FN = { wind: makeWind, water: makeWater, earth: makeEarth }

const activeIntervals = {}
const activeContinuous = {}
let sharedReverb = null

function getReverb(ctx) {
  if (!sharedReverb) sharedReverb = makeReverb(ctx)
  sharedReverb.connect(getMaster())
  return sharedReverb
}

export function startTone(id, volume = 0.5, rateSec = null) {
  stopTone(id)
  const ctx = getContext()

  if (TRIGGER_FN[id]) {
    const reverb = getReverb(ctx)
    const fn = TRIGGER_FN[id]

    const defaults = { bell: 25, chime: 10, gong: 55, birds: 14 }
    const interval = (rateSec ?? defaults[id]) * 1000

    fn(ctx, reverb, volume)

    const timerId = setInterval(() => {
      fn(ctx, reverb, volume)
    }, interval * (0.7 + Math.random() * 0.6))

    const jitterUpdate = () => {
      clearInterval(activeIntervals[id]?.timer)
      if (!activeIntervals[id]) return
      const t = setInterval(() => {
        fn(ctx, reverb, volume)
        jitterUpdate()
      }, interval * (0.7 + Math.random() * 0.6))
      activeIntervals[id].timer = t
    }

    activeIntervals[id] = { timer: timerId, volume, fn, interval, reverb }
    return
  }

  if (CONTINUOUS_FN[id]) {
    const src = CONTINUOUS_FN[id](ctx)
    src.gain.gain.value = volume
    src.gain.connect(getMaster())
    activeContinuous[id] = src
  }
}

export function stopTone(id) {
  if (activeIntervals[id]) {
    clearInterval(activeIntervals[id].timer)
    delete activeIntervals[id]
  }
  if (activeContinuous[id]) {
    activeContinuous[id].stop()
    try { activeContinuous[id].gain.disconnect() } catch(_) {}
    delete activeContinuous[id]
  }
}

export function setToneVolume(id, v) {
  if (activeIntervals[id]) activeIntervals[id].volume = v
  if (activeContinuous[id]) activeContinuous[id].gain.gain.value = v
}
