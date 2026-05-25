# WAVstract

Extract audio from videos and direct links. Built with React + Vite.

## Features
- Drop in a video/audio file → extract clean WAV
- Paste a TikTok / YouTube / Instagram URL → server-side extraction via `yt-dlp` (with tikwm fallback for TikTok)
- Timeline with waveform, playhead, scrubbing
- Speed (0–2x with pitch coupling) and Volume (0–1000% via Web Audio gain) controls
- Library with favorites, swipe-to-reveal delete, and IndexedDB persistence across reloads

## Run locally
```bash
npm install
npm run dev
```

Open the printed `Network:` URL on a phone (same WiFi) to test on mobile.

## Notes
- Link extraction requires [yt-dlp](https://github.com/yt-dlp/yt-dlp) on your PATH. TikTok still works without it via the tikwm fallback.
