import { describe, expect, it, vi } from 'vitest'
import { createPostInstructionBuilder } from './postInstructionBuilder'

const joinLines = (...lines) => lines.join('\n')

function createBuilder(overrides = {}) {
  const contactsStore = overrides.contactsStore || {
    contacts: [],
    activeChat: {
      id: 'chat-1',
      msgs: []
    }
  }
  const settingsStore = overrides.settingsStore || {
    syncForumToAI: false,
    allowPlannerAI: false,
    allowLivenessEngine: false,
    sendTimestampsToAI: false,
    enableWeatherContext: false
  }
  const chatStore = overrides.chatStore || {
    returnedFromMomentId: null
  }
  const buildWeatherLine = overrides.buildWeatherLine || vi.fn().mockResolvedValue('')
  const buildImageGenerationPrompt = overrides.buildImageGenerationPrompt || vi.fn(() => '')
  const getMomentsStore = overrides.getMomentsStore || (() => ({
    sortedMoments: [],
    areContactsAcquainted: () => false,
    getMomentById: () => null
  }))
  const getLivenessStore = overrides.getLivenessStore || (() => ({
    getStateDescription: () => '',
    recordInteraction: vi.fn()
  }))
  const loadMomentsPromptLayers = overrides.loadMomentsPromptLayers || vi.fn().mockResolvedValue(() => ({
    layer1: '',
    layer2: ''
  }))
  const loadPlannerPromptLayers = overrides.loadPlannerPromptLayers || vi.fn().mockResolvedValue(() => ({
    layer1: '',
    layer2: '',
    layer3: ''
  }))

  return createPostInstructionBuilder({
    contactsStore,
    settingsStore,
    chatStore,
    buildWeatherLine,
    buildImageGenerationPrompt,
    getMomentsStore,
    getLivenessStore,
    loadMomentsPromptLayers,
    loadPlannerPromptLayers
  })
}

describe('postInstructionBuilder', () => {
  it('builds group post instructions with shared context and planner layers', async () => {
    const builder = createBuilder({
      contactsStore: {
        contacts: [{ id: 'group-1', type: 'group', name: '群聊' }],
        activeChat: {
          id: 'group-1',
          msgs: [{ role: 'user', content: 'hello group' }]
        }
      },
      settingsStore: {
        syncForumToAI: true,
        allowPlannerAI: true,
        allowLivenessEngine: false,
        sendTimestampsToAI: false,
        enableWeatherContext: false
      },
      buildImageGenerationPrompt: vi.fn(() => 'image-gen'),
      getMomentsStore: () => ({
        sortedMoments: [
          { id: 'm1', authorId: 'a1', authorName: 'Alice', content: 'first moment' },
          { id: 'm2', authorId: 'b1', authorName: 'Bob', content: 'second moment' },
          { id: 'm3', authorId: 'c1', authorName: 'Carol', content: 'third moment' }
        ],
        areContactsAcquainted: () => false,
        getMomentById: () => null
      }),
      loadPlannerPromptLayers: vi.fn().mockResolvedValue(() => ({
        layer1: 'planner-1',
        layer2: 'planner-2',
        layer3: 'planner-3'
      }))
    })

    const parts = await builder.buildGroupPostInstructionParts({
      postHistoryPrompt: 'post-history',
      retrievedContext: 'retrieved context',
      momentsAuthorId: null
    })

    expect(parts).toEqual([
      'post-history',
      joinLines('<history_retrieval>', 'retrieved context', '</history_retrieval>'),
      joinLines(
        '<moments_targets>',
        '动态评论目标可用 latest/最新/最近（默认最近一条）。也可用以下 momentId：',
        '- m1 | Alice: first moment',
        '- m2 | Bob: second moment',
        '- m3 | Carol: third moment',
        '</moments_targets>'
      ),
      'planner-1',
      'planner-2',
      'image-gen'
    ])
  })

  it('builds direct post instructions with filtered moments, liveness and bridge prompt', async () => {
    const recordInteraction = vi.fn()
    const chatStore = { returnedFromMomentId: 'moment-2' }
    const builder = createBuilder({
      contactsStore: {
        contacts: [{ id: 'ai-1', type: 'assistant', name: 'Alice' }],
        activeChat: {
          id: 'ai-1',
          msgs: [
            { role: 'assistant', content: 'old reply' },
            { role: 'user', content: 'latest question' }
          ]
        }
      },
      settingsStore: {
        syncForumToAI: true,
        allowPlannerAI: true,
        allowLivenessEngine: true,
        sendTimestampsToAI: false,
        enableWeatherContext: false
      },
      chatStore,
      buildImageGenerationPrompt: vi.fn(() => 'image-gen'),
      getMomentsStore: () => ({
        sortedMoments: [
          { id: 'm1', authorId: 'ai-1', authorName: 'Alice', content: 'self moment' },
          { id: 'm2', authorId: 'friend-1', authorName: 'Friend', content: 'friend moment' },
          { id: 'm3', authorId: 'stranger-1', authorName: 'Stranger', content: 'stranger moment' }
        ],
        areContactsAcquainted: (authorId, targetId) => authorId === 'ai-1' && targetId === 'friend-1',
        getMomentById: id => (id === 'moment-2' ? { content: '我刚发了一条动态' } : null)
      }),
      getLivenessStore: () => ({
        getStateDescription: () => '开心',
        recordInteraction
      }),
      loadMomentsPromptLayers: vi.fn().mockResolvedValue(() => ({
        layer1: 'moments-1',
        layer2: 'moments-2'
      })),
      loadPlannerPromptLayers: vi.fn().mockResolvedValue(() => ({
        layer1: 'planner-1',
        layer2: 'planner-2',
        layer3: '<character_schedule>\n正在：看书\n</character_schedule>',
        action: 'planner-action'
      }))
    })

    const parts = await builder.buildDirectPostInstructionParts({
      postHistoryPrompt: 'post-history',
      retrievedContext: 'retrieved context'
    })

    expect(parts).toEqual([
      'post-history',
      joinLines('<now>', '正在：看书', '</now>'),
      joinLines('<history_retrieval>', 'retrieved context', '</history_retrieval>'),
      'moments-1',
      'moments-2',
      joinLines(
        '<moments_targets>',
        '动态评论目标可用 latest/最新/最近（默认最近一条）。也可用以下 momentId：',
        '- m1 | Alice: self moment',
        '- m2 | Friend: friend moment',
        '</moments_targets>'
      ),
      'planner-1',
      'planner-2',
      'planner-action',
      joinLines(
        '<user_action>',
        '用户刚查看了你的动态："我刚发了一条动态"。可以自然地聊聊这个话题。',
        '</user_action>'
      ),
      'image-gen',
      joinLines('<character_state>', '开心', '</character_state>')
    ])
    expect(recordInteraction).toHaveBeenCalledWith('ai-1')
    expect(chatStore.returnedFromMomentId).toBeNull()
  })

  it('builds <now> block with timestamp and weather when enabled', async () => {
    const builder = createBuilder({
      settingsStore: {
        syncForumToAI: false,
        allowPlannerAI: false,
        allowLivenessEngine: false,
        sendTimestampsToAI: true,
        enableWeatherContext: true
      },
      buildWeatherLine: vi.fn().mockResolvedValue('北京 晴 12°C')
    })

    const parts = await builder.buildDirectPostInstructionParts({
      postHistoryPrompt: '',
      retrievedContext: ''
    })

    const nowBlock = parts.find(p => p.startsWith('<now>'))
    expect(nowBlock).toBeDefined()
    expect(nowBlock).toContain('天气：北京 晴 12°C')
  })

  it('moments_targets only injected when L1 is triggered in direct chat', async () => {
    const builder = createBuilder({
      contactsStore: {
        contacts: [{ id: 'ai-1', type: 'assistant', name: 'Alice' }],
        activeChat: {
          id: 'ai-1',
          msgs: [{ role: 'user', content: 'hi' }]
        }
      },
      settingsStore: {
        syncForumToAI: true,
        allowPlannerAI: false,
        allowLivenessEngine: false,
        sendTimestampsToAI: false,
        enableWeatherContext: false
      },
      getMomentsStore: () => ({
        sortedMoments: [
          { id: 'm1', authorId: 'ai-1', authorName: 'Alice', content: 'a moment' }
        ],
        areContactsAcquainted: () => false,
        getMomentById: () => null
      }),
      loadMomentsPromptLayers: vi.fn().mockResolvedValue(() => ({
        layer1: '',
        layer2: ''
      }))
    })

    const parts = await builder.buildDirectPostInstructionParts({
      postHistoryPrompt: '',
      retrievedContext: ''
    })

    const hasMomentsTargets = parts.some(p => p.includes('<moments_targets>'))
    expect(hasMomentsTargets).toBe(false)
  })

  it('still injects planner action prompt when only auto capture is enabled', async () => {
    const builder = createBuilder({
      contactsStore: {
        contacts: [{ id: 'ai-1', type: 'assistant', name: 'Alice' }],
        activeChat: {
          id: 'ai-1',
          msgs: [{ role: 'user', content: '我最近想开始准备考研' }]
        }
      },
      settingsStore: {
        syncForumToAI: false,
        allowPlannerAI: false,
        allowAIPlannerCapture: true,
        allowLivenessEngine: false,
        sendTimestampsToAI: false,
        enableWeatherContext: false
      },
      loadPlannerPromptLayers: vi.fn().mockResolvedValue(() => ({
        layer1: '',
        layer2: '',
        layer3: '',
        action: 'planner-action'
      }))
    })

    const parts = await builder.buildDirectPostInstructionParts({
      postHistoryPrompt: '',
      retrievedContext: ''
    })

    expect(parts).toContain('planner-action')
  })
})
