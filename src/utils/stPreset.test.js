import { describe, expect, it } from 'vitest'
import { parseSTPresetImportPayload, parseSTPresetPayload, summarizeSTPresetPayload } from './stPreset'

describe('stPreset', () => {
  it('parses sillytavern preset payloads into normalized preset data', () => {
    const presets = parseSTPresetPayload({
      presets: [
        {
          name: 'Import A',
          system_prompt: 'System prompt',
          temperature: '1.2',
          prompt_order: [
            {
              character_id: '100001',
              order: [{ identifier: 'main', enabled: true }]
            }
          ],
          prompt_entries: [
            {
              identifier: 'main',
              role: 'system',
              content: 'Main entry'
            }
          ]
        }
      ]
    })

    expect(presets).toEqual([
      expect.objectContaining({
        name: 'Import A',
        source: 'sillytavern',
        systemPrompt: 'System prompt',
        temperature: 1.2,
        promptEntries: [
          expect.objectContaining({
            identifier: 'main',
            role: 'system',
            content: 'Main entry',
            enabled: true
          })
        ]
      })
    ])
  })

  it('summarizes imported presets for preview UI', () => {
    const summary = summarizeSTPresetPayload({
      items: [
        {
          title: 'Preset One',
          prompts: [
            {
              id: 'intro',
              role: 'assistant',
              text: 'Hello'
            }
          ]
        },
        {
          title: 'Preset Two',
          systemPrompt: 'Secondary system prompt'
        }
      ]
    })

    expect(summary).toEqual({
      valid: true,
      presetCount: 2,
      promptPresetCount: 1,
      totalEntries: 1,
      totalRegexRules: 0,
      names: ['Preset One', 'Preset Two']
    })
  })

  it('attaches bundled regex rules when importing offline presets', () => {
    const presets = parseSTPresetImportPayload({
      preset: {
        title: 'Preset With Regex',
        prompts: [
          {
            id: 'intro',
            role: 'system',
            text: 'Hello'
          }
        ]
      },
      scripts: [
        {
          scriptName: 'Hide narrator',
          findRegex: '/\\[旁白\\]/g',
          replaceString: '',
          placement: 'assistant'
        }
      ]
    })

    expect(presets).toEqual([
      expect.objectContaining({
        name: 'Preset With Regex',
        regexRules: [
          expect.objectContaining({
            name: 'Hide narrator',
            pattern: '\\[旁白\\]',
            replacement: '',
            scope: 'display'
          })
        ]
      })
    ])
  })
})
