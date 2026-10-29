export type RepeatMode = 'off' | 'all' | 'one'

export type Track = {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  addedAt: number
  fileName: string
  mimeType: string
  file: Blob
  artwork?: Blob
  favorite: boolean
  lastPlayedAt?: number
}

export type Playlist = {
  id: string
  name: string
  trackIds: string[]
  createdAt: number
  updatedAt: number
}

export type PersistedState = {
  tracks: Track[]
  playlists: Playlist[]
  recentTrackIds: string[]
  volume: number
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remaining}`
}

export function toneForTrack(track: Pick<Track, 'id'>) {
  const tones = ['coral', 'violet', 'blue', 'gold', 'green', 'pink']
  return tones[Number.parseInt(track.id.slice(-2), 16) % tones.length] ?? 'coral'
}
