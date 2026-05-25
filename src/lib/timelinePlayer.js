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
