import type { PersistedState, Playlist, Track } from './models'

const DB_NAME = 'rogue-local-library'
const DB_VERSION = 1
const TRACKS = 'tracks'
const PLAYLISTS = 'playlists'
const META = 'meta'

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Unable to open local library storage.'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TRACKS)) db.createObjectStore(TRACKS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PLAYLISTS)) db.createObjectStore(PLAYLISTS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
  })
}

export async function loadState(): Promise<PersistedState> {
  if (!('indexedDB' in window)) return { tracks: [], playlists: [], recentTrackIds: [], volume: 0.8 }
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([TRACKS, PLAYLISTS, META], 'readonly')
    const tracksRequest = tx.objectStore(TRACKS).getAll()
    const playlistsRequest = tx.objectStore(PLAYLISTS).getAll()
    const recentRequest = tx.objectStore(META).get('recentTrackIds')
    const volumeRequest = tx.objectStore(META).get('volume')
    tx.oncomplete = () => {
      db.close()
      resolve({
        tracks: tracksRequest.result as Track[],
        playlists: playlistsRequest.result as Playlist[],
        recentTrackIds: (recentRequest.result?.value as string[] | undefined) ?? [],
        volume: (volumeRequest.result?.value as number | undefined) ?? 0.8,
      })
    }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Unable to load local library.')) }
  })
}

export async function saveTracks(tracks: Track[]) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TRACKS, 'readwrite')
    const store = tx.objectStore(TRACKS)
    tracks.forEach((track) => store.put(track))
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Unable to save tracks.')) }
  })
}

export async function removeTrack(id: string) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([TRACKS, PLAYLISTS], 'readwrite')
    tx.objectStore(TRACKS).delete(id)
    tx.objectStore(PLAYLISTS).getAll().onsuccess = (event) => {
      const playlists = (event.target as IDBRequest<Playlist[]>).result
      playlists.forEach((playlist) => tx.objectStore(PLAYLISTS).put({ ...playlist, trackIds: playlist.trackIds.filter((trackId) => trackId !== id), updatedAt: Date.now() }))
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Unable to remove track.')) }
  })
}

export async function savePlaylists(playlists: Playlist[]) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PLAYLISTS, 'readwrite')
    playlists.forEach((playlist) => tx.objectStore(PLAYLISTS).put(playlist))
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Unable to save playlists.')) }
  })
}

export async function removePlaylist(id: string) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PLAYLISTS, 'readwrite')
    tx.objectStore(PLAYLISTS).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Unable to remove playlist.')) }
  })
}

export async function savePreferences(recentTrackIds: string[], volume: number) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META, 'readwrite')
    tx.objectStore(META).put({ key: 'recentTrackIds', value: recentTrackIds })
    tx.objectStore(META).put({ key: 'volume', value: volume })
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Unable to save preferences.')) }
  })
}
