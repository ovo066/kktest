import { describe, expect, it } from 'vitest'
import { cleanCharacterPrompt, resolveCharacterMeta } from './characterMeta'

describe('meet character meta helpers', () => {
  it('cleans chat-only prompt directives before prompt reuse', () => {
    const cleaned = cleanCharacterPrompt(`你正在和用户手机聊天
输出规则：不要分段
保持口语化
温柔学姐，擅长安慰人`)

    expect(cleaned).toBe('温柔学姐，擅长安慰人')
  })

  it('prefers meeting description and falls back to contact prompt', () => {
    const meta = resolveCharacterMeta({
      contactsStore: {
        contacts: [
          { id: 'c1', name: '小雨', prompt: '你正在和用户手机聊天\n温柔学姐，擅长安慰人' }
        ]
      },
      meetStore: {
        currentMeeting: {
          characters: [
            { contactId: 'c1', vnName: '雨', vnDescription: '' }
          ]
        }
      },
      characterResourcesStore: {
        getEntry() {
          return { basePrompt: '备用描述' }
        }
      }
    }, 'c1', '')

    expect(meta.displayName).toBe('雨')
    expect(meta.description).toBe('温柔学姐，擅长安慰人')
    expect(meta.charRes.basePrompt).toBe('备用描述')
  })
})
