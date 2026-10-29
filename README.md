# ROGUE

ROGUE is a local-first music player for your browser. Import audio files from your device, organize them into playlists, and listen without an account or upload service.

## Highlights

- Import multiple audio files through the file picker or drag and drop.
- Read embedded title, artist, album, duration, and cover-art metadata when available.
- Store tracks, artwork, favorites, playlists, recent tracks, and volume locally in IndexedDB.
- Play, pause, seek, skip, shuffle, repeat, mute, and control volume.
- Use a queue and browser Media Session controls where supported.
- Install the application shell as a PWA.
- Search the current view and navigate with keyboard shortcuts.

Supported file extensions include:

`mp3`, `wav`, `flac`, `m4a`, `aac`, `ogg`, `oga`, `opus`, and `webm`

## Privacy and storage

Audio files are read and played in the browser. ROGUE does not upload them to a server and does not require an account. Imported files and library data are stored in the browser's IndexedDB storage.

The service worker caches the application shell and static assets, not the original audio files. Browser storage quotas and eviction policies vary, so a track may need to be imported again if its stored data is removed or unavailable.

## Requirements

- Node.js 18 or newer
- A modern browser with IndexedDB and HTML5 audio support

## Development

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Open the local URL printed in the terminal.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and create a production build |
| `npm run test` | Run the Vitest test suite |
| `npm run preview` | Preview the production build locally |

## Controls

| Key | Action |
| --- | --- |
| `Space` | Play or pause |
| `ArrowLeft` | Seek backward five seconds |
| `ArrowRight` | Seek forward five seconds |
| `N` | Play the next track |
| `P` | Play the previous track |
| `Escape` | Close dialogs and the queue |

## Project structure

```text
public/              PWA manifest, icons, and service worker
src/App.tsx          Main application and player interface
src/lib/db.ts        IndexedDB persistence
src/lib/metadata.ts  Audio metadata and duration extraction
src/lib/models.ts    Shared data types and formatting helpers
src/lib/queue.ts     Queue navigation logic
```

## Browser limitations

Media Session, PWA installation, persistent storage, and some audio codecs depend on the browser and operating system. ROGUE handles unavailable optional APIs, but playback and storage behavior may differ across browsers.
