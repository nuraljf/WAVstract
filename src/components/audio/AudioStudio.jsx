import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Timeline from './Timeline'
import SliderPanel from './SliderPanel'
import AudioTable from './AudioTable'
import {
  extractAudioFromFile,
  audioBufferToWav,
  computeWaveformPeaks,
  getAudioContext,
} from '../../lib/audioUtils'
import { putTrack, deleteTrack as dbDeleteTrack, loadAllTracks } from '../../lib/audioStorage'

// Top-level audio studio component.
//
// Audio playback uses TWO HTMLAudioElements:
//   • timelineAudioRef → plays the track that was added to the Timeline via the + button.
//     Its currentTime drives the playhead and the "00:00 / 00:48" readout. Speed slider
//     drives playbackRate (with pitch coupled). Volume slider drives a Web Audio
//     GainNode so it can exceed 100% (HTMLAudioElement.volume caps at 1.0).
//   • previewAudioRef → plays row-level previews. Pressing the play button on a row
//     starts/stops a preview WITHOUT changing what's on the Timeline. Always 1.0x / 1.0 gain.
//
// Web Audio routing (timeline only):
//   timelineAudio ──▶ MediaElementSource ──▶ GainNode ──▶ destination
// The graph is built lazily on first play (browsers require a user gesture to
// resume a suspended AudioContext).
export default function AudioStudio() {
  const [tracks, setTracks] = useState([])
  const [hydrated, setHydrated] = useState(false)
  const [timelineId, setTimelineId] = useState(null)
  const [playingId, setPlayingId] = useState(null) // id of whichever audio element is currently playing
  const [currentTime, setCurrentTime] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(1)            // 1.0 = 100%, up to 10 (1000%)
  const [sliderTab, setSliderTab] = useState('speed')
  const [filter, setFilter] = useState('all')        // 'all' | 'favorites'
  const [isExtracting, setIsExtracting] = useState(false)
  const timelineAudioRef = useRef(null)
  const previewAudioRef = useRef(null)
  const gainNodeRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rafRef = useRef(null)

  const timelineTrack = useMemo(
    () => tracks.find((t) => t.id === timelineId) ?? null,
    [tracks, timelineId],
  )

  // ── Hydrate from IndexedDB on mount.
  useEffect(() => {
    loadAllTracks()
      .then((items) => {
        setTracks(items)
        setHydrated(true)
      })
      .catch((err) => {
        console.error('failed to load tracks from storage', err)
        setHydrated(true)
      })
  }, [])

  // ── Web Audio: build the gain graph for the timeline element lazily.
  // createMediaElementSource can only be called ONCE per element, so we guard
  // with audioCtxRef and only wire it up the first time it's needed.
  const ensureGainGraph = useCallback(() => {
    if (audioCtxRef.current) return
    const audioEl = timelineAudioRef.current
    if (!audioEl) return
    try {
      const ctx = getAudioContext()
      const source = ctx.createMediaElementSource(audioEl)
      const gain = ctx.createGain()
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(ctx.destination)
      audioCtxRef.current = ctx
      gainNodeRef.current = gain
    } catch (e) {
      // Some browsers throw if the element was already wired into another
      // graph — fall back to the native audio.volume below.
      console.warn('failed to build gain graph', e)
    }
  }, [volume])

  // ── Speed (playbackRate + pitch coupling) — timeline only.
  useEffect(() => {
    const a = timelineAudioRef.current
    if (!a) return
    a.playbackRate = Math.max(0.0625, speed)
    a.preservesPitch = false
    a.mozPreservesPitch = false
    a.webkitPreservesPitch = false
    if (speed === 0 && !a.paused) a.pause()
  }, [speed])

  // ── Volume — drives the GainNode (preferred) or falls back to audio.volume.
  useEffect(() => {
    const g = gainNodeRef.current
    if (g) {
      g.gain.value = volume
      return
    }
    // No gain graph yet: best we can do is clamp to [0, 1] on the element.
    const a = timelineAudioRef.current
    if (a) a.volume = Math.max(0, Math.min(1, volume))
  }, [volume])

  // ── RAF loop — only updates the displayed currentTime when the *timeline* track is playing.
  useEffect(() => {
    function tick() {
      const a = timelineAudioRef.current
      if (a && !a.paused && playingId === timelineId && timelineId != null) {
        setCurrentTime(a.currentTime)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playingId, timelineId])

  // ── When the user changes the timeline track, point the <audio> at it, reset
  // the playhead, and reset speed + volume to their defaults so the new clip
  // starts clean (per user note 1).
  useEffect(() => {
    const a = timelineAudioRef.current
    if (!a) return
    if (!timelineTrack) {
      a.removeAttribute('src')
      a.load()
      setCurrentTime(0)
      if (playingId === timelineId) setPlayingId(null)
      setSpeed(1)
      setVolume(1)
      return
    }
    a.src = timelineTrack.url
    a.load()
    setCurrentTime(0)
    setSpeed(1)
    setVolume(1)
    if (playingId === timelineId) setPlayingId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineTrack?.id])

  // ── Playback handlers ─────────────────────────────────────────────────

  const togglePlayTimeline = useCallback(async () => {
    const a = timelineAudioRef.current
    if (!a || !timelineTrack) return
    if (previewAudioRef.current && !previewAudioRef.current.paused) {
      previewAudioRef.current.pause()
    }
    if (!a.paused) {
      a.pause()
      setPlayingId((id) => (id === timelineTrack.id ? null : id))
      return
    }
    // First play of this audio element → wire up the gain graph (needs a user gesture).
    ensureGainGraph()
    if (audioCtxRef.current?.state === 'suspended') {
      try { await audioCtxRef.current.resume() } catch {}
    }
    try {
      await a.play()
      setPlayingId(timelineTrack.id)
    } catch (e) {
      console.error('timeline play failed', e)
    }
  }, [timelineTrack, ensureGainGraph])

  const handleSeek = useCallback((sec) => {
    const a = timelineAudioRef.current
    if (!a) return
    a.currentTime = sec
    setCurrentTime(sec)
  }, [])

  // Per-row play. NEVER mutates timelineId.
  const handleRowTogglePlay = useCallback(
    async (id) => {
      const track = tracks.find((t) => t.id === id)
      if (!track) return

      if (id === timelineId) {
        await togglePlayTimeline()
        return
      }

      const preview = previewAudioRef.current
      if (!preview) return

      const timeline = timelineAudioRef.current
      if (timeline && !timeline.paused) timeline.pause()

      if (playingId === id && !preview.paused) {
        preview.pause()
        setPlayingId(null)
        return
      }

      if (preview.src !== track.url) {
        preview.src = track.url
        preview.load()
      } else {
        preview.currentTime = 0
      }
      try {
        await preview.play()
        setPlayingId(id)
      } catch (e) {
        console.error('preview play failed', e)
      }
    },
    [tracks, timelineId, playingId, togglePlayTimeline],
  )

  const handleAddToTimeline = useCallback(
    (id) => {
      const preview = previewAudioRef.current
      const wasPreviewingThis = playingId === id && preview && !preview.paused
      const transferTime = wasPreviewingThis ? preview.currentTime : 0

      if (preview && !preview.paused) {
        preview.pause()
        preview.currentTime = 0
      }
      setPlayingId(null)
      setTimelineId(id)

      if (wasPreviewingThis) {
        requestAnimationFrame(() => {
          requestAnimationFrame(async () => {
            const timeline = timelineAudioRef.current
            if (!timeline) return
            try {
              ensureGainGraph()
              if (audioCtxRef.current?.state === 'suspended') {
                try { await audioCtxRef.current.resume() } catch {}
              }
              timeline.currentTime = transferTime
              await timeline.play()
              setPlayingId(id)
            } catch (e) {
              console.error('failed to transfer playback to timeline', e)
            }
          })
        })
      }
    },
    [playingId, ensureGainGraph],
  )

  // ── Library mutations ──────────────────────────────────────────────────

  // Shared post-decode handler — used by both file extract and link extract.
  const addTrackFromAudioBuffer = useCallback(async (audioBuffer, displayName) => {
    const peaks = computeWaveformPeaks(audioBuffer, 128)
    const { wavBytes, url } = audioBufferToWav(audioBuffer)
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const name = (displayName || 'Extracted').replace(/\.[^.]+$/, '')
    const track = {
      id,
      name,
      url,
      duration: audioBuffer.duration,
      peaks,
      wavBytes,
      createdAt: Date.now(),
      favorite: false,
    }
    setTracks((prev) => [track, ...prev])
    try {
      await putTrack(track)
    } catch (e) {
      console.error('failed to persist track', e)
    }
  }, [])

  const handleExtract = useCallback(
    async (file) => {
      setIsExtracting(true)
      try {
        const audioBuffer = await extractAudioFromFile(file)
        await addTrackFromAudioBuffer(audioBuffer, file.name)
      } catch (err) {
        console.error('extraction failed', err)
        alert(
          'Could not extract audio from this file. Try a standard mp4, mov, webm, m4a, mp3, wav, or ogg file.',
        )
      } finally {
        setIsExtracting(false)
      }
    },
    [addTrackFromAudioBuffer],
  )

  // Extract from URL.
  //
  // Strategy:
  //   • If the URL is a known video-site page (TikTok / YouTube / Instagram /
  //     Facebook / Twitter / X / Reddit / Twitch), route it through our Vite
  //     dev proxy at /api/extract-link — that endpoint runs yt-dlp first and
  //     falls back to tikwm.com for TikTok. Browsers can't talk to those sites
  //     directly because of CORS and signed-URL requirements.
  //   • Otherwise (a raw .mp3/.wav/.m4a URL etc.) just fetch and decode it
  //     in-browser.
  const handleExtractFromLink = useCallback(
    async (rawUrl) => {
      setIsExtracting(true)
      const url = rawUrl.trim()
      const needsProxy = /tiktok\.com|instagram\.com|youtube\.com|youtu\.be|facebook\.com|twitter\.com|x\.com|reddit\.com|twitch\.tv|vimeo\.com/i.test(url)
      const fetchUrl = needsProxy ? `/api/extract-link?url=${encodeURIComponent(url)}` : url

      try {
        const res = await fetch(fetchUrl, needsProxy ? {} : { mode: 'cors' })
        if (!res.ok) {
          // Proxy errors come back as JSON — try to surface the friendly message.
          let detail = `HTTP ${res.status}`
          try {
            const j = await res.json()
            if (j?.error) detail = j.error + (j.hint ? `\n\n${j.hint}` : '')
          } catch {}
          throw new Error(detail)
        }
        const buf = await res.arrayBuffer()
        const ctx = getAudioContext()
        const audioBuffer = await ctx.decodeAudioData(buf.slice(0))
        let name = 'From URL'
        try {
          const u = new URL(url)
          // Prefer the trailing path segment ("@user-video-12345" / "song.mp3").
          const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '')
          if (last) name = last
        } catch {}
        await addTrackFromAudioBuffer(audioBuffer, name)
      } catch (err) {
        console.error('link extraction failed', err)
        const msg = `Could not extract audio from this URL.\n\n${err?.message || 'Unknown error'}`
        alert(msg)
      } finally {
        setIsExtracting(false)
      }
    },
    [addTrackFromAudioBuffer],
  )

  const handleToggleFavorite = useCallback(async (id) => {
    let updated = null
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        updated = { ...t, favorite: !t.favorite }
        return updated
      }),
    )
    if (updated) {
      try { await putTrack(updated) } catch (e) { console.error('favorite persist failed', e) }
    }
  }, [])

  const handleDelete = useCallback(
    async (id) => {
      const t = tracks.find((x) => x.id === id)
      if (t?.url) {
        try { URL.revokeObjectURL(t.url) } catch {}
      }
      setTracks((prev) => prev.filter((x) => x.id !== id))
      if (timelineId === id) setTimelineId(null)
      if (playingId === id) setPlayingId(null)
      try { await dbDeleteTrack(id) } catch (e) { console.error('failed to delete track', e) }
    },
    [tracks, timelineId, playingId],
  )

  return (
    <div className="min-h-screen w-full flex items-start justify-center py-10 px-4 bg-[#0a0b10]">
      <audio
        ref={timelineAudioRef}
        onEnded={() => setPlayingId((id) => (id === timelineId ? null : id))}
        onPause={() => setPlayingId((id) => (id === timelineId ? null : id))}
        className="hidden"
      />
      <audio
        ref={previewAudioRef}
        onEnded={() => setPlayingId((id) => (id !== timelineId ? null : id))}
        onPause={() => setPlayingId((id) => (id !== timelineId ? null : id))}
        className="hidden"
      />

      <div className="flex flex-col gap-[10px]" style={{ width: 382 }}>
        <Timeline
          track={timelineTrack}
          currentTime={currentTime}
          isPlaying={playingId === timelineId && timelineId != null}
          onTogglePlay={togglePlayTimeline}
          onSeek={handleSeek}
        />

        <SliderPanel
          speed={speed}
          onSpeedChange={setSpeed}
          volume={volume}
          onVolumeChange={setVolume}
          tab={sliderTab}
          onTabChange={setSliderTab}
        />

        <AudioTable
          tracks={tracks}
          playingId={playingId}
          timelineId={timelineId}
          hydrated={hydrated}
          filter={filter}
          onFilterChange={setFilter}
          onExtract={handleExtract}
          onExtractFromLink={handleExtractFromLink}
          onTogglePlay={handleRowTogglePlay}
          onAddToTimeline={handleAddToTimeline}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDelete}
        />
      </div>

      {isExtracting && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="font-sf text-white text-[14px] flex items-center gap-3">
            <span
              className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
              aria-hidden
            />
            Extracting audio…
          </div>
        </div>
      )}
    </div>
  )
}
