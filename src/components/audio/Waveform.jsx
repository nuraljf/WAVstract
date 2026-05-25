import React, { useMemo } from 'react'

// Renders the audio waveform as a stylized centered-bar SVG (matches Figma vector 45:808).
// Each peak becomes a vertical bar mirrored around the centerline.
export default function Waveform({ peaks, width = 362, height = 121, color = '#1a62ff', dimmed = false }) {
  const bars = useMemo(() => {
    if (!peaks || !peaks.length) return []
    const count = peaks.length
    const gap = 1
    const barW = Math.max(1, (width - gap * (count - 1)) / count)
    return Array.from({ length: count }, (_, i) => {
      const p = peaks[i]
      const h = Math.max(2, p * height * 0.92)
      return {
        x: i * (barW + gap),
        y: (height - h) / 2,
        w: barW,
        h,
      }
    })
  }, [peaks, width, height])

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={Math.min(b.w / 2, 1.5)}
          fill={color}
          opacity={dimmed ? 0.55 : 1}
        />
      ))}
    </svg>
  )
}
