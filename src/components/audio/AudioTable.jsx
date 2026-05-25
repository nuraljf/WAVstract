import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import AudioRow from './AudioRow'
import { UploadIcon, LinkIcon, SendCircleIcon, FolderIcon, HeartIcon } from './icons'

// Audio table — Figma node 42:498 (382 × variable, rounded 34, black, padding 20).
// Top group:
//   1. "Extract from link" input  (Figma 57:18)  — pill text field with a chain
//      icon on the left and a + circle on the right that submits the URL.
//   2. "Extract audio from video" file picker  (Figma 57:60)  — full-width blue
//      pill; accepts both video AND audio files (mp3/m4a/wav…) per user note.
// Controls row:
//   - All / Favorites filter tabs in the top-right (Figma 58:8, 58:4).
// Rows:
//   - Filtered list of AudioRow components (favorites only when that tab is active).
export default function AudioTable({
  tracks,
  playingId,
  timelineId,
  hydrated,
  filter,                 // 'all' | 'favorites'
  onFilterChange,
  onExtract,
  onExtractFromLink,
  onTogglePlay,
  onAddToTimeline,
  onToggleFavorite,
  onDelete,
}) {
  const fileInputRef = useRef(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)

  function handleClickExtract() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) onExtract(file)
    e.target.value = ''
  }

  async function handleLinkSubmit(e) {
    e?.preventDefault?.()
    const url = linkUrl.trim()
    if (!url || linkBusy) return
    setLinkBusy(true)
    try {
      await onExtractFromLink?.(url)
      setLinkUrl('')
    } finally {
      setLinkBusy(false)
    }
  }

  // Filter the tracks list. The 'favorites' tab shows only flagged rows; the
  // 'all' tab shows everything (no filtering).
  const visibleTracks = filter === 'favorites'
    ? tracks.filter((t) => t.favorite)
    : tracks

  return (
    <div
      className="relative"
      style={{
        width: 382,
        borderRadius: 34,
        background: '#000000',
        padding: 20,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        // Accept video AND audio (per user note: not just video). Browsers'
        // decodeAudioData handles mp4/mov/webm + mp3/m4a/wav/ogg interchangeably.
        accept="video/*,audio/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Extract-from-link input — Figma node 57:18 (342 × 38, rounded 99) */}
      <form onSubmit={handleLinkSubmit}>
        <div
          className="relative flex items-center"
          style={{
            width: 342,
            height: 38,
            borderRadius: 99,
            border: '1px solid rgba(255,255,255,0.10)',
            padding: '0 10px',
            gap: 10,
          }}
        >
          <LinkIcon size={15} color="rgba(255,255,255,0.80)" />
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Extract from link"
            className="flex-1 bg-transparent outline-none font-sf text-[12px] leading-[14px] text-white placeholder:text-white/80"
            disabled={linkBusy}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
          <button
            type="submit"
            disabled={!linkUrl.trim() || linkBusy}
            className="flex items-center justify-center transition active:scale-95 disabled:opacity-50"
            style={{ width: 24, height: 24 }}
            aria-label="Extract from URL"
          >
            {linkBusy ? (
              <span
                className="inline-block w-[16px] h-[16px] rounded-full border-2 border-white/30 border-t-white animate-spin"
                aria-hidden
              />
            ) : (
              <SendCircleIcon size={24} color="rgba(255,255,255,0.80)" />
            )}
          </button>
        </div>
      </form>

      {/* Extract-from-video file-picker — Figma node 57:60 (342 × 55, blue, rounded 99) */}
      <button
        onClick={handleClickExtract}
        className="relative flex items-center justify-center transition active:scale-[0.99] hover:brightness-110 mt-[10px]"
        style={{
          width: 342,
          height: 55,
          borderRadius: 99,
          background: '#1a62ff',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <div className="flex items-center gap-2">
          <UploadIcon size={20} color="#fff" />
          <span className="font-sf text-white text-[16px] leading-[19px]">
            Extract audio from video
          </span>
        </div>
      </button>

      {/* Filter tabs — All / Favorites. Right-aligned per Figma controls row.
          Each tab is a 34×34 rounded-10 button; the active tab uses a slightly
          brighter blue background so the selection is unambiguous. */}
      <div
        className="relative mt-[10px] flex items-center justify-end"
        style={{ width: 342, height: 34, gap: 10 }}
      >
        <FilterTab
          active={filter === 'all'}
          onClick={() => onFilterChange?.('all')}
          aria-label="Show all audios"
        >
          <FolderIcon size={20} color={filter === 'all' ? '#fff' : 'rgba(255,255,255,0.80)'} />
        </FilterTab>
        <FilterTab
          active={filter === 'favorites'}
          onClick={() => onFilterChange?.('favorites')}
          aria-label="Show favorites"
        >
          <HeartIcon size={18} color={filter === 'favorites' ? '#cc3636' : 'rgba(255,255,255,0.80)'} />
        </FilterTab>
      </div>

      {/* Rows — filtered by `filter`. */}
      <div className="mt-[10px] flex flex-col gap-[10px]">
        <AnimatePresence initial={false}>
          {visibleTracks.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 55 }}
              exit={{ opacity: 0, x: -50, height: 0, marginTop: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ overflow: 'visible' }}
            >
              <AudioRow
                track={t}
                isPlaying={playingId === t.id}
                isAddedToTimeline={timelineId === t.id}
                isFavorite={!!t.favorite}
                onTogglePlay={() => onTogglePlay(t.id)}
                onAddToTimeline={() => onAddToTimeline(t.id)}
                onToggleFavorite={() => onToggleFavorite(t.id)}
                onDelete={() => onDelete(t.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {hydrated && visibleTracks.length === 0 && (
          <div
            className="mt-[6px] flex items-center justify-center font-sf text-white/50 text-[14px] text-center px-4"
            style={{ minHeight: 55 }}
          >
            {tracks.length === 0
              ? 'Tap "Extract audio from video" to add your first track'
              : 'No favorites yet — tap the heart on a swiped row to add one'}
          </div>
        )}
      </div>
    </div>
  )
}

// Tiny filter-tab button used at the top of the rows list. 34×34, rounded 10,
// white/10% bg at rest; the active tab brightens to white/18% bg.
function FilterTab({ active, onClick, children, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center transition active:scale-95"
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        background: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)',
        border: active ? '1px solid rgba(255,255,255,0.20)' : '1px solid transparent',
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
