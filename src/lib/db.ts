import type { PersistedState, Playlist, Track } from './models'

const DB_NAME = 'rogue-local-library'
const DB_VERSION = 2
const TRACKS = 'tracks'
const FILES = 'files'
const ARTWORK = 'artwork'
const PLAYLISTS = 'playlists'
const META = 'meta'

type TrackRecord = Omit<Track, 'file' | 'artwork'>
type BlobRecord = { id: string; blob: Blob }

let writeChain = Promise.resolve()

function enqueue<T>(work: () => Promise<T>) {
  const run = writeChain.then(work, work)
  writeChain = run.then(() => undefined, () => undefined)
  return run
}

export function storageErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : ''
  if (name === 'QuotaExceededError') return 'Not enough browser storage to keep these audio files. Free some space or remove tracks, then import again.'
  if (name === 'DataCloneError') return 'This browser could not store one of the audio files. Import the files again.'
  return 'Could not save library changes locally.'
}

export async function requestPersistentStorage() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Persistence is optional; playback still works for this session.
  }
}

function metadataOf(track: Track): TrackRecord {
  const { file: _file, artwork: _artwork, ...meta } = track
  return meta
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Unable to open local library storage.'))
    request.onblocked = () => reject(new Error('Local library storage is blocked by another tab.'))
    request.onupgradeneeded = (event) => {
      const db = request.result
      const tx = request.transaction
      if (!tx) return
      if (!db.objectStoreNames.contains(TRACKS)) db.createObjectStore(TRACKS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PLAYLISTS)) db.createObjectStore(PLAYLISTS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' })
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(ARTWORK)) db.createObjectStore(ARTWORK, { keyPath: 'id' })
      if (event.oldVersion < 2 && db.objectStoreNames.contains(TRACKS)) {
        const tracks = tx.objectStore(TRACKS)
        const files = tx.objectStore(FILES)
        const covers = tx.objectStore(ARTWORK)
        tracks.openCursor().onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (!cursor) return
          const value = cursor.value as Track
          if (value.file) {
            const filePut = files.put({ id: value.id, blob: value.file })
            filePut.onerror = (putEvent) => putEvent.preventDefault()
          }
          if (value.artwork) {
            const artPut = covers.put({ id: value.id, blob: value.artwork })
            artPut.onerror = (putEvent) => putEvent.preventDefault()
          }
          cursor.update(metadataOf(value))
          cursor.continue()
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function waitForTransaction(tx: IDBTransaction, db: IDBDatabase) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Local library storage failed.')) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Local library storage was aborted.')) }
  })
}

function emptyState(): PersistedState {
  return { tracks: [], playlists: [], recentTrackIds: [], volume: 0.8 }
}

export async function loadState(): Promise<PersistedState> {
  if (!('indexedDB' in window)) return emptyState()
  return enqueue(async () => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([TRACKS, FILES, ARTWORK, PLAYLISTS, META], 'readonly')
      const tracksRequest = tx.objectStore(TRACKS).getAll()
      const filesRequest = tx.objectStore(FILES).getAll()
      const artworkRequest = tx.objectStore(ARTWORK).getAll()
      const playlistsRequest = tx.objectStore(PLAYLISTS).getAll()
      const recentRequest = tx.objectStore(META).get('recentTrackIds')
      const volumeRequest = tx.objectStore(META).get('volume')
      tx.oncomplete = () => {
        db.close()
        const files = new Map((filesRequest.result as BlobRecord[]).map((item) => [item.id, item.blob]))
        const covers = new Map((artworkRequest.result as BlobRecord[]).map((item) => [item.id, item.blob]))
        const tracks = (tracksRequest.result as TrackRecord[]).map((track) => {
          const stored = files.get(track.id)
          const blob = stored && stored.size > 0 ? stored : new Blob([], { type: track.mimeType })
          return { ...track, file: blob, artwork: covers.get(track.id) }
        })
        resolve({
          tracks,
          playlists: playlistsRequest.result as Playlist[],
          recentTrackIds: (recentRequest.result?.value as string[] | undefined) ?? [],
          volume: (volumeRequest.result?.value as number | undefined) ?? 0.8,
        })
      }
      tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Unable to load local library.')) }
    })
  })
}

export async function saveTracks(tracks: Track[]) {
  if (!tracks.length) return
  return enqueue(async () => {
    await requestPersistentStorage()
    const db = await openDb()
    const tx = db.transaction([TRACKS, FILES, ARTWORK], 'readwrite')
    const metaStore = tx.objectStore(TRACKS)
    const fileStore = tx.objectStore(FILES)
    const artStore = tx.objectStore(ARTWORK)
    for (const track of tracks) {
      metaStore.put(metadataOf(track))
      if (track.file?.size) fileStore.put({ id: track.id, blob: track.file })
      if (track.artwork?.size) artStore.put({ id: track.id, blob: track.artwork })
    }
    await waitForTransaction(tx, db)
  })
}

export async function saveTrackMetadata(tracks: Track[]) {
  return enqueue(async () => {
    const db = await openDb()
    const tx = db.transaction(TRACKS, 'readwrite')
    const store = tx.objectStore(TRACKS)
    for (const track of tracks) store.put(metadataOf(track))
    await waitForTransaction(tx, db)
  })
}

export async function removeTrack(id: string) {
  return enqueue(async () => {
    const db = await openDb()
    const tx = db.transaction([TRACKS, FILES, ARTWORK, PLAYLISTS], 'readwrite')
    tx.objectStore(TRACKS).delete(id)
    tx.objectStore(FILES).delete(id)
    tx.objectStore(ARTWORK).delete(id)
    tx.objectStore(PLAYLISTS).getAll().onsuccess = (event) => {
      const playlists = (event.target as IDBRequest<Playlist[]>).result
      playlists.forEach((playlist) => tx.objectStore(PLAYLISTS).put({
        ...playlist,
        trackIds: playlist.trackIds.filter((trackId) => trackId !== id),
        updatedAt: Date.now(),
      }))
    }
    await waitForTransaction(tx, db)
  })
}

export async function savePlaylists(playlists: Playlist[]) {
  return enqueue(async () => {
    const db = await openDb()
    const tx = db.transaction(PLAYLISTS, 'readwrite')
    playlists.forEach((playlist) => tx.objectStore(PLAYLISTS).put(playlist))
    await waitForTransaction(tx, db)
  })
}

export async function removePlaylist(id: string) {
  return enqueue(async () => {
    const db = await openDb()
    const tx = db.transaction(PLAYLISTS, 'readwrite')
    tx.objectStore(PLAYLISTS).delete(id)
    await waitForTransaction(tx, db)
  })
}

export async function savePreferences(recentTrackIds: string[], volume: number) {
  return enqueue(async () => {
    const db = await openDb()
    const tx = db.transaction(META, 'readwrite')
    tx.objectStore(META).put({ key: 'recentTrackIds', value: recentTrackIds })
    tx.objectStore(META).put({ key: 'volume', value: volume })
    await waitForTransaction(tx, db)
  })
}
