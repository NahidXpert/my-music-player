import { describe, expect, it } from 'vitest'
import { nextTrack, previousTrack } from './queue'
import type { Track } from './models'

const tracks = ['a', 'b', 'c'].map((id) => ({ id } as Track))

describe('queue navigation', () => {
  it('advances and stops at the end when repeat is off', () => {
    expect(nextTrack('a', tracks, false, 'off')?.id).toBe('b')
    expect(nextTrack('c', tracks, false, 'off')).toBeUndefined()
  })

  it('wraps with repeat all and repeats the current track with repeat one', () => {
    expect(nextTrack('c', tracks, false, 'all')?.id).toBe('a')
    expect(nextTrack('b', tracks, false, 'one')?.id).toBe('b')
  })

  it('moves backwards and wraps to the final track', () => {
    expect(previousTrack('b', tracks)?.id).toBe('a')
    expect(previousTrack('a', tracks)?.id).toBe('c')
  })
})
