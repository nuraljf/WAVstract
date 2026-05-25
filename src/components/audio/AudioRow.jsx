import React, { useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react'
import { PlusIcon, TrashIcon, HeartIcon } from './icons'
import PlayPauseIcon from './PlayPauseIcon'
import MiniWaveform from './MiniWaveform'
import { formatTime } from '../../lib/audioUtils'

// Audio row — three layered states (Figma 42:498):
//   • audio (unselected)  42:503 — transparent fill, no stroke
//   • audio (playing)     44:678 — white/10% fill + white/10% stroke (hover)
//   • audio (edit)        42:520 — swiped: row splits into [audio card | heart | Delete]
//
// Heart pill (40w) + 8px gap + Delete pill (119w) = 167w action group.
// Card shrinks from 342 → 175 to make room (175 = 167 + 8 gap to card edge).
const HEART_W = 40
const PILL_GAP = 8
const DELETE_W = 119
const GROUP_W = HEART_W + PILL_GAP + DELETE_W // 167
const CARD_GAP = 8                              // gap between card and heart
const REVEAL = GROUP_W + CARD_GAP               // 175 — total swipe distance

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
  // Card shrinks from full 342 → 175 as we swipe (175 = action-group + 8px gap).
  const cardWidth = useTransform(x, [-REVEAL, 0], [342 - REVEAL, 342])
  // Action group slides in from off-screen-right as a single rigid unit, so
  // the heart and delete pills NEVER drift or overlap mid-swipe — their
  // relative geometry is fixed inside the group. At rest the group sits at
  // left=342 with translateX=0 (fully clipped by the overflow:hidden parent);
  // at full reveal it translates -GROUP_W to land flush against the card.
  const groupX = useTransform(x, [-REVEAL, 0], [-GROUP_W, 0])
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
    // Slight bounce on open (mass>1, lower damping) reads as iOS-style spring;
    // close is crisper so dismissing feels instant.
    animate(
      x,
      open ? -REVEAL : 0,
      open
        ? { type: 'spring', stiffness: 380, damping: 30, mass: 0.9 }
        : { type: 'spring', stiffness: 500, damping: 40 },
    )
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
      {/* Action group — heart + delete as one rigid unit. Anchored just past
          the right edge (left=342) and translated in via groupX. Because
          spacing inside the group is fixed pixels, the two pills can never
          overlap or drift, no matter how fast/slow the swipe. */}
      <motion.div
        className="absolute top-0"
        style={{ left: 342, width: GROUP_W, height: 55, x: groupX }}
      >
        {/* Heart (favorite) pill */}
        <motion.button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite?.()
            snap(false)
          }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 600, damping: 22 }}
          className="absolute flex items-center justify-center"
          style={{
            left: 0,
            top: '50%',
            y: '-50%',
            width: HEART_W,
            height: HEART_W,
            borderRadius: 99,
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {/* White when not yet favorited so the action reads as "add"; red
              once the track is already a favorite so it reads as "remove". */}
          <HeartIcon size={20} color={isFavorite ? '#cc3636' : '#fff'} />
        </motion.button>

        {/* Delete pill */}
        <motion.button
          onClick={(e) => {
            e.stopPropagation()
            onDelete?.()
            snap(false)
          }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 600, damping: 24 }}
          className="absolute top-0 flex items-center justify-center"
          style={{
            left: HEART_W + PILL_GAP,
            width: DELETE_W,
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
      </motion.div>

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

          {/* Second slot — morphs between waveform and red heart with a scale
              spring when the favorite state flips, so tapping the heart action
              produces a fluid pop-in instead of an abrupt asset swap. */}
          <div className="relative shrink-0" style={{ width: 24, height: 24 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {isFavorite ? (
                <motion.div
                  key="fav"
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.3, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <HeartIcon size={20} color="#cc3636" />
                </motion.div>
              ) : (
                <motion.div
                  key="wave"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <MiniWaveform
                    peaks={track.peaks}
                    width={24}
                    height={24}
                    color={isPlaying ? '#fff' : 'rgba(255,255,255,0.85)'}
                  />
                </motion.div>
              )}
            </AnimatePresence>
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
