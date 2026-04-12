import { describe, expect, it } from 'vitest'
import {
  buildBackgroundPrompt,
  buildCgPrompt,
  buildNanoBananaEditPrompt,
  buildSpritePrompt,
  compactCharacterDescription
} from './resourcePrompts'

describe('meet resource prompts', () => {
  it('adds background-only qualifiers when needed', () => {
    expect(buildBackgroundPrompt('park', 'park')).toContain('background only')
    expect(buildCgPrompt('scene', 'scene')).toContain('visual novel CG')
  })

  it('compacts character descriptions for sprite prompts', () => {
    expect(compactCharacterDescription('<b>Alice</b> [meta] brave friend')).toBe('Alice brave friend')
  })

  it('keeps explicit sprite prompts intact and builds fallback prompts from metadata', () => {
    expect(buildSpritePrompt(
      { expression: 'happy', prompt: 'hero sprite, upper body portrait' },
      { displayName: 'Hero', description: '', charRes: {} }
    )).toBe('hero sprite, upper body portrait')

    const built = buildSpritePrompt(
      { expression: 'happy', prompt: '' },
      {
        displayName: 'Hero',
        description: 'brave friend',
        charRes: { artistTags: 'anime', basePrompt: 'blue eyes' }
      }
    )

    expect(built).toContain('Hero')
    expect(built).toContain('happy expression')
    expect(built).toContain('white background')
  })

  it('builds nanobanana edit prompts', () => {
    expect(buildNanoBananaEditPrompt('Hero', 'smile')).toContain('change only the facial expression to "smile"')
  })
})
