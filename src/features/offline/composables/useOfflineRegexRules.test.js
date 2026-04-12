import { describe, expect, it } from 'vitest'
import {
  collectImportedRegexRules,
  normalizeOfflineRegexRules,
  normalizeRegexScope,
  parseRegexLiteral,
  resolveOfflineRegexBindings
} from '../../../utils/offlineRegex'

describe('offline regex helpers', () => {
  it('parses regex literal and keeps explicit flags', () => {
    expect(parseRegexLiteral('/猫(咪)?/giu')).toEqual({
      pattern: '猫(咪)?',
      flags: 'giu'
    })
  })

  it('normalizes legacy scope markers', () => {
    expect(normalizeRegexScope({ placement: 'assistant' })).toBe('display')
    expect(normalizeRegexScope({ promptOnly: true })).toBe('prompt')
    expect(normalizeRegexScope({ placements: ['assistant', 'user'] })).toBe('both')
  })

  it('collects and dedupes imported rules from nested payloads', () => {
    const rules = collectImportedRegexRules({
      scripts: [
        {
          name: 'A',
          findRegex: '/foo/gi',
          replaceString: 'bar',
          placement: 'assistant'
        },
        {
          name: 'B',
          regex: '/foo/gi',
          replacement: 'bar',
          placement: 'display'
        },
        {
          title: 'C',
          pattern: 'baz',
          flags: 'i',
          target: 'user'
        }
      ]
    })

    expect(rules).toEqual([
      {
        name: 'A',
        enabled: true,
        scope: 'display',
        pattern: 'foo',
        flags: 'gi',
        replacement: 'bar',
        order: 0
      },
      {
        name: 'C',
        enabled: true,
        scope: 'prompt',
        pattern: 'baz',
        flags: 'i',
        replacement: '',
        order: 1
      }
    ])
  })

  it('resolves global, character and preset regex in binding order', () => {
    const resolved = resolveOfflineRegexBindings({
      globalRules: normalizeOfflineRegexRules([
        { name: 'global', pattern: 'foo', replacement: 'G', scope: 'both', order: 0 }
      ]),
      characterRules: normalizeOfflineRegexRules([
        { name: 'character', pattern: 'bar', replacement: 'C', scope: 'display', order: 0 }
      ]),
      presetRules: normalizeOfflineRegexRules([
        { name: 'preset', pattern: 'baz', replacement: 'P', scope: 'prompt', order: 0 }
      ])
    })

    expect(resolved.combinedRules.map(rule => [rule.bindingScope, rule.name])).toEqual([
      ['global', 'global'],
      ['character', 'character'],
      ['preset', 'preset']
    ])
  })
})
