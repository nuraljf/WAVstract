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
// Resolution order:
//   1. yt-dlp (-g): grab the direct media URL from the page. Supports almost
//      every video site. Requires `yt-dlp` on the user's PATH.
//   2. tikwm.com fallback: if yt-dlp isn't installed or errors out AND the
//      URL is TikTok, ask the free tikwm public API for a direct mp4 URL.
//
// Then fetch the resolved media URL with a sane Referer (TikTok CDNs require
// it) and stream the bytes back to the browser, which decodes them via
// AudioContext.decodeAudioData like any other source.
// ─────────────────────────────────────────────────────────────────────────────

function ytDlpResolve(url) {
  // `yt-dlp -g` prints one or more direct media URLs (audio + video on
  // separate lines for some sites). We take the first one — for "bestaudio"
  // format selection that's already the audio-only stream when available.
  return new Promise((resolve, reject) => {
    let proc
    try {
      proc = spawn('yt-dlp', ['-g', '-f', 'bestaudio/best', '--no-playlist', url], {
        windowsHide: true,
      })
    } catch (e) {
      reject(e)
      return
    }
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('error', (err) => {
      // ENOENT = yt-dlp not installed → caller should fall back.
      reject(err)
    })
    proc.on('close', (code) => {
      if (code === 0) {
        const first = stdout.trim().split('\n').filter(Boolean)[0]
        if (first) resolve(first)
        else reject(new Error('yt-dlp returned no URL'))
      } else {
        reject(new Error(stderr.trim().split('\n').slice(-1)[0] || `yt-dlp exited ${code}`))
      }
    })
  })
}

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

function isTikTok(url) { return /tiktok\.com/i.test(url) }

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

        const tried = []
        let mediaUrl = null
        let lastErr = null

        // 1) yt-dlp
        try {
          mediaUrl = await ytDlpResolve(target)
          tried.push('yt-dlp ✓')
        } catch (err) {
          tried.push(`yt-dlp ✗ (${err?.code === 'ENOENT' ? 'not installed' : err?.message || 'failed'})`)
          lastErr = err
        }

        // 2) tikwm fallback (TikTok only)
        if (!mediaUrl && isTikTok(target)) {
          try {
            mediaUrl = await tikwmResolve(target)
            tried.push('tikwm ✓')
          } catch (err) {
            tried.push(`tikwm ✗ (${err?.message || 'failed'})`)
            lastErr = err
          }
        }

        if (!mediaUrl) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            error: 'Could not resolve media URL.',
            tried,
            hint: lastErr?.code === 'ENOENT'
              ? 'Install yt-dlp (pip install yt-dlp) for full site support.'
              : undefined,
          }))
          return
        }

        // 3) Fetch the resolved media URL and stream it back to the browser.
        try {
          const mediaRes = await fetch(mediaUrl, {
            headers: {
              // TikTok CDN requires a same-site referer to avoid 403.
              Referer: isTikTok(target) ? 'https://www.tiktok.com/' : '',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            },
          })
          if (!mediaRes.ok || !mediaRes.body) {
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: `Media fetch failed: HTTP ${mediaRes.status}`,
              resolvedFrom: tried,
            }))
            return
          }
          res.statusCode = 200
          res.setHeader(
            'Content-Type',
            mediaRes.headers.get('content-type') || 'audio/mpeg',
          )
          const len = mediaRes.headers.get('content-length')
          if (len) res.setHeader('Content-Length', len)
          Readable.fromWeb(mediaRes.body).pipe(res)
        } catch (err) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err?.message || 'fetch failed' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), extractLinkPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
