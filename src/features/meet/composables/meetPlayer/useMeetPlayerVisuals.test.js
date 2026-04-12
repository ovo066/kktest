import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useMeetPlayerVisuals } from './useMeetPlayerVisuals'

function createVisuals(overrides = {}) {
  const player = {
    currentBg: null,
    currentCg: null,
    currentBgm: null,
    currentLocation: '',
    currentTimeOfDay: '',
    currentDialog: null,
    sprites: [],
    ...(overrides.player || {})
  }
  const resources = overrides.resources || {}
  const scheduleSave = vi.fn()
  const resolveBackground = vi.fn().mockResolvedValue(null)
  const resolveCG = vi.fn().mockResolvedValue(null)
  const pickAutoBGM = vi.fn().mockResolvedValue(null)
  const getSpriteUrl = vi.fn().mockReturnValue(null)
  const ensureSprite = vi.fn().mockResolvedValue(null)
  const currentBgmUrl = ref(null)
  const meetStore = {
    getResource: vi.fn((type, key) => resources[type]?.[key] || null)
  }

  const visuals = useMeetPlayerVisuals({
    player,
    meetStore,
    scheduleSave,
    resolveBackground,
    resolveCG,
    pickAutoBGM,
    getSpriteUrl,
    ensureSprite,
    currentBgmUrl
  })

  return {
    currentBgmUrl,
    ensureSprite,
    getSpriteUrl,
    meetStore,
    pickAutoBGM,
    player,
    resolveBackground,
    scheduleSave,
    visuals
  }
}

describe('useMeetPlayerVisuals', () => {
  it('applies auto scene fixups for background and bgm', async () => {
    const { currentBgmUrl, pickAutoBGM, player, scheduleSave, visuals } = createVisuals({
      player: {
        currentLocation: '海边',
        currentTimeOfDay: '夜晚',
        currentDialog: { text: '晚风很轻。' }
      },
      resources: {
        backgrounds: {
          海边: { url: 'https://example.com/beach.jpg' }
        }
      }
    })
    pickAutoBGM.mockResolvedValue({
      name: 'night_theme',
      url: 'https://example.com/night.mp3'
    })

    await visuals.applyAutoSceneFixups({
      sawBg: false,
      sawBgm: false,
      sawCg: false,
      locationChanged: true,
      timeChanged: false
    })

    expect(player.currentBg).toEqual({
      name: '海边',
      url: 'https://example.com/beach.jpg'
    })
    expect(player.currentBgm).toBe('night_theme')
    expect(currentBgmUrl.value).toBe('https://example.com/night.mp3')
    expect(scheduleSave).toHaveBeenCalledTimes(1)
  })

  it('clears stale cg and refreshes bgm when the scene changes', async () => {
    const { currentBgmUrl, pickAutoBGM, player, scheduleSave, visuals } = createVisuals({
      player: {
        currentCg: { name: 'confession', url: 'https://example.com/confession.jpg', prompt: '' },
        currentBgm: 'day_theme',
        currentLocation: '海边',
        currentTimeOfDay: '夜晚',
        currentDialog: { text: '海风有点凉。' }
      }
    })
    pickAutoBGM.mockResolvedValue({
      name: 'night_theme',
      url: 'https://example.com/night.mp3'
    })

    await visuals.applyAutoSceneFixups({
      sawBg: true,
      sawBgm: false,
      sawCg: false,
      locationChanged: false,
      timeChanged: true
    })

    expect(player.currentCg).toBeNull()
    expect(player.currentBgm).toBe('night_theme')
    expect(currentBgmUrl.value).toBe('https://example.com/night.mp3')
    expect(scheduleSave).toHaveBeenCalledTimes(1)
  })

  it('uses cached backgrounds before triggering generation', async () => {
    const { player, resolveBackground, visuals } = createVisuals({
      resources: {
        backgrounds: {
          教室: { url: 'https://example.com/classroom.jpg' }
        }
      }
    })

    await visuals.handleBgInstruction({ type: 'bg', name: '教室' })

    expect(player.currentBg).toEqual({
      name: '教室',
      url: 'https://example.com/classroom.jpg'
    })
    expect(resolveBackground).not.toHaveBeenCalled()
  })

  it('restores snapshot sprites and resolves missing assets lazily', async () => {
    const { ensureSprite, getSpriteUrl, player, scheduleSave, visuals } = createVisuals()
    getSpriteUrl.mockReturnValueOnce('https://example.com/smile.png')
    ensureSprite.mockResolvedValueOnce('https://example.com/smile.generated.png')

    expect(visuals.applySnapshotMediaInstruction({
      type: 'sprite',
      characterId: 'c1',
      vnName: 'Alice',
      expression: 'smile',
      position: 'left'
    })).toBe(true)

    await Promise.resolve()

    expect(player.sprites).toEqual([
      {
        characterId: 'c1',
        vnName: 'Alice',
        expression: 'smile',
        position: 'left',
        animation: null,
        url: 'https://example.com/smile.generated.png',
        isExiting: false
      }
    ])
    expect(ensureSprite).toHaveBeenCalledWith({
      characterId: 'c1',
      vnName: 'Alice',
      expression: 'smile',
      prompt: '',
      isNew: false
    }, { allowGenerate: false })
    expect(scheduleSave).toHaveBeenCalledTimes(1)
  })
})
