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
  // Pink-ish noise (softer than white) via Voss-McCartney
  const len = Math.floor(ctx.sampleRate * 8)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b0=0, b1=0, b2=0, b3=0, b4=0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886*b0 + w*0.0555179
      b1 = 0.99332*b1 + w*0.0750759
      b2 = 0.96900*b2 + w*0.1538520
      b3 = 0.86650*b3 + w*0.3104856
      b4 = 0.55000*b4 + w*0.5329522
      d[i] = (b0 + b1 + b2 + b3 + b4) * 0.18
    }
  }
  const src = ctx.createBufferSource()
  src.buffer = buf; src.loop = true

  // Highpass removes sub rumble; lowpass cuts harshness
  const hpf = ctx.createBiquadFilter()
  hpf.type = 'highpass'; hpf.frequency.value = 60

  const lpf = ctx.createBiquadFilter()
  lpf.type = 'lowpass'; lpf.frequency.value = 2000; lpf.Q.value = 0.5

  // Narrow bandpass for airy whisper quality
  const bpf = ctx.createBiquadFilter()
  bpf.type = 'bandpass'; bpf.frequency.value = 380; bpf.Q.value = 0.7

  // Slow LFO: gentle wafting filter sweep
  const lfo = ctx.createOscillator()
  const lfoG = ctx.createGain()
  lfo.type = 'sine'; lfo.frequency.value = 0.04
  lfoG.gain.value = 180
  lfo.connect(lfoG); lfoG.connect(bpf.frequency)

  // Very slow amplitude breath
  const aLfo = ctx.createOscillator()
  const aLfoG = ctx.createGain()
  aLfo.type = 'sine'; aLfo.frequency.value = 0.06
  aLfoG.gain.value = 0.10
  aLfo.connect(aLfoG)

  const gain = ctx.createGain(); gain.gain.value = 0.45
  aLfoG.connect(gain.gain)
  src.connect(hpf); hpf.connect(lpf); lpf.connect(bpf); bpf.connect(gain)
  src.start(); lfo.start(); aLfo.start()

  return { gain, filter: bpf, stop() { try { src.stop(); lfo.stop(); aLfo.stop() } catch(_){} } }
}

// ── Water types: stream (0°), rain (120°), ocean (240°) ──────────────

function makePinkNoiseBuf(ctx, sec = 6) {
  const len = Math.floor(ctx.sampleRate * sec)
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
  return buf
}

function makeWaterStream(ctx) {
  const src = ctx.createBufferSource()
  src.buffer = makePinkNoiseBuf(ctx, 6); src.loop = true

  const bpf1 = ctx.createBiquadFilter()
  bpf1.type = 'bandpass'; bpf1.frequency.value = 900; bpf1.Q.value = 1.4

  const bpf2 = ctx.createBiquadFilter()
  bpf2.type = 'bandpass'; bpf2.frequency.value = 2000; bpf2.Q.value = 0.7

  const lfo = ctx.createOscillator()
  const lfoG = ctx.createGain()
  lfo.frequency.value = 0.9; lfoG.gain.value = 350
  lfo.connect(lfoG); lfoG.connect(bpf1.frequency)

  const gain = ctx.createGain(); gain.gain.value = 0.7
  src.connect(bpf1); src.connect(bpf2); bpf1.connect(gain); bpf2.connect(gain)
  src.start(); lfo.start()

  return { gain, stop() { try { src.stop(); lfo.stop() } catch(_){} } }
}

function makeWaterRain(ctx) {
  const src = ctx.createBufferSource()
  src.buffer = makePinkNoiseBuf(ctx, 6); src.loop = true

  const hpf = ctx.createBiquadFilter()
  hpf.type = 'highpass'; hpf.frequency.value = 600

  const bpf = ctx.createBiquadFilter()
  bpf.type = 'bandpass'; bpf.frequency.value = 2800; bpf.Q.value = 0.5

  const lfo = ctx.createOscillator()
  const lfoG = ctx.createGain()
  lfo.frequency.value = 0.45; lfoG.gain.value = 700
  lfo.connect(lfoG); lfoG.connect(bpf.frequency)

  const gain = ctx.createGain(); gain.gain.value = 0.65
  src.connect(hpf); hpf.connect(bpf); bpf.connect(gain)
  src.start(); lfo.start()

  return { gain, stop() { try { src.stop(); lfo.stop() } catch(_){} } }
}

function makeWaterOcean(ctx) {
  const src = ctx.createBufferSource()
  src.buffer = makePinkNoiseBuf(ctx, 10); src.loop = true

  const lpf = ctx.createBiquadFilter()
  lpf.type = 'lowpass'; lpf.frequency.value = 650; lpf.Q.value = 0.9

  // Very slow wave LFO
  const lfo = ctx.createOscillator()
  const lfoG = ctx.createGain()
  lfo.type = 'sine'; lfo.frequency.value = 0.06; lfoG.gain.value = 0.45
  lfo.connect(lfoG)

  // Sub rumble
  const subSrc = ctx.createBufferSource()
  const subBuf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 4), ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) { const d = subBuf.getChannelData(ch); for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1 }
  subSrc.buffer = subBuf; subSrc.loop = true
  const subLpf = ctx.createBiquadFilter(); subLpf.type='lowpass'; subLpf.frequency.value=80
  const subG = ctx.createGain(); subG.gain.value = 0.28

  const gain = ctx.createGain(); gain.gain.value = 0.6
  lfoG.connect(gain.gain)
  src.connect(lpf); lpf.connect(gain)
  subSrc.connect(subLpf); subLpf.connect(subG); subG.connect(gain)
  src.start(); subSrc.start(); lfo.start()

  return { gain, stop() { try { src.stop(); subSrc.stop(); lfo.stop() } catch(_){} } }
}

function typeWeights(angle, positions = [0, 120, 240]) {
  const a = ((angle % 360) + 360) % 360
  const w = positions.map(t => {
    const dist = Math.min(Math.abs(a - t), 360 - Math.abs(a - t))
    return Math.max(0, 1 - dist / 120)
  })
  const total = w.reduce((s, x) => s + x, 0) || 1
  return w.map(x => x / total)
}

function makeWater(ctx, initialAngle = 0) {
  const stream = makeWaterStream(ctx)
  const rain   = makeWaterRain(ctx)
  const ocean  = makeWaterOcean(ctx)

  const master = ctx.createGain(); master.gain.value = 1
  stream.gain.connect(master); rain.gain.connect(master); ocean.gain.connect(master)

  function setParam(angle) {
    const [ws, wr, wo] = typeWeights(angle)
    const now = ctx.currentTime
    stream.gain.gain.setTargetAtTime(ws * 0.85, now, 0.06)
    rain.gain.gain.setTargetAtTime(wr * 0.85, now, 0.06)
    ocean.gain.gain.setTargetAtTime(wo * 0.85, now, 0.06)
  }

  setParam(initialAngle)

  return { gain: master, setParam, stop() { stream.stop(); rain.stop(); ocean.stop() } }
}

// ── Fire types: candle (0°), campfire (120°), bonfire (240°) ─────────

function makeFireCandle(ctx) {
  const len = Math.floor(ctx.sampleRate * 6)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b0=0, b1=0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759
      d[i] = (b0 + b1) * 0.5
    }
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true

  const lpf = ctx.createBiquadFilter(); lpf.type='lowpass'; lpf.frequency.value=420; lpf.Q.value=0.9

  const lfo = ctx.createOscillator(); const lfoG = ctx.createGain()
  lfo.type='sine'; lfo.frequency.value=0.6; lfoG.gain.value=0.09
  lfo.connect(lfoG)

  const gain = ctx.createGain(); gain.gain.value = 0.22
  lfoG.connect(gain.gain)
  src.connect(lpf); lpf.connect(gain); src.start(); lfo.start()

  return { gain, stop() { try { src.stop(); lfo.stop() } catch(_){} } }
}

function makeFireCampfire(ctx) {
  const len = Math.floor(ctx.sampleRate * 6)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b0=0,b1=0,b2=0,b3=0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856
      d[i] = (b0+b1+b2+b3) * 0.25
    }
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true

  const bpf = ctx.createBiquadFilter(); bpf.type='bandpass'; bpf.frequency.value=620; bpf.Q.value=0.5
  const lpf = ctx.createBiquadFilter(); lpf.type='lowpass'; lpf.frequency.value=2200

  const lfo = ctx.createOscillator(); const lfoG = ctx.createGain()
  lfo.frequency.value=0.9; lfoG.gain.value=0.22; lfo.connect(lfoG)

  const gain = ctx.createGain(); gain.gain.value = 0.48
  lfoG.connect(gain.gain)
  src.connect(bpf); bpf.connect(lpf); lpf.connect(gain); src.start(); lfo.start()

  return { gain, stop() { try { src.stop(); lfo.stop() } catch(_){} } }
}

function makeFireBonfire(ctx) {
  const len = Math.floor(ctx.sampleRate * 6)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b0=0,b1=0,b2=0,b3=0,b4=0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856
      b4=0.55000*b4+w*0.5329522
      d[i] = (b0+b1+b2+b3+b4) * 0.22
    }
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true

  const lpf = ctx.createBiquadFilter(); lpf.type='lowpass'; lpf.frequency.value=1300; lpf.Q.value=1.1
  const sub = ctx.createOscillator(); const subG = ctx.createGain()
  sub.type='sine'; sub.frequency.value=52; subG.gain.value=0.28

  const lfo = ctx.createOscillator(); const lfoG = ctx.createGain()
  lfo.frequency.value=1.4; lfoG.gain.value=0.28; lfo.connect(lfoG)

  const gain = ctx.createGain(); gain.gain.value = 0.68
  lfoG.connect(gain.gain)
  src.connect(lpf); lpf.connect(gain); sub.connect(subG); subG.connect(gain)
  src.start(); lfo.start(); sub.start()

  return { gain, stop() { try { src.stop(); lfo.stop(); sub.stop() } catch(_){} } }
}

function makeFire(ctx, initialAngle = 0) {
  const candle   = makeFireCandle(ctx)
  const campfire = makeFireCampfire(ctx)
  const bonfire  = makeFireBonfire(ctx)

  const master = ctx.createGain(); master.gain.value = 1
  candle.gain.connect(master); campfire.gain.connect(master); bonfire.gain.connect(master)

  function setParam(angle) {
    const [wc, wm, wb] = typeWeights(angle)
    const now = ctx.currentTime
    candle.gain.gain.setTargetAtTime(wc * 0.85, now, 0.06)
    campfire.gain.gain.setTargetAtTime(wm * 0.85, now, 0.06)
    bonfire.gain.gain.setTargetAtTime(wb * 0.85, now, 0.06)
  }

  setParam(initialAngle)

  return { gain: master, setParam, stop() { candle.stop(); campfire.stop(); bonfire.stop() } }
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
const CONTINUOUS_FN = { wind: makeWind, water: makeWater, fire: makeFire, earth: makeEarth }

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
    // rateSec doubles as initialAngle for typed sounds (water, fire)
    const src = CONTINUOUS_FN[id](ctx, rateSec ?? 0)
    src.gain.gain.value = volume
    src.gain.connect(getMaster())
    activeContinuous[id] = src
  }
}

export function setToneParam(id, value) {
  if (activeContinuous[id]?.setParam) activeContinuous[id].setParam(value)
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
