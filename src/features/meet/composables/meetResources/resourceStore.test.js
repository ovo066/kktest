import { describe, expect, it, vi } from 'vitest'
import { createMeetResourceStore, findNamedResource } from './resourceStore'

describe('meet resource store helpers', () => {
  it('matches named resources case-insensitively', () => {
    const result = findNamedResource({
      Cafe: { url: 'https://example.com/cafe.png' }
    }, 'cafe')

    expect(result).toEqual({ url: 'https://example.com/cafe.png' })
  })

  it('persists normal sprites to both meet resources and character resources', () => {
    const setResource = vi.fn()
    const setBaseImage = vi.fn()
    const setExpression = vi.fn()
    const store = createMeetResourceStore({
      characterResourcesStore: {
        setBaseImage,
        setExpression
      },
      contactsStore: {
        contacts: [{ id: 'c1' }]
      },
      meetStore: {
        currentMeeting: { resources: { backgrounds: {}, cgs: {}, bgm: {}, sfx: {} } },
        getResource: vi.fn(),
        setResource
      },
      normalizeMediaUrlForUse(url) {
        return url ? `normalized:${url}` : ''
      }
    })

    store.persistSprite('c1', 'normal', 'https://example.com/normal.png', { source: 'asset' })

    expect(setResource).toHaveBeenCalledTimes(2)
    expect(setResource).toHaveBeenNthCalledWith(1, 'sprites', 'c1_normal', {
      expression: 'normal',
      source: 'asset',
      url: 'normalized:https://example.com/normal.png'
    })
    expect(setResource).toHaveBeenNthCalledWith(2, 'sprites', 'c1_baseImage', {
      expression: 'normal',
      source: 'asset',
      url: 'normalized:https://example.com/normal.png'
    })
    expect(setBaseImage).toHaveBeenCalledWith('c1', {
      url: 'normalized:https://example.com/normal.png',
      seed: null,
      params: { source: 'meet' }
    })
    expect(setExpression).not.toHaveBeenCalled()
  })
})
