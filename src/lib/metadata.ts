import { parseBlob, selectCover } from 'music-metadata-browser'
import type { Track } from './models'

const supportedAudio = /\.(mp3|wav|flac|m4a|aac|ogg|oga|opus|webm)$/i

export function isSupportedAudio(file: File) {
  return file.type.startsWith('audio/') || supportedAudio.test(file.name)
}

function filenameTitle(name: string) {
  return name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled track'
}

export async function readTrack(file: File): Promise<Track> {
  if (!isSupportedAudio(file)) throw new Error(`${file.name} is not a supported audio file.`)
  const id = await fingerprint(file)
  let title = filenameTitle(file.name)
  let artist = 'Unknown artist'
  let album = 'Unknown album'
  let artwork: Blob | undefined
  try {
    const metadata = await parseBlob(file, { skipCovers: false })
    title = metadata.common.title?.trim() || title
    artist = metadata.common.artist?.trim() || artist
    album = metadata.common.album?.trim() || album
    const cover = selectCover(metadata.common.picture)
    if (cover) artwork = new Blob([cover.data], { type: cover.format })
  } catch {
    // Some valid browser audio files do not expose parseable container tags.
  }
  const duration = await readDuration(file)
  return { id, title, artist, album, duration, addedAt: Date.now(), fileName: file.name, mimeType: file.type || 'audio/mpeg', file, artwork, favorite: false }
}

async function readDuration(file: File) {
  return new Promise<number>((resolve) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(audio.duration) ? audio.duration : 0) }
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(0) }
    audio.src = url
  })
}

async function fingerprint(file: File) {
  const source = `${file.name}:${file.size}:${file.lastModified}`
  const bytes = new TextEncoder().encode(source)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].slice(0, 10).map((value) => value.toString(16).padStart(2, '0')).join('')
}
