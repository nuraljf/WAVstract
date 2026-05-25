import React, { useRef, useCallback, useState, useEffect } from 'react'
import { motion } from 'motion/react'

// SliderPanel — combined Speed + Volume card.
// One container card (382 × 135, rounded 34, black) hosts BOTH controllers and
// switches between them via the small pill toggle in the top-right corner
// (Figma controller node 42:286). The pill itself is a 51×16 rounded-99 blue
// rect with a 14px white circle thumb that slides between left (Speed) and
// right (Volume) positions.
//
// SPEED tab (Figma 44:753)
//   • Bipolar slider 0×–2× snapping per 0.1, fill anchored at center.
// VOLUME tab (Figma 58:121)
//   • Unipolar slider 0%–1000% snapping per 10%, fill anchored at left.
//   • >100% uses a Web Audio GainNode in the parent (audio.volume caps at 1.0).
//
// Both sliders reuse the same 22-px-tall track + 16-px white thumb so the
// active control looks consistent when you flip tabs.

const TRACK_WIDTH = 342
const TRACK_HEIGHT = 22
const THUMB_SIZE = 16
const THUMB_INSET = (TRACK_HEIGHT - THUMB_SIZE) / 2
const TRAVEL = TRACK_WIDTH - THUMB_SIZE

const SPEED_TICK_VALUES = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0]
const SPEED_TICK_LABELS = ['0x', '0.2x', '0.4x', '0.6x', '0.8x', '1.0x', '1.2x', '1.4x', '1.6x', '1.8x', '2.0x']

export default function SliderPanel({
  speed,
  onSpeedChange,
  volume,
  onVolumeChange,
  tab,
  onTabChange,
}) {
  const isSpeed = tab === 'speed'

  return (
    <div
      className="relative"
      style={{
        width: 382,
        height: 135,
        borderRadius: 34,
        background: '#000000',
      }}
    >
      {/* Header: big value (e.g. "1.0x" / "100%") + subtitle + tab pill on the right */}
      <div
        className="absolute font-sf text-center"
        style={{ left: 0, right: 0, top: 20, height: 38 }}
      >
        <div className="text-white text-[20px] leading-[24px] font-sf-semibold tabular-nums">
          {isSpeed ? `${speed.toFixed(1)}x` : `${Math.round(volume * 100)}%`}
        </div>
        <div className="text-white/80 text-[12px] leading-[14px] mt-[2px]">
          {isSpeed ? 'Playback speed & pitch' : 'Volume Controller'}
        </div>
      </div>

      {/* Tab pill — Figma node 42:286 (51×16, rounded 99, blue) */}
      <TabPill tab={tab} onChange={onTabChange} />

      {/* Active slider */}
      {isSpeed ? (
        <SpeedTab value={speed} onChange={onSpeedChange} />
      ) : (
        <VolumeTab value={volume} onChange={onVolumeChange} />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Tab pill — small 51×16 toggle in the top-right of the card.
function TabPill({ tab, onChange }) {
  return (
    <div
      className="absolute"
      style={{ right: 20, top: 12, width: 51, height: 16, cursor: 'pointer' }}
      onClick={() => onChange(tab === 'speed' ? 'volume' : 'speed')}
      role="button"
      aria-label={`Switch to ${tab === 'speed' ? 'volume' : 'speed'} controls`}
    >
      <div
        className="absolute inset-0"
        style={{ borderRadius: 99, background: '#1a62ff' }}
      />
      {/* Thumb — 14px white circle. Slides between left (speed) and right (volume). */}
      <motion.div
        className="absolute"
        style={{
          top: 1,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
        }}
        animate={{ left: tab === 'speed' ? 1 : 36 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// SPEED tab — center-anchored bipolar slider, 0×–2× in 0.1 steps with ticks.
function SpeedTab({ value, onChange }) {
  const MIN = 0
  const MAX = 2
  const STEP = 0.1
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const clamped = Math.max(MIN, Math.min(MAX, value))
  const thumbX = ((clamped - MIN) / (MAX - MIN)) * TRAVEL
  const trackCenter = TRACK_WIDTH / 2
  const fillLeft = Math.min(trackCenter, thumbX)
  const fillRight = Math.max(trackCenter, thumbX + THUMB_SIZE)
  const fillWidth = Math.max(0, fillRight - fillLeft)

  const seekFromClientX = useCallback(
    (clientX) => {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const px = Math.max(0, Math.min(TRAVEL, clientX - rect.left - THUMB_SIZE / 2))
      const raw = MIN + (px / TRAVEL) * (MAX - MIN)
      onChange(Math.round(raw / STEP) * STEP)
    },
    [onChange],
  )

  function handleTrackClick(e) { seekFromClientX(e.clientX) }
  function handlePointerDown(e) {
    setDragging(true)
    e.target.setPointerCapture?.(e.pointerId)
    seekFromClientX(e.clientX)
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e) => seekFromClientX(e.clientX)
    const up = () => setDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragging, seekFromClientX])

  return (
    <>
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="absolute cursor-pointer overflow-hidden"
        style={{
          left: 20, top: 68, width: TRACK_WIDTH, height: TRACK_HEIGHT,
          borderRadius: 99, background: 'rgba(255,255,255,0.10)', touchAction: 'none',
        }}
      >
        {fillWidth < 1 && (
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: trackCenter - 0.5, width: 1, height: 8, background: 'rgba(255,255,255,0.45)', borderRadius: 1 }}
          />
        )}
        <div
          className="absolute top-0 h-full"
          style={{
            left: fillLeft, width: fillWidth, background: '#1a62ff', borderRadius: 99,
            transition: dragging ? 'none' : 'left 0.12s ease, width 0.12s ease',
          }}
        />
        <div
          onPointerDown={handlePointerDown}
          className="absolute"
          style={{
            left: thumbX, top: THUMB_INSET, width: THUMB_SIZE, height: THUMB_SIZE,
            cursor: dragging ? 'grabbing' : 'grab',
            transition: dragging ? 'none' : 'left 0.12s ease',
          }}
        >
          <div className="w-full h-full bg-white" style={{ borderRadius: 99, boxShadow: '0 1px 3px rgba(0,0,0,0.45)' }} />
        </div>
      </div>

      {/* Tick row — 11 evenly-spaced labels under the track. */}
      <div
        className="absolute flex justify-between"
        style={{ left: 20, top: 68 + TRACK_HEIGHT + 6, width: TRACK_WIDTH, height: 20 }}
      >
        {SPEED_TICK_LABELS.map((label, i) => {
          const isCenter = i === 5
          const isActive = Math.abs(clamped - SPEED_TICK_VALUES[i]) < 0.06
          return (
            <div key={label} className="flex flex-col items-center" style={{ minWidth: 13 }}>
              <div style={{ width: 1, height: 5, background: '#fff', opacity: isCenter ? 1 : 0.55, marginBottom: 2 }} />
              <span
                className="font-sf text-[10px] leading-[12px] font-sf-semibold text-white text-center"
                style={{ opacity: isActive ? 1 : 0.7 }}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// VOLUME tab — left-anchored unipolar slider, 0%–1000%, no ticks
// (Figma 58:121 — pure slider, value shown in the header).
//
// Mapping: a square-root curve so 100% (= 1.0 gain) sits at ~32% of the track
// travel instead of being cramped at the far-left 10%. That puts the most-used
// range (0–200%) over the LEFT HALF of the slider and reserves the right half
// for the louder boost values.
//
//   position p ∈ [0, 1] ↔ gain v ∈ [0, 10]
//   v = p² · 10        p = √(v / 10)
//
// Lands the value at: 0% → p=0,  100% → p≈0.316,  500% → p≈0.707,  1000% → p=1.
function VolumeTab({ value, onChange }) {
  const MIN = 0
  const MAX = 10           // 1000% gain
  const PERCENT_STEP = 0.05 // 5% increments — fine enough not to feel notched
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const clamped = Math.max(MIN, Math.min(MAX, value))
  const positionFromValue = (v) => Math.sqrt(v / MAX)
  const valueFromPosition = (p) => p * p * MAX

  const thumbX = positionFromValue(clamped) * TRAVEL
  // Fill wraps from the LEFT edge of the track around the thumb.
  const fillWidth = thumbX + THUMB_SIZE

  const seekFromClientX = useCallback(
    (clientX) => {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const px = Math.max(0, Math.min(TRAVEL, clientX - rect.left - THUMB_SIZE / 2))
      const raw = valueFromPosition(px / TRAVEL)
      // Snap to 5% increments so the percent readout settles at clean numbers.
      onChange(Math.round(raw / PERCENT_STEP) * PERCENT_STEP)
    },
    [onChange],
  )

  function handleTrackClick(e) { seekFromClientX(e.clientX) }
  function handlePointerDown(e) {
    setDragging(true)
    e.target.setPointerCapture?.(e.pointerId)
    seekFromClientX(e.clientX)
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e) => seekFromClientX(e.clientX)
    const up = () => setDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragging, seekFromClientX])

  return (
    <>
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="absolute cursor-pointer overflow-hidden"
        style={{
          left: 20, top: 68, width: TRACK_WIDTH, height: TRACK_HEIGHT,
          borderRadius: 99, background: 'rgba(255,255,255,0.10)', touchAction: 'none',
        }}
      >
        <div
          className="absolute top-0 h-full"
          style={{
            left: 0, width: fillWidth, background: '#1a62ff', borderRadius: 99,
            transition: dragging ? 'none' : 'width 0.12s ease',
          }}
        />
        <div
          onPointerDown={handlePointerDown}
          className="absolute"
          style={{
            left: thumbX, top: THUMB_INSET, width: THUMB_SIZE, height: THUMB_SIZE,
            cursor: dragging ? 'grabbing' : 'grab',
            transition: dragging ? 'none' : 'left 0.12s ease',
          }}
        >
          <div className="w-full h-full bg-white" style={{ borderRadius: 99, boxShadow: '0 1px 3px rgba(0,0,0,0.45)' }} />
        </div>
      </div>

      {/* Reference labels along the volume curve. Their x-positions follow the
          same √ mapping as the thumb so a label sits directly under its value. */}
      <div
        className="absolute font-sf text-[10px] leading-[12px] font-sf-semibold text-white/70"
        style={{ left: 20, top: 68 + TRACK_HEIGHT + 6, width: TRACK_WIDTH, height: 12 }}
      >
        {[0, 1, 2.5, 5, 10].map((v) => {
          const p = positionFromValue(v)
          // Center the label under its anchor x. Pull edges in so 0% and 1000%
          // align with the slider's ends rather than overflowing.
          const x = p * TRAVEL + THUMB_SIZE / 2
          return (
            <span
              key={v}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: x }}
            >
              {v * 100 + '%'}
            </span>
          )
        })}
      </div>
    </>
  )
}
