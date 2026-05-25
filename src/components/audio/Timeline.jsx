import React, { useRef, useCallback, useEffect, useState } from 'react'
import Waveform from './Waveform'
import PlayPauseIcon from './PlayPauseIcon'
import { buildTimeMarkers, formatTime } from '../../lib/audioUtils'

// Timeline frame — Figma node 42:455 (382 × 249, rounded 34, black, padding 20).
// Two visual states share the same 342×121 region at the top of the card:
//   - placeholder text (upload, node 42:456)
//   - audio waveform + draggable playhead (node 45:807)
export default function Timeline({
  track,
  currentTime,
  isPlaying,
  onTogglePlay,
  onSeek,
}) {
  const trackRef = useRef(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const duration = track?.duration ?? 0
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
  const markers = buildTimeMarkers(duration || 48, 6, !!track)

  const seekFromClientX = useCallback(
    (clientX) => {
      if (!track || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const ratio = Math.max(0, Math.min(1, x / rect.width))
      onSeek(ratio * duration)
    },
    [track, duration, onSeek],
  )

  const handleTrackClick = useCallback(
    (e) => seekFromClientX(e.clientX),
    [seekFromClientX],
  )

  // Manual playhead scrubbing — keeps the playhead's visual position derived from
  // `currentTime` rather than letting Framer's drag overwrite the transform.
  const handlePlayheadDown = useCallback(
    (e) => {
      if (!track) return
      e.stopPropagation()
      setIsScrubbing(true)
      e.target.setPointerCapture?.(e.pointerId)
    },
    [track],
  )
  const handlePlayheadMove = useCallback(
    (e) => {
      if (!isScrubbing) return
      seekFromClientX(e.clientX)
    },
    [isScrubbing, seekFromClientX],
  )
  const handlePlayheadUp = useCallback(
    (e) => {
      if (!isScrubbing) return
      setIsScrubbing(false)
      e.target.releasePointerCapture?.(e.pointerId)
    },
    [isScrubbing],
  )

  useEffect(() => {
    if (!isScrubbing) return
    const move = (e) => seekFromClientX(e.clientX)
    const up = () => setIsScrubbing(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [isScrubbing, seekFromClientX])

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: 382,
        height: 249,
        borderRadius: 34,
        background: '#000000',
      }}
    >
      {/* Top region — 342×121 placeholder OR waveform — positioned at (20, 20) */}
      <div className="absolute" style={{ left: 20, top: 20, width: 342, height: 121 }}>
        {!track ? (
          <div
            className="flex items-center justify-center w-full h-full"
            style={{
              borderRadius: 34,
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <span className="font-sf text-white text-[16px] leading-[19px] text-center">
              Add extracted audio to the timeline
            </span>
          </div>
        ) : (
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className="relative cursor-pointer select-none w-full h-full"
          >
            <Waveform peaks={track.peaks} width={342} height={121} color="#1a62ff" />
            {/* Playhead — vertical blue line with a dot at the top (group 45:809).
                Position derived purely from currentTime so it tracks playback. */}
            <div
              className="absolute top-0 bottom-0"
              style={{
                left: `calc(${progress * 100}% - 3px)`,
                width: 6,
                touchAction: 'none',
                cursor: 'ew-resize',
              }}
              onPointerDown={handlePlayheadDown}
              onPointerMove={handlePlayheadMove}
              onPointerUp={handlePlayheadUp}
            >
              <div
                className="absolute left-1/2 -translate-x-1/2 top-0 h-full"
                style={{ width: 1, background: '#1a62ff' }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: 0, width: 6, height: 6, borderRadius: '50%', background: '#1a62ff' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Time-marker ruler — Figma node 42:461 at (20, 146) */}
      <div
        className="absolute flex justify-between"
        style={{ left: 20, top: 146, width: 342, height: 14 }}
      >
        {markers.map((m, i) => (
          <span
            key={i}
            className="font-sf text-white text-[12px] leading-[14px] text-center"
            style={{ minWidth: 27 }}
          >
            {m}
          </span>
        ))}
      </div>

      {/* Play / pause button — Figma node 42:468 at (173.5, 165), 35×35 */}
      <button
        onClick={onTogglePlay}
        disabled={!track}
        className="absolute flex items-center justify-center transition active:scale-95 disabled:opacity-40"
        style={{
          left: 173.5,
          top: 165,
          width: 35,
          height: 35,
          borderRadius: 99,
          background: '#1a62ff',
        }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        <PlayPauseIcon playing={isPlaying} size={16} color="#fff" />
      </button>

      {/* Time display "00:00 / 00:48" — Figma node 42:470 at (133.5, 205).
          When no track is loaded, fall back to "00:48" so the placeholder
          matches the Figma static design. */}
      <div
        className="absolute font-sf text-center whitespace-nowrap"
        style={{ left: 133.5, top: 205, width: 115, height: 24 }}
      >
        <span className="text-white text-[20px] leading-[24px] font-sf-semibold tabular-nums">
          {formatTime(currentTime)}
        </span>
        <span className="text-white/70 text-[16px] leading-[24px] tabular-nums">
          {' / '}
          {formatTime(track ? duration : 48)}
        </span>
      </div>
    </div>
  )
}
