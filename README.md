# Kepkat

Kepkat is a lightweight video editor that runs entirely in the browser. Cut clips, arrange multiple tracks, apply filters and transitions, grade color, add animated text, and export the result without uploading media to a server.

**Live demo:** [https://kepkat-psi.vercel.app/](https://kepkat-psi.vercel.app/)

All editing and rendering happen on the user's device. Projects and media are stored locally in IndexedDB, so there is no account, backend, or cloud connection.

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

## Tech stack

- React 19 and TypeScript
- Vite
- Zustand and Immer
- IndexedDB through `idb`
- WebGL2 for compositing and visual effects
- Web Audio API for audio mixing
- MediaRecorder and ffmpeg.wasm for export
- Radix UI for interface primitives

## Run locally

Node.js 24 is recommended.

```bash
npm install
npm run dev
```

Open the address Vite prints, usually `http://localhost:5173`.

Other commands:

```bash
npm run lint      # check code quality
npm run build     # create a production build in dist
npm run preview   # serve the production build locally
```

## Deploy

Kepkat is a static app and can be deployed to Vercel or any static host.

Vercel settings:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

No environment variables or backend are required.

## Notes

- MP4 export uses ffmpeg.wasm. The first load downloads about 32 MB of core files, so it can take longer than the video duration.
- WebM export records in real time; keep the tab active during export.
- The browser must support WebGL2 and MediaRecorder.
- Media and projects are never uploaded anywhere. Clearing site data in the browser also removes saved projects.
