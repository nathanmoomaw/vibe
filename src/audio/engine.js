let ctx = null
let masterGain = null
let analyser = null

export function getContext() {
  if (!ctx) {
    ctx = new AudioContext()

    masterGain = ctx.createGain()
    masterGain.gain.value = 0.85

    analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.8

    masterGain.connect(analyser)
    analyser.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function getMaster() {
  getContext()
  return masterGain
}

export function getAnalyser() {
  getContext()
  return analyser
}
