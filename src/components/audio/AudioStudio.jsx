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
import { createTimelinePlayer } from '../../lib/timelinePlayer'

// Top-level audio studio component.
//
// Audio playback uses TWO engines:
//   • Timeline → Web Audio (AudioBufferSourceNode via createTimelinePlayer).
//     Why: iOS Safari ignores HTMLAudioElement.preservesPitch=false, so we
//     could only speed-shift on iPhone, never pitch-shift. AudioBufferSource's
//     playbackRate ALWAYS couples pitch — works the same on every browser.
//     Volume goes through the player's internal GainNode (0–10x).
//   • previewAudioRef (HTMLAudioElement) → row-level previews. Always 1.0x,
//     1.0 gain. Kept on the simpler element because previews don't need
//     pitch coupling and we get free pause/resume/ended events.
export default function AudioStudio() {
  const [tracks, setTracks] = useState([])
  const [hydrated, setHydrated] = useState(false)
  const [timelineId, setTimelineId] = useState(null)
  const [playingId, setPlayingId] = useState(null) // id of whichever audio source is currently playing
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(1)            // 1.0 = 100%, up to 10 (1000%)
  const [sliderTab, setSliderTab] = useState('speed')
  const [filter, setFilter] = useState('all')        // 'all' | 'favorites'
  const [isExtracting, setIsExtracting] = useState(false)

  const playerRef = useRef(null)       // TimelinePlayer instance
  const previewAudioRef = useRef(null) // HTMLAudioElement for previews
  // Latest timelineId held in a ref so the player's onEnded callback (created
  // once at mount) can always reach the current value.
  const timelineIdRef = useRef(null)
  useEffect(() => { timelineIdRef.current = timelineId }, [timelineId])

  const timelineTrack = useMemo(
    () => tracks.find((t) => t.id === timelineId) ?? null,
    [tracks, timelineId],
  )

  // ── Build the player once on mount. onTick is our playhead clock and
  // onEnded handles natural end-of-track.
  useEffect(() => {
    playerRef.current = createTimelinePlayer({
      onTick: (t) => setCurrentTime(t),
      onEnded: () => {
        const id = timelineIdRef.current
        setPlayingId((cur) => (cur === id ? null : cur))
      },
    })
    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [])

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

  // ── Speed → player (couples pitch on every browser, iOS included).
  useEffect(() => {
    playerRef.current?.setRate(Math.max(0.0625, speed))
  }, [speed])

  // ── Volume → player's internal GainNode (0..10).
  useEffect(() => {
    playerRef.current?.setGain(volume)
  }, [volume])

  // ── Load a fresh AudioBuffer into the player whenever the timeline track
  // changes. Reset speed/volume/playhead so the new clip starts clean.
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (!timelineTrack) {
      player.pause()
      setCurrentTime(0)
      setDuration(0)
      setSpeed(1)
      setVolume(1)
      return
    }
    let cancelled = false
    // Decode the stored WAV bytes — we already paid this decode cost during
    // extraction, but the result wasn't kept, so we redo it here on demand.
    // For typical clips this is well under 100ms.
    ;(async () => {
      try {
        await player.load(timelineTrack.wavBytes)
        if (cancelled) return
        setCurrentTime(0)
        setDuration(player.getDuration())
        setSpeed(1)
        setVolume(1)
      } catch (e) {
        console.error('failed to load timeline buffer', e)
      }
    })()
    return () => { cancelled = true }
  }, [timelineTrack?.id])

  // ── Playback handlers ─────────────────────────────────────────────────

  const togglePlayTimeline = useCallback(async () => {
    const player = playerRef.current
    if (!player || !timelineTrack) return
    if (previewAudioRef.current && !previewAudioRef.current.paused) {
      previewAudioRef.current.pause()
    }
    if (player.isPlaying()) {
      player.pause()
      setPlayingId((id) => (id === timelineTrack.id ? null : id))
      return
    }
    try {
      await player.play()
      setPlayingId(timelineTrack.id)
    } catch (e) {
      console.error('timeline play failed', e)
    }
  }, [timelineTrack])

  const handleSeek = useCallback((sec) => {
    const player = playerRef.current
    if (!player) return
    player.seek(sec)
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

      // Pause the timeline player if it's running — only one thing plays at a time.
      if (playerRef.current?.isPlaying()) {
        playerRef.current.pause()
        setPlayingId((cur) => (cur === timelineId ? null : cur))
      }

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
        // The timeline-load effect runs async after timelineId changes —
        // poll for the buffer to be ready, then resume at the transfer point.
        const start = performance.now()
        const tryStart = async () => {
          const player = playerRef.current
          if (!player) return
          if (player.getDuration() > 0) {
            try {
              player.seek(transferTime)
              await player.play()
              setPlayingId(id)
            } catch (e) {
              console.error('failed to transfer playback to timeline', e)
            }
            return
          }
          if (performance.now() - start < 2000) {
            requestAnimationFrame(tryStart)
          }
        }
        requestAnimationFrame(tryStart)
      }
    },
    [playingId],
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

  // Derived track passed to <Timeline />. We override its duration with what
  // the player reports (always identical for now, but keeps the contract clear).
  const timelineTrackForUi = useMemo(() => {
    if (!timelineTrack) return null
    return { ...timelineTrack, duration: duration || timelineTrack.duration }
  }, [timelineTrack, duration])

  return (
    <div className="min-h-screen w-full flex items-start justify-center py-10 px-4 bg-[#0a0b10]">
      {/* Preview-only HTMLAudioElement — timeline now goes through Web Audio. */}
      <audio
        ref={previewAudioRef}
        onEnded={() => setPlayingId((id) => (id !== timelineId ? null : id))}
        onPause={() => setPlayingId((id) => (id !== timelineId ? null : id))}
        className="hidden"
      />

      <div className="flex flex-col gap-[10px]" style={{ width: 382 }}>
        <Timeline
          track={timelineTrackForUi}
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
