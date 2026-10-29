import { parseBlob, selectCover } from 'music-metadata-browser'
import type { Track } from './models'

const supportedAudio = /\.(mp3|wav|flac|m4a|aac|ogg|oga|opus|webm)$/i
const mimeByExtension: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4',
  aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm',
}

function mimeTypeFor(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return file.type || mimeByExtension[extension] || 'audio/mpeg'
}

async function copyAudioBlob(file: File) {
  const bytes = await file.arrayBuffer()
  return new Blob([bytes], { type: mimeTypeFor(file) })
}

export function isSupportedAudio(file: File) {
  return file.type.startsWith('audio/') || supportedAudio.test(file.name)
}

function filenameTitle(name: string) {
  return name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled track'
}

export async function readTrack(file: File): Promise<Track> {
  if (!isSupportedAudio(file)) throw new Error(`${file.name} is not a supported audio file.`)
  const audio = await copyAudioBlob(file)
  const id = await fingerprint(file)
  let title = filenameTitle(file.name)
  let artist = 'Unknown artist'
  let album = 'Unknown album'
  let artwork: Blob | undefined
  try {
    const metadata = await parseBlob(audio, { skipCovers: false })
    title = metadata.common.title?.trim() || title
    artist = metadata.common.artist?.trim() || artist
    album = metadata.common.album?.trim() || album
    const cover = selectCover(metadata.common.picture)
    if (cover) artwork = new Blob([new Uint8Array(cover.data)], { type: cover.format || 'image/jpeg' })
  } catch {
    // Some valid browser audio files do not expose parseable container tags.
  }
  const duration = await readDuration(audio)
  return { id, title, artist, album, duration, addedAt: Date.now(), fileName: file.name, mimeType: audio.type, file: audio, artwork, favorite: false }
}

async function readDuration(file: Blob) {
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
