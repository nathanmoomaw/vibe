// URL-safe base64: avoids + / = chars that corrupt URL query params
function b64enc(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
function b64dec(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return atob(s)
}

// Encode/decode current vibe settings as a compact URL-safe string

export function encodeSettings(noise, tones, NOISE, TONES) {
  const n = NOISE.map(s => {
    const v = noise[s.id]
    return [v.on ? 1 : 0, Math.round(v.volume * 100), Math.round(v.freq)]
  })
  const t = TONES.map(s => {
    const v = tones[s.id]
    const param = s.hasType
      ? Math.round(v.typeAngle ?? 0)
      : s.periodic
        ? Math.round(v.rate ?? s.rateDefault ?? 20)
        : 0
    return [v.on ? 1 : 0, Math.round(v.volume * 100), param]
  })
  return b64enc(JSON.stringify({ n, t }))
}

export function decodeSettings(encoded, noise, tones, NOISE, TONES) {
  try {
    const { n, t } = JSON.parse(b64dec(encoded))
    const nextNoise = { ...noise }
    const nextTones = { ...tones }

    NOISE.forEach((s, i) => {
      if (!n[i]) return
      const [on, vol, freq] = n[i]
      nextNoise[s.id] = { ...noise[s.id], on: !!on, volume: vol / 100, freq }
    })

    TONES.forEach((s, i) => {
      if (!t[i]) return
      const [on, vol, param] = t[i]
      if (s.hasType) {
        nextTones[s.id] = { ...tones[s.id], on: !!on, volume: vol / 100, typeAngle: param }
      } else if (s.periodic) {
        nextTones[s.id] = { ...tones[s.id], on: !!on, volume: vol / 100, rate: param }
      } else {
        nextTones[s.id] = { ...tones[s.id], on: !!on, volume: vol / 100 }
      }
    })

    return { noise: nextNoise, tones: nextTones }
  } catch {
    return null
  }
}
