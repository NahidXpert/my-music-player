# ROGUE

ROGUE is a local-first music player PWA. Audio files are read in the browser and are never uploaded.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. Use `npm run build` for a production build and `npm run preview` to serve that build.

## Features

- Multi-file picker and drag-and-drop import with embedded title, artist, album, duration, and cover extraction.
- IndexedDB persistence for imported file blobs, metadata, favorites, playlists, recently played IDs, and volume.
- HTML5 audio playback with seek, volume/mute, shuffle, repeat off/all/one, previous/next, queue, and Media Session controls where supported.
- Installable application shell with a manifest and service worker. The service worker caches the app shell and static assets, not original audio files.
- Keyboard controls: `Space` play/pause, `ArrowLeft`/`ArrowRight` seek five seconds, `N` next, `P` previous, `Escape` closes dialogs and queue.

## Browser limitations

IndexedDB blob storage and persistent file access vary by browser and available quota. If a browser evicts the stored file or refuses to persist it, ROGUE reports a playback error and the file must be imported again. The app does not delete original files. Service-worker offline support covers the application shell only; it does not guarantee offline access to source audio files.

Media Session and installation support depend on the browser and operating system. The app handles unavailable APIs without requiring them.
