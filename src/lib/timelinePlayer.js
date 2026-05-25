// Web Audio timeline player.
//
// Why this exists:
//   iOS Safari ignores `HTMLMediaElement.preservesPitch = false`, so the speed
//   slider couldn't pitch-shift on iPhone. AudioBufferSourceNode's playbackRate
//   always couples pitch (there is no "preserve pitch" mode), so by routing
//   timeline playback through Web Audio we get correct chipmunk/deep-voice
//   behavior on every browser.
//
// Public API mirrors what the AudioStudio used to call on the HTMLAudioElement:
//
//   const player = createTimelinePlayer({ onEnded, onTick })
//   await player.load(arrayBuffer)        // decodes + caches AudioBuffer
//   await player.play()                   // resumes from current offset
//   player.pause()
//   player.seek(seconds)                  // works while paused or playing
//   player.setRate(rate)                  // 0..2, pitch couples automatically
//   player.setGain(volume)                // 0..10, drives the GainNode
//   player.getCurrentTime() → number      // current playhead in seconds
//   player.getDuration()    → number
//   player.isPlaying()      → boolean
//   player.destroy()                      // tear down node graph
//
// Notes
// ─────
// • AudioBufferSourceNode is one-shot: you cannot call start() twice. So
//   "pause" stops the current node and remembers the offset; "play" creates
//   a fresh node and starts it at that offset.
// • Reported currentTime is derived from `audioCtx.currentTime - startedAt`
//   scaled by playbackRate, plus the offset where we started.
// • The GainNode is built once and reused across source nodes.

function getCtx() {
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!getCtx._ctx) getCtx._ctx = new Ctor()
  return getCtx._ctx
}

// ── iOS audio-session unlock ─────────────────────────────────────────────
// On iPhone, Web Audio defaults to the "ambient" audio session, which is
// silenced by the ringer/silent switch and sometimes by iOS power management.
// HTMLAudioElement plays through "playback" which is audible regardless.
// Trick: keep a tiny silent HTMLAudioElement looping from the first user
// gesture onward — iOS elevates the whole page (Web Audio included) to the
// playback session, and our AudioBufferSourceNodes become audible.
let _unlockEl = null
let _unlockTried = false
function buildSilentWavUrl() {
  // 0.05s mono 16-bit PCM of pure silence.
  const sampleRate = 22050
  const samples = Math.floor(sampleRate * 0.05)
  const dataLen = samples * 2
  const buf = new ArrayBuffer(44 + dataLen)
  const view = new DataView(buf)
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataLen, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  writeStr(36, 'data'); view.setUint32(40, dataLen, true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}
async function unlockIOSAudio() {
  if (_unlockTried) return
  _unlockTried = true
  try {
    const el = document.createElement('audio')
    el.src = buildSilentWavUrl()
    el.loop = true
    el.playsInline = true
    el.setAttribute('playsinline', '')
    el.setAttribute('webkit-playsinline', '')
    el.preload = 'auto'
    el.style.display = 'none'
    document.body.appendChild(el)
    await el.play()
    _unlockEl = el
  } catch (e) {
    // Silent unlock failed — likely the user gesture was lost. Not fatal;
    // audio may still work if the silent switch is off.
    console.warn('iOS audio unlock failed', e)
  }
}

export function createTimelinePlayer({ onEnded, onTick } = {}) {
  const ctx = getCtx()
  const gain = ctx.createGain()
  gain.gain.value = 1
  gain.connect(ctx.destination)

  let buffer = null          // AudioBuffer (decoded)
  let source = null          // current AudioBufferSourceNode (null when paused)
  let offset = 0             // seconds into the buffer where the next play() starts
  let startedAt = 0          // audioCtx time when current source.start() ran
  let rate = 1
  let playing = false
  let rafId = null
  let endedFlag = false

  // ── RAF loop drives the `onTick` callback so React can update its playhead.
  function tickLoop() {
    if (!playing) return
    onTick?.(currentTime())
    rafId = requestAnimationFrame(tickLoop)
  }
  function startTicking() {
    if (rafId == null) rafId = requestAnimationFrame(tickLoop)
  }
  function stopTicking() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
  }

  function currentTime() {
    if (!buffer) return 0
    if (!playing) return offset
    const elapsed = (ctx.currentTime - startedAt) * rate
    const t = offset + elapsed
    if (buffer && t >= buffer.duration) return buffer.duration
    return t
  }

  function killSource() {
    if (!source) return
    try { source.onended = null; source.stop() } catch {}
    try { source.disconnect() } catch {}
    source = null
  }

  async function load(arrayBuffer) {
    // Always slice — decodeAudioData detaches the input buffer in Chrome and
    // we want callers to keep using their copy for storage.
    const buf = arrayBuffer.slice(0)
    const decoded = await ctx.decodeAudioData(buf)
    // Stop anything currently playing on the old buffer.
    pause()
    buffer = decoded
    offset = 0
    endedFlag = false
    onTick?.(0)
  }

  async function play() {
    if (!buffer || playing) return
    // iOS: elevate to the playback audio session BEFORE resuming the context,
    // and do it without await so we don't lose the user-gesture window that
    // iOS requires for both unlock and ctx.resume().
    unlockIOSAudio()
    // Browsers suspend the context until a user gesture — resume here.
    if (ctx.state === 'suspended') {
      try { await ctx.resume() } catch {}
    }
    // If we'd finished, start over from 0.
    if (offset >= buffer.duration - 0.001) {
      offset = 0
      endedFlag = false
    }
    const node = ctx.createBufferSource()
    node.buffer = buffer
    node.playbackRate.value = Math.max(0.0625, rate)
    node.connect(gain)
    node.onended = () => {
      // onended fires for BOTH natural end and explicit stop(). We only treat
      // it as "ended" if we didn't ask for the stop.
      if (source !== node) return        // stale callback after a kill
      if (!playing) return                // we paused, not natural end
      playing = false
      killSource()
      offset = buffer.duration            // park playhead at the end
      stopTicking()
      onTick?.(buffer.duration)
      endedFlag = true
      onEnded?.()
    }
    source = node
    startedAt = ctx.currentTime
    playing = true
    node.start(0, offset)
    startTicking()
  }

  function pause() {
    if (!playing) return
    // Capture position BEFORE killing the source.
    const t = currentTime()
    playing = false
    killSource()
    offset = Math.max(0, Math.min(buffer ? buffer.duration : 0, t))
    stopTicking()
    onTick?.(offset)
  }

  function seek(sec) {
    if (!buffer) return
    const clamped = Math.max(0, Math.min(buffer.duration, sec))
    const wasPlaying = playing
    if (wasPlaying) {
      playing = false
      killSource()
    }
    offset = clamped
    endedFlag = false
    if (wasPlaying) {
      // Resume from the new offset.
      playing = true
      const node = ctx.createBufferSource()
      node.buffer = buffer
      node.playbackRate.value = Math.max(0.0625, rate)
      node.connect(gain)
      node.onended = () => {
        if (source !== node) return
        if (!playing) return
        playing = false
        killSource()
        offset = buffer.duration
        stopTicking()
        onTick?.(buffer.duration)
        endedFlag = true
        onEnded?.()
      }
      source = node
      startedAt = ctx.currentTime
      node.start(0, offset)
      if (rafId == null) startTicking()
    } else {
      onTick?.(offset)
    }
  }

  function setRate(newRate) {
    rate = newRate
    if (source) {
      // Bake the current position into `offset` so the new rate doesn't
      // retroactively change where we are.
      const t = currentTime()
      offset = t
      startedAt = ctx.currentTime
      source.playbackRate.value = Math.max(0.0625, newRate)
    }
  }

  function setGain(v) {
    gain.gain.value = Math.max(0, v)
  }

  function getCurrentTime() { return currentTime() }
  function getDuration() { return buffer ? buffer.duration : 0 }
  function isPlaying() { return playing }

  function destroy() {
    pause()
    try { gain.disconnect() } catch {}
    buffer = null
  }

  return {
    load, play, pause, seek,
    setRate, setGain,
    getCurrentTime, getDuration, isPlaying,
    destroy,
  }
}
