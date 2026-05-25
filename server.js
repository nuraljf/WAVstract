// Production server — serves the Vite build + /api/extract-link
//
// Vite's dev-server middleware (vite.config.js) handles the extractor in
// development. Here we replicate the same logic with Express so Railway (or
// any Node host) can serve the full app without needing Vite running.

import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

// ── /api/extract-link ────────────────────────────────────────────────────────

function isTikTok(url) { return /tiktok\.com/i.test(url) }

async function tikwmResolve(url) {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`
  const res = await fetch(apiUrl)
  if (!res.ok) throw new Error(`tikwm HTTP ${res.status}`)
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.msg || 'tikwm error')
  const media = json.data?.play || json.data?.wmplay
  if (!media) throw new Error('tikwm returned no media URL')
  return media
}

async function pipeTikwm(target, res) {
  const mediaUrl = await tikwmResolve(target)
  const mediaRes = await fetch(mediaUrl, {
    headers: {
      Referer: 'https://www.tiktok.com/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  })
  if (!mediaRes.ok || !mediaRes.body) {
    throw new Error(`tikwm media fetch HTTP ${mediaRes.status}`)
  }
  res.status(200)
  const ct = mediaRes.headers.get('content-type')
  if (ct) res.setHeader('Content-Type', ct)
  const len = mediaRes.headers.get('content-length')
  if (len) res.setHeader('Content-Length', len)
  Readable.fromWeb(mediaRes.body).pipe(res)
}

async function respondFallback(target, res, originalErr, reason) {
  if (res.headersSent) return
  if (isTikTok(target)) {
    try {
      await pipeTikwm(target, res)
      return
    } catch (e) {
      if (res.headersSent) return
      res.status(502).json({
        error: `tikwm fallback failed: ${e?.message || e}`,
        ytDlp: reason,
      })
      return
    }
  }
  res.status(502).json({
    error: 'Could not extract audio.',
    ytDlp: reason,
    hint: originalErr?.code === 'ENOENT'
      ? 'yt-dlp is not installed on the server.'
      : undefined,
  })
}

app.get('/api/extract-link', (req, res) => {
  const target = req.query.url
  if (!target) {
    res.status(400).json({ error: 'missing ?url=' })
    return
  }

  const args = [
    '-f', 'bestaudio[ext=m4a]/bestaudio/best',
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '-o', '-',
    target,
  ]

  let proc
  try {
    proc = spawn('yt-dlp', args)
  } catch (err) {
    respondFallback(target, res, err, 'yt-dlp spawn failed')
    return
  }

  let headersSent = false
  let stderrBuf = ''

  proc.stdout.once('data', (chunk) => {
    headersSent = true
    res.status(200)
    res.setHeader('Content-Type', 'audio/mp4')
    res.write(chunk)
    proc.stdout.pipe(res)
  })

  proc.stderr.on('data', (d) => { stderrBuf += d.toString() })

  proc.on('error', (err) => {
    if (headersSent) { try { res.end() } catch {} return }
    respondFallback(target, res, err,
      err?.code === 'ENOENT' ? 'yt-dlp not installed' : err?.message)
  })

  proc.on('close', (code) => {
    if (headersSent) return
    const lastLine = stderrBuf.trim().split('\n').slice(-1)[0] || `yt-dlp exited ${code}`
    respondFallback(target, res, new Error(lastLine), lastLine)
  })
})

// ── Static site + SPA fallback ───────────────────────────────────────────────

app.use(express.static(join(__dirname, 'dist')))

// Any route not matched above (e.g. /some/deep/link) returns index.html so
// the React router can handle it client-side.
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`WAVstract running on port ${PORT}`)
})
