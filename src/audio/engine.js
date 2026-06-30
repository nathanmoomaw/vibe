let ctx = null
let masterGain = null
let analyser = null

// ── Audio input (external URL → filtered through noise settings) ──────────────
let inputAudio   = null
let inputSource  = null
let inputNodes   = []

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

// Fade master gain to targetGain over durationMs, then call onDone
export function fadeMaster(targetGain, durationMs, onDone) {
  const ctx = getContext()
  masterGain.gain.cancelScheduledValues(ctx.currentTime)
  masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime)
  masterGain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + durationMs / 1000)
  if (onDone) setTimeout(onDone, durationMs)
}

export function getMasterGain() {
  getContext()
  return masterGain.gain.value
}

// filterConfigs: [{ type, freq }] from active noise settings
// Passes audio through a parallel bandpass bank matching active noise filters.
export function setAudioInput(url, filterConfigs) {
  stopAudioInput()
  const ctx = getContext()

  inputAudio = new Audio()
  inputAudio.crossOrigin = 'anonymous'
  inputAudio.src = url
  inputAudio.loop = true

  inputSource = ctx.createMediaElementSource(inputAudio)

  const out = ctx.createGain()
  out.gain.value = 0.75
  out.connect(getMaster())
  inputNodes = [out]

  if (filterConfigs.length === 0) {
    inputSource.connect(out)
  } else {
    // Parallel bank: one bandpass per active noise channel
    out.gain.value = 0.75 / filterConfigs.length
    for (const { type, freq } of filterConfigs) {
      const f = ctx.createBiquadFilter()
      f.type = type === 'highpass' ? 'highpass' : type === 'allpass' ? 'allpass' : 'bandpass'
      f.frequency.value = freq
      f.Q.value = 1.5
      inputSource.connect(f)
      f.connect(out)
      inputNodes.push(f)
    }
  }

  return inputAudio.play()
}

export function stopAudioInput() {
  if (inputAudio) {
    inputAudio.pause()
    inputAudio.src = ''
    inputAudio = null
  }
  if (inputSource) {
    try { inputSource.disconnect() } catch (_) {}
    inputSource = null
  }
  for (const n of inputNodes) {
    try { n.disconnect() } catch (_) {}
  }
  inputNodes = []
}

export function isAudioInputActive() {
  return inputAudio !== null
}
