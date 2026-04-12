import { describe, expect, it } from 'vitest'
import {
  favoritePartIndexToKey,
  getStoredFavoritePartIndexes,
  isMessagePartFavorited,
  setMessagePartFavorited,
  toggleMessagePartFavorite
} from './messageFavorites'

describe('messageFavorites', () => {
  it('toggles favorites by specific part index', () => {
    const message = { id: 'm1', content: '第一句\n第二句' }

    expect(toggleMessagePartFavorite(message, 0)).toBe(true)
    expect(isMessagePartFavorited(message, 0)).toBe(true)
    expect(isMessagePartFavorited(message, 1)).toBe(false)
    expect(message.favoritePartIndexes).toEqual([0])

    expect(toggleMessagePartFavorite(message, 0)).toBe(false)
    expect(isMessagePartFavorited(message, 0)).toBe(false)
    expect(message.favoritePartIndexes).toEqual([])
  })

  it('keeps legacy whole-message favorites readable', () => {
    const message = { id: 'm1', content: '旧收藏', favorited: true }
    expect(getStoredFavoritePartIndexes(message)).toEqual([null])
    expect(isMessagePartFavorited(message, 0)).toBe(true)
    expect(favoritePartIndexToKey(null)).toBe('message')
  })

  it('can add a specific part favorite without relying on the legacy flag', () => {
    const message = { id: 'm1', content: '第一句\n第二句' }
    expect(setMessagePartFavorited(message, 1, true)).toBe(true)
    expect(message.favorited).toBe(false)
    expect(message.favoritePartIndexes).toEqual([1])
  })
})
