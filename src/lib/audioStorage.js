// Tiny IndexedDB wrapper for persisting extracted-audio tracks across reloads.
// Each track stores its WAV bytes (ArrayBuffer) plus metadata so it can be fully
// reconstructed (playable + waveform) without needing the original video.

const DB_NAME = 'audio-studio'
const DB_VERSION = 1
const STORE = 'tracks'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
  })
}

// Save a single track row.
export async function putTrack(track) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({
      id: track.id,
      name: track.name,
      duration: track.duration,
      peaks: Array.from(track.peaks),
      wavBytes: track.wavBytes,
      createdAt: track.createdAt ?? Date.now(),
      favorite: !!track.favorite,
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteTrack(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Return a hydrated list of tracks with playable blob URLs. Caller is responsible
// for revoking these URLs when tracks are removed.
export async function loadAllTracks() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      const items = (req.result || [])
        // Newest first — keeps the audio table descending across reloads.
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map((item) => {
          const blob = new Blob([item.wavBytes], { type: 'audio/wav' })
          return {
            id: item.id,
            name: item.name,
            duration: item.duration,
            peaks: new Float32Array(item.peaks),
            wavBytes: item.wavBytes,
            url: URL.createObjectURL(blob),
            createdAt: item.createdAt,
            favorite: !!item.favorite,
          }
        })
      resolve(items)
    }
    req.onerror = () => reject(req.error)
  })
}
