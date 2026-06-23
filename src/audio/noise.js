import { getContext, getMaster } from './engine.js'

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

const BUFFERS = { white: whiteBuffer, pink: pinkBuffer, blue: blueBuffer }
const FILTER_TYPE = { white: 'allpass', pink: 'lowpass', blue: 'highpass' }
const FILTER_DEFAULT = { white: 2000, pink: 800, blue: 3000 }

const active = {}

export function startNoise(id, volume = 0.5, freq = null) {
  stopNoise(id)
  const ctx = getContext()

  const source = ctx.createBufferSource()
  source.buffer = BUFFERS[id](ctx)
  source.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = FILTER_TYPE[id]
  filter.frequency.value = freq ?? FILTER_DEFAULT[id]
  filter.Q.value = 0.7

  const gain = ctx.createGain()
  gain.gain.value = volume

  source.connect(filter)
  filter.connect(gain)
  gain.connect(getMaster())
  source.start()

  active[id] = { source, filter, gain }
}

export function stopNoise(id) {
  const s = active[id]
  if (!s) return
  try { s.source.stop() } catch (_) {}
  s.gain.disconnect()
  delete active[id]
}

export function setNoiseVolume(id, v) {
  if (active[id]) active[id].gain.gain.value = v
}

export function setNoiseFreq(id, hz) {
  if (active[id]) active[id].filter.frequency.value = hz
}
