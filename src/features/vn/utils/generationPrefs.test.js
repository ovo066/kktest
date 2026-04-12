import { describe, expect, it } from 'vitest'
import {
  normalizeGenerationPrefs,
  normalizeStrengths,
  resolveBaseSeed,
  resolveExpressionSeed,
  snapshotGenerationPrefs
} from './generationPrefs'

describe('vn generation prefs helpers', () => {
  it('normalizes legacy fields and invalid values', () => {
    expect(normalizeGenerationPrefs({
      fixedSeedEnabled: true,
      fixedSeed: '123.8',
      characterRefInfoExtracted: 0.2,
      characterRefStyleAware: false,
      vibeReferences: [
        { image: '  data:image/png;base64,abc  ', strength: 2, informationExtracted: -1 },
        { image: '' }
      ]
    })).toEqual({
      fixedSeedEnabled: true,
      fixedSeed: 124,
      reuseBaseSeedForExpressions: true,
      keepArtistTagsOnNonCharacterImage: false,
      characterRefEnabled: false,
      characterRefImage: '',
      characterRefImageRef: '',
      characterRefStrength: 0.65,
      characterRefFidelity: 0.2,
      characterRefMode: 'character_only',
      vibeReferences: [
        {
          id: expect.any(String),
          image: 'data:image/png;base64,abc',
          imageRef: '',
          strength: 1,
          informationExtracted: 0
        }
      ]
    })
  })

  it('drops disabled fixed seed when snapshotting and rescales vibe strengths', () => {
    expect(snapshotGenerationPrefs({
      fixedSeedEnabled: false,
      fixedSeed: 55,
      vibeReferences: [
        { id: 'a', image: '1', strength: 0.8, informationExtracted: 1 },
        { id: 'b', image: '2', strength: 0.7, informationExtracted: 1 }
      ]
    })).toMatchObject({
      fixedSeedEnabled: false,
      fixedSeed: null,
      vibeReferences: [
        { id: 'a' },
        { id: 'b' }
      ]
    })

    expect(normalizeStrengths([0.8, 0.7], 1)).toEqual([0.5333333333333333, 0.4666666666666666])
  })

  it('resolves base and expression seeds deterministically', () => {
    expect(resolveBaseSeed({ fixedSeedEnabled: true, fixedSeed: 77 }, () => 0.5)).toBe(77)
    expect(resolveExpressionSeed({ fixedSeedEnabled: false, reuseBaseSeedForExpressions: true }, 123, () => 0.1)).toBe(123)
    expect(resolveExpressionSeed({ fixedSeedEnabled: false, reuseBaseSeedForExpressions: false }, null, () => 0.5)).toBe(2147483647)
  })
})
