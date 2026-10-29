import type { RepeatMode, Track } from './models'

export function nextTrack(currentId: string | undefined, queue: Track[], shuffle: boolean, repeat: RepeatMode) {
  if (!queue.length) return undefined
  if (repeat === 'one') return queue.find((track) => track.id === currentId) ?? queue[0]
  const currentIndex = queue.findIndex((track) => track.id === currentId)
  if (shuffle) {
    const candidates = queue.filter((track) => track.id !== currentId)
    return candidates[Math.floor(Math.random() * candidates.length)] ?? queue[0]
  }
  if (currentIndex >= 0 && currentIndex < queue.length - 1) return queue[currentIndex + 1]
  return repeat === 'all' ? queue[0] : undefined
}

export function previousTrack(currentId: string | undefined, queue: Track[]) {
  if (!queue.length) return undefined
  const index = queue.findIndex((track) => track.id === currentId)
  return queue[index > 0 ? index - 1 : queue.length - 1]
}
