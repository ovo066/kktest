import { describe, expect, it } from 'vitest'
import { buildMusicContextBlock } from './musicContext'

describe('musicContext', () => {
  it('builds empty block for empty context', () => {
    expect(buildMusicContextBlock(null)).toBe('')
  })

  it('builds block from structured context', () => {
    const output = buildMusicContextBlock({
      title: 'Song',
      artist: 'Artist',
      isPlaying: true,
      progress: 30,
      duration: 120,
      listenTogether: true
    })

    expect(output).toContain('<music_context>')
    expect(output).toContain('Song')
    expect(output).toContain('Artist')
    expect(output).toContain('进度：00:30 / 02:00')
  })
})
