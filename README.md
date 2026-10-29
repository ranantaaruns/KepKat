# Kepkat

Kepkat is a lightweight video editor that runs in the browser. Cut clips, arrange multiple tracks, apply filters and transitions, grade color, add animated text, and export the result without uploading media to a server.

**Live demo:** [https://kepkat-psi.vercel.app/](https://kepkat-psi.vercel.app/)

All editing, preview, and rendering happen on the user's device. Projects and media are stored locally in IndexedDB. An optional AI assistant can propose edits using project metadata; it never receives video, audio, image files, thumbnails, or waveforms.

## Features

- Import video, images, and audio from your device.
- Multi-track timeline with trim, split, duplicate, snapping, zoom, and clip ordering.
- Filters, transitions, color grading, and RGB-based chroma key.
- Text with styles, fonts, animations, and keyframes for transform properties.
- Clip speed, audio volume, mute, and fade in/out.
- Real-time preview powered by WebGL2.
- WebM export in real time and MP4 export through ffmpeg.wasm.
- Automatic project saving in the browser.
- Responsive interface for desktop and smaller screens.
- English and Indonesian interface with a persistent language toggle.
- Optional AI editor chat with Confirm and Plan-only modes, powered by Nemotron 3.5 Lightning through NVIDIA NIM.

## Tech stack

- React 19 and TypeScript
- Vite
- Zustand and Immer
- IndexedDB through `idb`
- WebGL2 for compositing and visual effects
- Web Audio API for audio mixing
- MediaRecorder and ffmpeg.wasm for export
- Radix UI for interface primitives
- Vercel Functions, NVIDIA NIM, and Nemotron 3.5 Lightning for the optional AI assistant
- Upstash Redis and Cloudflare Turnstile for public AI rate limiting and verification

## Run locally

Node.js 24 is recommended.

```bash
npm install
npm run dev
```

Open the address Vite prints, usually `http://localhost:5173`.

The editor works without any environment variables. To try the AI panel locally, copy `.env.example` to `.env.local`, fill in the server keys, then run the API and Vite in separate terminals:

```bash
npm run dev:api   # local AI API on http://localhost:3000
npm run dev       # Vite, proxying /api to the local API
```

Other commands:

```bash
npm run lint      # check code quality
npm run test      # run unit tests
npm run build     # typecheck and create a production build in dist
npm run preview   # serve the production build locally
```

## AI setup

The AI panel is optional. Without `NVIDIA_API_KEY`, the editor still works and the panel reports that the server is not configured.

Required server variables:

```env
NVIDIA_API_KEY=nvapi-...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
AI_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
AI_FALLBACK_MODEL=
AI_MAX_OUTPUT_TOKENS=4096
AI_REASONING_EFFORT=none
```

The default model is Nemotron 3.5 Lightning. Set `AI_MODEL` to another NVIDIA model when needed. The server retries once with `AI_FALLBACK_MODEL` when it is set and the primary model id is unavailable (404 or 410).

Recommended public-site protection:

```env
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
TURNSTILE_SECRET_KEY=...
VITE_TURNSTILE_SITE_KEY=...
```

`VITE_TURNSTILE_SITE_KEY` is public by design. Never expose `NVIDIA_API_KEY`, Upstash tokens, or the Turnstile secret with a `VITE_` prefix.

The assistant receives a compact project snapshot: track and clip ids, names, timings, transform values, filters, transitions, text, and keyframes. Media blobs and preview data stay in the browser. The API keeps the NVIDIA key on the server, limits requests per IP (about 10 per hour and 50 per day, plus a global daily cap), and verifies Turnstile when configured.

## Deploy

The editor can still be hosted as a static app, but the AI panel needs the Vercel Function in `api/`.

Vercel settings:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 24

Add the AI variables from `.env.example` in the Vercel project settings and redeploy. Keep `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `TURNSTILE_SECRET_KEY` server-only.

If Turnstile is enabled, add the production domain and `localhost` to the Turnstile widget hostnames.

## Notes

- MP4 export uses ffmpeg.wasm. The first load downloads about 32 MB of core files, so it can take longer than the video duration.
- WebM export records in real time; keep the tab active during export.
- The browser must support WebGL2 and MediaRecorder.
- Media and projects are never uploaded. Clearing site data in the browser also removes saved projects.
- AI requests send project metadata to NVIDIA. On the NVIDIA trial API, inputs and outputs may be recorded for service improvement. Use a paid or self-hosted endpoint if that is not acceptable.
- The AI cannot see frames or hear audio. It works from timeline metadata and user instructions.
- AI plans are proposals. Nothing changes until Apply is pressed, and each plan is one undo step.
