// Decode video/audio file → AudioBuffer (audio track only).
// Browsers expose decodeAudioData(ArrayBuffer) which strips visuals automatically
// for container formats they support (mp4/mov/webm/m4a/mp3/wav/ogg).
export async function extractAudioFromFile(file) {
  const ctx = getAudioContext()
  const arrayBuffer = await file.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
  return audioBuffer
}

// Render an AudioBuffer back to a playable Blob URL (WAV) so the
// HTMLAudioElement can stream it independent of the original video container.
export function audioBufferToWavUrl(audioBuffer) {
  const wav = encodeWav(audioBuffer)
  const blob = new Blob([wav], { type: 'audio/wav' })
  return URL.createObjectURL(blob)
}

// Return both the playable URL and the underlying ArrayBuffer so callers can
// persist the bytes (e.g. into IndexedDB) and still get a URL to play with.
export function audioBufferToWav(audioBuffer) {
  const wavBytes = encodeWav(audioBuffer)
  const blob = new Blob([wavBytes], { type: 'audio/wav' })
  return { wavBytes, url: URL.createObjectURL(blob) }
}

// Pre-compute peak amplitudes for the waveform UI.
// Returns Float32Array of length `bins`, normalized 0..1.
export function computeWaveformPeaks(audioBuffer, bins = 96) {
  const channelData = audioBuffer.getChannelData(0)
  const samplesPerBin = Math.floor(channelData.length / bins)
  const peaks = new Float32Array(bins)
  let max = 0
  for (let i = 0; i < bins; i++) {
    let peak = 0
    const start = i * samplesPerBin
    const end = start + samplesPerBin
    for (let j = start; j < end; j++) {
      const v = Math.abs(channelData[j])
      if (v > peak) peak = v
    }
    peaks[i] = peak
    if (peak > max) max = peak
  }
  if (max > 0) {
    for (let i = 0; i < bins; i++) peaks[i] = peaks[i] / max
  }
  return peaks
}

export function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Single-digit minute format ("M:SS") used by the small ruler labels in Figma.
export function formatShortTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Six evenly-spaced timestamps for the ruler under the waveform.
// `loaded=false` reproduces the placeholder layout from Figma: only the
// last marker shows a non-zero time so the empty state still hints at scale.
export function buildTimeMarkers(durationSec, count = 6, loaded = true) {
  const out = []
  for (let i = 0; i < count; i++) {
    if (loaded) {
      const t = (durationSec * i) / (count - 1)
      out.push(formatShortTime(t))
    } else {
      out.push(i === count - 1 ? formatShortTime(durationSec) : '0:00')
    }
  }
  return out
}

let _ctx
function getAudioContext() {
  if (!_ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    _ctx = new Ctor()
  }
  return _ctx
}
export { getAudioContext }

// Minimal PCM-16 WAV encoder.
function encodeWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const samples = interleave(audioBuffer)
  const dataLen = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataLen)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLen, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataLen, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

function interleave(audioBuffer) {
  const n = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  if (n === 1) return audioBuffer.getChannelData(0)
  const out = new Float32Array(length * n)
  const channels = []
  for (let c = 0; c < n; c++) channels.push(audioBuffer.getChannelData(c))
  let k = 0
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < n; c++) out[k++] = channels[c][i]
  }
  return out
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}
