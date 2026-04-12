import { describe, expect, it } from 'vitest'
import { defaultChoices, normalizeChoices } from './instructionHelpers'

describe('meet player instruction helpers', () => {
  it('provides stable fallback choices', () => {
    expect(defaultChoices()).toEqual([
      { text: '继续互动', effect: null },
      { text: '换个话题', effect: null }
    ])
  })

  it('normalizes options and drops empty entries', () => {
    expect(normalizeChoices([
      { text: '  继续  ', effect: 1 },
      { text: '' },
      { text: '换个话题', effect: null }
    ])).toEqual([
      { text: '继续', effect: '1' },
      { text: '换个话题', effect: null }
    ])
  })
})
