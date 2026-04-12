import { describe, expect, it } from 'vitest'
import { clampNumber, normalizePromptEntries, parseOptionalInteger } from './presetNormalization'

describe('presetNormalization', () => {
  it('normalizes prompt entries with shared defaults', () => {
    expect(normalizePromptEntries([
      null,
      {
        id: 'main',
        role: 'unexpected',
        content: '  hello  ',
        injection_depth: '12.8',
        position: 'before_prompt',
        order: '9.4'
      }
    ])).toEqual([
      {
        id: 'main',
        identifier: 'main',
        name: 'main',
        role: 'system',
        content: 'hello',
        enabled: true,
        injectionDepth: 13,
        injectionPosition: 'before_prompt',
        order: 9
      }
    ])
  })

  it('parses optional integers in clamp and strict modes', () => {
    expect(parseOptionalInteger('999999', { min: 1, max: 100, clamp: true })).toBe(100)
    expect(parseOptionalInteger('999999', { min: 1, max: 100 })).toBeNull()
    expect(parseOptionalInteger('', { min: 1, max: 100, clamp: true })).toBeNull()
    expect(clampNumber('1.7', 0, { min: 0, max: 5, integer: true })).toBe(2)
  })
})
