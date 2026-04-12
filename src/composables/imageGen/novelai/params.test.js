import { describe, expect, it } from 'vitest'
import {
  buildNovelAIInput,
  buildNovelAIReferenceParams,
  resolveNovelAIParams
} from './params'

describe('novelai params', () => {
  it('promotes a single reference image into V4 vibe transfer fields', () => {
    const resolved = resolveNovelAIParams(
      { model: 'nai-diffusion-4-full' },
      {
        referenceImage: 'YWJj',
        referenceInformationExtracted: 0.25,
        referenceStrength: 0.75
      }
    )

    expect(resolved.reference_image).toBe('')
    expect(resolved.reference_image_multiple).toEqual(['YWJj'])
    expect(resolved.reference_information_extracted_multiple).toEqual([0.25])
    expect(resolved.reference_strength_multiple).toEqual([0.75])
    expect(resolved.normalize_reference_strength_multiple).toBe(true)
  })

  it('downgrades non-V4 multi-reference payloads with one item into single-reference fields', () => {
    const resolved = resolveNovelAIParams(
      { model: 'nai-diffusion-3' },
      {
        referenceImageMultiple: ['YWJj'],
        referenceInformationExtractedMultiple: [0.4],
        referenceStrengthMultiple: [0.8]
      }
    )

    expect(resolved.reference_image).toBe('YWJj')
    expect(resolved.reference_information_extracted).toBe(1)
    expect(resolved.reference_strength).toBe(0.6)
    expect(resolved.reference_image_multiple).toEqual([])
    expect(resolved.reference_information_extracted_multiple).toEqual([])
    expect(resolved.reference_strength_multiple).toEqual([])
  })

  it('keeps reference parameter priority ordered as director > multi > single', () => {
    const directorResolved = resolveNovelAIParams(
      { model: 'nai-diffusion-4-5-full' },
      { directorReferenceImages: ['YWJj'] }
    )
    const multiResolved = resolveNovelAIParams(
      { model: 'nai-diffusion-4-full' },
      { referenceImageMultiple: ['YWJj', 'ZGVm'] }
    )
    const singleResolved = resolveNovelAIParams(
      { model: 'nai-diffusion-3' },
      { referenceImage: 'YWJj' }
    )

    expect(buildNovelAIReferenceParams(directorResolved).hasDirectorReference).toBe(true)
    expect(buildNovelAIReferenceParams(multiResolved).hasMultiReference).toBe(true)
    expect(buildNovelAIReferenceParams(singleResolved).hasSingleReference).toBe(true)
  })

  it('builds advanced prompt objects only when V4 prompt metadata is present', () => {
    expect(buildNovelAIInput('sky', {})).toBe('sky')

    expect(buildNovelAIInput('sky', {
      useCoords: true,
      characterPrompts: [{ prompt: 'hero' }]
    })).toEqual({
      caption: 'sky',
      use_coords: true,
      use_order: true,
      legacy_uc: false,
      char_captions: [{ prompt: 'hero' }]
    })
  })
})