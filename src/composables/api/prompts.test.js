import { describe, expect, it } from 'vitest'
import {
  buildChatFormatSystemPrompt,
  buildImageGenerationPrompt,
  buildStickerSystemPrompt,
  buildUnifiedSystemPrompt,
  insertLorebookEntries
} from './prompts'
import {
  createChatFormatPresetBook,
  createImageGenerationPresetBook
} from '../../utils/presetPromptBooks'

describe('buildStickerSystemPrompt', () => {
  it('filters sticker labels by the active contact sticker groups', () => {
    const store = {
      allowAIStickers: true,
      stickers: [
        { id: 's1', name: '流泪猫猫头', url: 'sad.png', groupIds: ['g-sad'] },
        { id: 's2', name: '哈哈小狗', url: 'happy.png', groupIds: ['g-happy'] }
      ],
      stickerGroups: [
        { id: 'g-sad', name: '难过' },
        { id: 'g-happy', name: '开心' }
      ],
      activeChat: {
        id: 'c1',
        name: '小猫',
        stickerGroupIds: ['g-sad']
      },
      contacts: []
    }

    const prompt = buildStickerSystemPrompt(store)
    expect(prompt).toContain('小猫仅可使用这些贴纸分组：难过')
    expect(prompt).toContain('流泪猫猫头')
    expect(prompt).not.toContain('哈哈小狗')
  })

  it('describes per-member sticker restrictions in group chats', () => {
    const store = {
      allowAIStickers: true,
      stickers: [
        { id: 's1', name: '流泪猫猫头', url: 'sad.png', groupIds: ['g-sad'] },
        { id: 's2', name: '哈哈小狗', url: 'happy.png', groupIds: ['g-happy'] }
      ],
      stickerGroups: [
        { id: 'g-sad', name: '难过' },
        { id: 'g-happy', name: '开心' }
      ],
      activeChat: {
        id: 'g1',
        type: 'group',
        members: [
          { id: 'm1', contactId: 'c1', name: '小猫' },
          { id: 'm2', contactId: 'c2', name: '小狗' }
        ]
      },
      contacts: [
        { id: 'c1', stickerGroupIds: ['g-sad'] },
        { id: 'c2', stickerGroupIds: ['g-happy'] }
      ]
    }

    const prompt = buildStickerSystemPrompt(store)
    expect(prompt).toContain('群聊成员贴纸限制')
    expect(prompt).toContain('小猫 仅可使用分组：难过；可用标签：流泪猫猫头')
    expect(prompt).toContain('小狗 仅可使用分组：开心；可用标签：哈哈小狗')
  })
})

describe('buildUnifiedSystemPrompt', () => {
  it('injects context awareness even when long-term memory is empty', () => {
    const { mainSystemPrompt } = buildUnifiedSystemPrompt({
      mainPrompt: '你是一个会陪伴用户的角色。',
      includeContextAwareness: true
    })

    expect(mainSystemPrompt).toContain('<context_awareness>')
    expect(mainSystemPrompt).toContain('<relationship_bootstrap>')
    expect(mainSystemPrompt).toContain('<current_dialogue>')
    expect(mainSystemPrompt).toContain('最后一条用户消息为直接回复目标')
    expect(mainSystemPrompt).not.toContain('<memory> 是你的长期记忆')
  })

  it('mentions long-term memory naturally when memory prompt exists', () => {
    const { mainSystemPrompt } = buildUnifiedSystemPrompt({
      mainPrompt: '你是一个会陪伴用户的角色。',
      memoryPrompt: '用户害怕打雷，但喜欢雨声。',
      includeContextAwareness: true
    })

    expect(mainSystemPrompt).toContain('<memory>')
    expect(mainSystemPrompt).toContain('<memory> 是你的长期记忆，自然融入即可。')
  })
})

describe('preset prompt sources', () => {
  it('uses the shared chat format preset template as a system prompt', () => {
    const prompt = buildChatFormatSystemPrompt({
      globalPresetLorebookEnabled: true,
      lorebook: { books: [] }
    }, {
      char: '小猫',
      user: '阿青'
    })

    expect(prompt).toContain('你正在和阿青手机聊天')
    expect(prompt).toContain('每行是一条消息，口语化')
    expect(prompt).not.toContain('[quote:')
  })

  it('keeps preset prompt books out of lorebook injection', () => {
    const store = {
      activeChat: {
        id: 'c1',
        name: '小猫',
        msgs: [{ role: 'user', content: '你好' }],
        boundLorebooks: ['preset_chat_format_v1', 'preset_image_generation_v1', 'custom_book']
      },
      lorebook: {
        books: [
          createChatFormatPresetBook(1),
          createImageGenerationPresetBook(1),
          {
            id: 'custom_book',
            name: '普通世界书',
            entries: [{
              id: 'entry_1',
              name: '普通条目',
              content: '普通世界书内容',
              enabled: true,
              alwaysActive: true,
              insertDepth: 0,
              order: 0
            }]
          }
        ]
      }
    }

    const injected = insertLorebookEntries(store, [{ role: 'system', content: '<seed />' }], {
      char: '小猫',
      user: '阿青'
    })

    expect(injected).toHaveLength(2)
    expect(injected[1].content).toContain('<world_book name="普通条目">')
    expect(injected[1].content).not.toContain('手机聊天格式')
    expect(injected[1].content).not.toContain('主动生图规则')
  })

  it('builds image generation rules from the preset prompt as a system block', () => {
    const prompt = buildImageGenerationPrompt({
      allowAIImageGeneration: true,
      globalPresetLorebookEnabled: true,
      vnImageGenConfig: { provider: 'novelai' },
      lorebook: { books: [] }
    })

    expect(prompt).toContain('<image_generation>')
    expect(prompt).toContain('发图的唯一方式是在单独一行输出 image token')
  })
})
