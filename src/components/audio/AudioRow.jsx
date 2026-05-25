import React, { useRef, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'motion/react'
import { PlusIcon, TrashIcon, HeartIcon } from './icons'
import PlayPauseIcon from './PlayPauseIcon'
import MiniWaveform from './MiniWaveform'
import { formatTime } from '../../lib/audioUtils'

// Audio row — three layered states (Figma 42:498):
//   • audio (unselected)  42:503 — transparent fill, no stroke
//   • audio (playing)     44:678 — white/10% fill + white/10% stroke (hover)
//   • audio (edit)        42:520 — swiped: row splits into [audio card | heart | Delete]
//
// SMOOTH SWIPE MODEL
// ──────────────────
// One motion value drives the swipe: `x`, going from 0 (closed) to -REVEAL (open).
// Everything that animates during the swipe — card width, action-pill positions,
// inner card content opacity — is derived from that single `x` via linear
// `useTransform`s. No element runs on its own non-linear sub-range, so the whole
// row glides as a single unit no matter how fast the finger moves.
//
// Layout invariant at any swipe progress p ∈ [0, 1]:
//   • Card width:        342 - 175·p   (342 → 167)
//   • Heart-pill x:      342 - 167·p   (sits 0–8px to the right of the card edge)
//   • Delete-pill x:     342 - 119·p   (sits right after the heart pill)
// Because heart-x − card-right = 8·p, the small 0→8px gap at the card edge grows
// in lockstep with the swipe — no perceptible drift or snap.
const REVEAL = 175

export default function AudioRow({
  track,
  isPlaying,
  isAddedToTimeline,
  isFavorite,
  onAddToTimeline,
  onTogglePlay,
  onToggleFavorite,
  onDelete,
}) {
  const x = useMotionValue(0)
  const dragState = useRef({
    active: false, startX: 0, startVal: 0, last: 0, lastTime: 0,
    velocity: 0, didMove: false, revealed: false,
  })

  // ── Linear transforms — all derived from `x` so they update on the same frame.
  // Card shrinks from full 342 → 167 as we swipe.
  const cardWidth = useTransform(x, [-REVEAL, 0], [167, 342])
  // Action pills slide in from off-screen-right. At rest they sit at left=342
  // (outside the row's overflow:hidden clip). At full reveal they snap to their
  // Figma positions.
  const heartX = useTransform(x, [-REVEAL, 0], [175, 342])
  const deleteX = useTransform(x, [-REVEAL, 0], [223, 342])
  // Inside the card, play icon + trailing controls smoothly collapse alongside
  // the card width. Same linear range as the geometry → no separate "snap".
  const playWidth = useTransform(x, [-REVEAL, 0], [0, 34])
  const playOpacity = useTransform(x, [-REVEAL, 0], [0, 1])
  const trailingWidth = useTransform(x, [-REVEAL, 0], [0, 90])
  const trailingOpacity = useTransform(x, [-REVEAL, 0], [0, 1])

  // Card adopts the 'playing' visual once any swipe has begun. Same linear range.
  const swipeBg = useTransform(x, [-REVEAL, 0], [
    'rgba(255,255,255,0.10)',
    'rgba(255,255,255,0)',
  ])
  const swipeShadow = useTransform(x, [-REVEAL, 0], [
    'inset 0 0 0 1px rgba(255,255,255,0.10)',
    'inset 0 0 0 1px rgba(255,255,255,0)',
  ])

  function snap(open) {
    dragState.current.revealed = open
    animate(x, open ? -REVEAL : 0, { type: 'spring', stiffness: 420, damping: 38 })
  }

  function onPointerDown(e) {
    if (e.target.closest('button')) return
    dragState.current = {
      active: true,
      startX: e.clientX,
      startVal: x.get(),
      last: e.clientX,
      lastTime: performance.now(),
      velocity: 0,
      didMove: false,
      revealed: dragState.current.revealed,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e) {
    const d = dragState.current
    if (!d.active) return
    const delta = e.clientX - d.startX
    if (Math.abs(delta) > 4) d.didMove = true
    const now = performance.now()
    const dt = Math.max(1, now - d.lastTime)
    d.velocity = ((e.clientX - d.last) / dt) * 1000
    d.last = e.clientX
    d.lastTime = now
    const next = Math.max(-REVEAL, Math.min(0, d.startVal + delta))
    x.set(next)
  }
  function onPointerUp(e) {
    const d = dragState.current
    if (!d.active) return
    d.active = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    const cur = x.get()
    if (cur < -REVEAL / 2 || d.velocity < -300) snap(true)
    else snap(false)
  }

  useEffect(() => () => x.stop(), [x])

  return (
    <div
      className="relative select-none"
      style={{
        width: 342,
        height: 55,
        touchAction: 'pan-y',
        userSelect: 'none',
        // Clip everything — action pills live off-screen-right until swiped.
        overflow: 'hidden',
        // Mobile Safari bug: transformed children can bleed past an
        // `overflow: hidden` parent. `isolation: isolate` + a tiny
        // border-radius rounding hack force a fresh stacking context
        // and a real composite layer, which makes the clip work.
        isolation: 'isolate',
        borderRadius: 16,
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Heart (favorite) pill — slides in from the right */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite?.()
          snap(false)
        }}
        className="absolute top-1/2 flex items-center justify-center transition active:scale-95"
        style={{
          x: heartX,
          y: '-50%',
          left: 0,
          width: 40,
          height: 40,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <HeartIcon size={20} color="#cc3636" />
      </motion.button>

      {/* Delete pill — slides in right after the heart */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation()
          onDelete?.()
          snap(false)
        }}
        className="absolute top-0 flex items-center justify-center transition active:scale-[0.98]"
        style={{
          x: deleteX,
          left: 0,
          width: 119,
          height: 55,
          borderRadius: 16,
          background: 'rgba(255,67,67,0.80)',
          border: '1px solid rgba(255,255,255,0.10)',
          gap: 6,
        }}
        aria-label="Delete"
      >
        <TrashIcon size={20} color="#fff" />
        <span className="font-sf text-white text-[16px] leading-[19px]">Delete</span>
      </motion.button>

      {/* Audio card — width shrinks on swipe; bg/border adopt 'playing' style on hover/active/swipe */}
      <motion.div
        className="absolute top-0 left-0 overflow-hidden cursor-pointer"
        style={{
          width: cardWidth,
          height: 55,
          borderRadius: 16,
          backgroundColor: isPlaying ? 'rgba(255,255,255,0.10)' : swipeBg,
          boxShadow: isPlaying ? 'inset 0 0 0 1px rgba(255,255,255,0.10)' : swipeShadow,
        }}
        whileHover={{
          backgroundColor: 'rgba(255,255,255,0.10)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)',
        }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <div className="relative h-full flex items-center" style={{ padding: 10 }}>
          {/* Play / pause — morphing icon (no scale animation) */}
          <motion.button
            onClick={(e) => {
              e.stopPropagation()
              onTogglePlay?.()
            }}
            className="flex items-center justify-center shrink-0 overflow-hidden"
            style={{ height: 24, width: playWidth, opacity: playOpacity }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <div style={{ width: 24, height: 24 }} className="flex items-center justify-center">
              <PlayPauseIcon playing={isPlaying} size={18} color="#fff" />
            </div>
          </motion.button>

          {/* When favorited, swap the second slot from waveform-icon to a red heart
              so the row visually flags it as a favorite (matches Figma 64:71). */}
          <div className="flex items-center justify-center shrink-0" style={{ width: 24, height: 24 }}>
            {isFavorite ? (
              <HeartIcon size={20} color="#cc3636" />
            ) : (
              <MiniWaveform
                peaks={track.peaks}
                width={24}
                height={24}
                color={isPlaying ? '#fff' : 'rgba(255,255,255,0.85)'}
              />
            )}
          </div>

          {/* Track name */}
          <div className="flex-1 min-w-0 px-3">
            <span className="font-sf text-white text-[16px] leading-[19px] truncate block">
              {track.name}
            </span>
          </div>

          {/* Trailing: time + Add button */}
          <motion.div
            className="flex items-center shrink-0 gap-1 overflow-hidden"
            style={{ opacity: trailingOpacity, width: trailingWidth }}
          >
            <span className="font-sf text-[16px] leading-[19px] tabular-nums text-white/80 mr-1">
              {formatTime(track.duration)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAddToTimeline?.()
              }}
              className="flex items-center justify-center transition active:scale-95"
              style={{
                width: 35,
                height: 35,
                borderRadius: 99,
                background: isAddedToTimeline ? 'rgba(26,98,255,0.55)' : '#1a62ff',
              }}
              aria-label="Add to timeline"
            >
              <PlusIcon size={20} color="#fff" />
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
