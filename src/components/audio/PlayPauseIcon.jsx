import React from 'react'
import { motion } from 'motion/react'

// Morphing play ↔ pause icon. A single SVG <motion.path> animates its `d`
// attribute between two paths that share the same command structure
// (two sub-rectangles, M-L-L-L-Z × 2). Framer Motion's SVG-path interpolation
// produces a continuous shape morph instead of the old scale-down/up swap.
//
// PAUSE: two upright bars.
// PLAY:  the bars collapse into the two halves of a right-pointing triangle —
//        the left half becomes a thin trapezoid (the back edge of the play
//        triangle) and the right half collapses to the triangle tip.
const PAUSE_D = 'M4 2 L8 2 L8 16 L4 16 Z M10 2 L14 2 L14 16 L10 16 Z'
const PLAY_D  = 'M4 2 L9 5 L9 13 L4 16 Z M9 5 L14 9 L14 9 L9 13 Z'

export default function PlayPauseIcon({ playing, size = 18, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18">
      <motion.path
        fill={color}
        initial={false}
        animate={{ d: playing ? PAUSE_D : PLAY_D }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      />
    </svg>
  )
}
