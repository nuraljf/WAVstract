import React, { useMemo } from 'react'

// Compact peaks-driven waveform that replaces the generic AudioWaveIcon inside
// each audio table row. Samples a handful of peaks across the buffer so a
// glance at the icon hints at the actual shape of the audio (loud middle,
// quiet tail, etc.).
export default function MiniWaveform({
  peaks,
  width = 24,
  height = 24,
  color = '#ffffffcc',
  bars = 7,
}) {
  const samples = useMemo(() => {
    if (!peaks || !peaks.length) return new Array(bars).fill(0.5)
    const out = []
    const step = peaks.length / bars
    for (let i = 0; i < bars; i++) {
      // Average a small window around each sample point to dampen single-peak noise.
      const start = Math.floor(i * step)
      const end = Math.min(peaks.length, Math.floor((i + 1) * step))
      let sum = 0
      let n = 0
      for (let j = start; j < end; j++) {
        sum += peaks[j]
        n++
      }
      out.push(n > 0 ? sum / n : 0)
    }
    return out
  }, [peaks, bars])

  const gap = 1
  const barW = Math.max(1, (width - gap * (bars - 1)) / bars)

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      {samples.map((v, i) => {
        const h = Math.max(2, v * height * 0.95)
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={(height - h) / 2}
            width={barW}
            height={h}
            rx={Math.min(barW / 2, 1.25)}
            fill={color}
          />
        )
      })}
    </svg>
  )
}
