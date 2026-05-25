import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'

// ─────────────────────────────────────────────────────────────────────────────
// Dev-server middleware: /api/extract-link?url=<URL>
//
// Lets the "Extract from link" input handle pages like TikTok / YouTube /
// Instagram by doing the work outside the browser.
//
// Strategy:
//   1. yt-dlp streaming: spawn yt-dlp with `-o -` so it downloads the audio
//      and writes it to stdout. We pipe stdout straight into the HTTP
//      response. Crucially, yt-dlp manages the HTTP headers it needs to
//      talk to the source CDN itself — there's no second fetch from our
//      side that could 403 because of a UA / client / IP mismatch.
//   2. tikwm fallback (TikTok only): if yt-dlp isn't installed or fails
//      before emitting any bytes, the free tikwm API returns a direct mp4
//      URL we can fetch normally.
//
// The response bytes go to the browser, which decodes them via
// AudioContext.decodeAudioData like any other source.
// ─────────────────────────────────────────────────────────────────────────────

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

// Stream the resolved tikwm mp4 back to the browser. Used only when yt-dlp
// has already failed and the URL is TikTok.
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
  res.statusCode = 200
  res.setHeader('Content-Type', mediaRes.headers.get('content-type') || 'video/mp4')
  const len = mediaRes.headers.get('content-length')
  if (len) res.setHeader('Content-Length', len)
  Readable.fromWeb(mediaRes.body).pipe(res)
}

function extractLinkPlugin() {
  return {
    name: 'extract-link-api',
    configureServer(server) {
      server.middlewares.use('/api/extract-link', async (req, res) => {
        // Parse ?url= off the request.
        const target = new URL(req.url, 'http://x').searchParams.get('url')
        if (!target) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'missing ?url=' }))
          return
        }

        // Prefer m4a/aac (Safari + iOS decode natively) then fall back to
        // whatever bestaudio yields. `-o -` writes the audio bytes to stdout
        // and `--no-warnings` keeps stderr quiet on success.
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
          proc = spawn('yt-dlp', args, { windowsHide: true })
        } catch (err) {
          // Synchronous spawn failure — fall back if TikTok, else 502.
          await respondFallback(target, res, err, 'yt-dlp spawn failed')
          return
        }

        let headersSent = false
        let stderrBuf = ''

        // First chunk on stdout means yt-dlp succeeded — flip to a 200 and
        // start streaming. Until then we hold the response so we can still
        // respond with a JSON error on failure.
        proc.stdout.once('data', (chunk) => {
          headersSent = true
          res.statusCode = 200
          res.setHeader(
            'Content-Type',
            // The container is whatever yt-dlp downloaded; the browser sniffs
            // by bytes so this header is mostly informational. mp4 covers
            // m4a and bare mp4 audio tracks.
            'audio/mp4',
          )
          res.write(chunk)
          proc.stdout.pipe(res)
        })

        proc.stderr.on('data', (d) => { stderrBuf += d.toString() })

        proc.on('error', async (err) => {
          // ENOENT = not installed; ECHILD etc. = killed.
          if (headersSent) {
            // Already streaming — best we can do is close the response.
            try { res.end() } catch {}
            return
          }
          await respondFallback(target, res, err, err?.code === 'ENOENT'
            ? 'yt-dlp not installed'
            : err?.message || 'yt-dlp error')
        })

        proc.on('close', async (code) => {
          if (headersSent) {
            // Bytes already flowing — let the pipe finish naturally.
            return
          }
          const lastLine = stderrBuf.trim().split('\n').slice(-1)[0] || `yt-dlp exited ${code}`
          await respondFallback(target, res, new Error(lastLine), lastLine)
        })
      })
    },
  }
}

// Try tikwm if the source is TikTok; otherwise return a 502 with diagnostic.
async function respondFallback(target, res, originalErr, reason) {
  if (res.headersSent || res.writableEnded) return
  if (isTikTok(target)) {
    try {
      await pipeTikwm(target, res)
      return
    } catch (e) {
      if (res.headersSent || res.writableEnded) return
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        error: `tikwm fallback failed: ${e?.message || e}`,
        ytDlp: reason,
      }))
      return
    }
  }
  res.statusCode = 502
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({
    error: 'Could not extract audio.',
    ytDlp: reason,
    hint: originalErr?.code === 'ENOENT'
      ? 'Install yt-dlp (winget install yt-dlp.yt-dlp) and restart the dev server.'
      : undefined,
  }))
}

export default defineConfig({
  plugins: [react(), extractLinkPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
