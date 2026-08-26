let ctx = null
let masterGain = null
let analyser = null

// ── Audio input (external URL → filtered through noise settings) ──────────────
let inputAudio   = null
let inputSource  = null
let inputNodes   = []

// ── Background-playback keep-alive ─────────────────────────────────────────
// The bell/chime/gong/birds tones schedule their next strike with a plain
// setTimeout (audio/tones.js), not the Web Audio clock. Backgrounded mobile
// tabs — iOS Safari especially — throttle or freeze that timer once the page
// isn't recognized as an active media session, so strikes queue up and then
// fire in a stuttering burst on return ("gets skippy"). A silent looping
// HTMLAudioElement plus registering a real Media Session is the standard way
// to get the OS/browser to treat the page as genuine background audio (the
// same mechanism music-player PWAs rely on) rather than arbitrary background
// JS, which keeps those timers running on schedule instead of frozen.
let keepAliveAudio = null

function getKeepAliveAudio() {
  if (!keepAliveAudio) {
    const numSamples = 8000 // 1s @ 8kHz, 8-bit mono ≈ 8KB
    const buf = new ArrayBuffer(44 + numSamples)
    const view = new DataView(buf)
    const str = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)) }
    str(0, 'RIFF'); view.setUint32(4, 36 + numSamples, true); str(8, 'WAVE')
    str(12, 'fmt '); view.setUint32(16, 16, true)
    view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, 8000, true); view.setUint32(28, 8000, true)
    view.setUint16(32, 1, true); view.setUint16(34, 8, true)
    str(36, 'data'); view.setUint32(40, numSamples, true)
    for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, 128) // silence (8-bit midpoint)
    keepAliveAudio = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })))
    keepAliveAudio.loop = true
  }
  return keepAliveAudio
}

// Screen Wake Lock — keeps the device from auto-locking on its inactivity
// timeout while a vibe is playing (reported: audio cutting out on a Pixel 7
// "when it sleeps or just about to"). This only covers the screen-timeout
// case; it can't stop a manual power-button lock or app switch, and the
// browser auto-releases it the moment the tab is hidden, so it's paired
// with re-acquiring on visibilitychange below rather than relied on alone.
let wakeLock = null
let wantWakeLock = false

async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => { wakeLock = null })
  } catch {
    // Permission denied / page not visible / unsupported — nothing to do
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && wantWakeLock && !wakeLock) acquireWakeLock()
})

// Call with true when any sound is on, false when everything stops.
export function setPlaybackActive(active) {
  const audio = getKeepAliveAudio()
  wantWakeLock = active
  if (active) {
    audio.play().catch(() => {})
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'vibe', artist: 'ambient synthesis' })
      navigator.mediaSession.playbackState = 'playing'
    }
    acquireWakeLock()
  } else {
    audio.pause()
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
    if (wakeLock) wakeLock.release()
  }
}

// Wires the OS-level media notification's stop/pause controls to fn. Call
// once at app startup.
export function registerMediaSessionStop(fn) {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.setActionHandler('pause', fn)
  navigator.mediaSession.setActionHandler('stop', fn)
  navigator.mediaSession.setActionHandler('play', () => {})
}

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

    // Mobile browsers (iOS Safari in particular) can suspend the
    // AudioContext while the tab/app is backgrounded. Without this, it only
    // gets resumed the next time some unrelated interaction happens to call
    // getContext() again, which can read as a jarring "catch up" skip on
    // return from background. Resume proactively the moment the page is
    // visible again instead of waiting for that.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && ctx.state === 'suspended') ctx.resume()
    })
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

// filterConfigs: [{ type, freq, q }] from active noise settings
// Passes audio through a parallel filter bank matching active noise filters.
export function setAudioInput(url, filterConfigs) {
  stopAudioInput()
  const ctx = getContext()

  inputAudio = new Audio()
  inputAudio.crossOrigin = 'anonymous'
  inputAudio.src = url
  inputAudio.loop = true

  inputSource = ctx.createMediaElementSource(inputAudio)

  const out = ctx.createGain()
  out.connect(getMaster())
  inputNodes = [out]

  if (filterConfigs.length === 0) {
    // Nothing to filter the input through — stay silent rather than passing
    // it straight to the master unfiltered. The whole point of this feature
    // is playing the input *through* whichever channels are active; with
    // none active there is nothing to process it through.
    out.gain.value = 0
  } else {
    // Parallel bank: one filter per active noise channel
    out.gain.value = 0.75 / filterConfigs.length
    for (const { type, freq, q } of filterConfigs) {
      const f = ctx.createBiquadFilter()
      f.type = type === 'highpass' ? 'highpass' : type === 'lowpass' ? 'lowpass' : type === 'allpass' ? 'allpass' : 'bandpass'
      f.frequency.value = freq
      f.Q.value = q ?? 1.5
      inputSource.connect(f)
      f.connect(out)
      inputNodes.push(f)
    }
  }

  return inputAudio.play()
}

// Rebuilds the filter bank in place (source & playback keep running) so the
// input keeps tracking whichever noise/tone channels are presently active,
// instead of freezing at whatever was on when the URL was first submitted.
export function updateAudioInputFilters(filterConfigs) {
  if (!inputSource) return
  const out = inputNodes[0]

  try { inputSource.disconnect() } catch (_) {}
  for (const n of inputNodes.slice(1)) {
    try { n.disconnect() } catch (_) {}
  }
  inputNodes = [out]

  if (filterConfigs.length === 0) {
    // Same rule as setAudioInput: no active channel to filter through means
    // silence, not an unfiltered passthrough.
    out.gain.value = 0
  } else {
    out.gain.value = 0.75 / filterConfigs.length
    for (const { type, freq, q } of filterConfigs) {
      const f = ctx.createBiquadFilter()
      f.type = type === 'highpass' ? 'highpass' : type === 'lowpass' ? 'lowpass' : type === 'allpass' ? 'allpass' : 'bandpass'
      f.frequency.value = freq
      f.Q.value = q ?? 1.5
      inputSource.connect(f)
      f.connect(out)
      inputNodes.push(f)
    }
  }
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
