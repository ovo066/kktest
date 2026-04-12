import { describe, expect, it, vi } from 'vitest'
import {
  buildApiRequestMessages,
  buildDirectRequestPlan,
  buildGroupMultiMainPrompt,
  buildGroupMultiRequestPlan,
  buildGroupSingleRequestPlan
} from './requestPlan'

function createPlanDeps() {
  return {
    promptStore: { id: 'prompt-store' },
    getTemplateVars: (name) => ({ char: name || '角色' }),
    applyTemplateVars: (text, vars) => `${text}|${vars.char}`,
    buildPersonaSystemPrompt: (contactId) => `persona:${contactId}`,
    buildStickerSystemPrompt: (options = {}) => options.targetMemberId ? `stickers:${options.targetMemberId}` : 'stickers',
    buildSpecialFeaturesSystemPrompt: () => 'features',
    buildToolCallingPrompt: (tools = []) => tools.length ? `tools:${tools.map((item) => item.function.name).join(',')}` : '',
    buildForumSystemPrompt: () => 'forum',
    buildMemoryPrompt: (activeChat) => `memory:${activeChat?.id || 'none'}`,
    buildMusicContextPrompt: () => 'music',
    buildChatFormatSystemPrompt: (_promptStore, templateVars) => `format:${templateVars.char}`,
    shouldAddReplyFormatPrompt: (value) => value.includes('format'),
    buildReplyFormatSystemPrompt: () => 'reply-format',
    buildUnifiedSystemPrompt: (input) => ({
      mainSystemPrompt: JSON.stringify(input),
      postHistoryPrompt: `post:${input.mainPrompt}`
    }),
    buildGroupSystemPrompt: (members) => `group:${members.map((item) => item.name).join(',')}`
  }
}

describe('requestPlan', () => {
  it('builds direct chat request plans from shared prompt parts', () => {
    const deps = createPlanDeps()
    const plan = buildDirectRequestPlan({
      activeChat: { id: 'chat_1', name: 'Alice', prompt: 'main' },
      tools: [{ type: 'function', function: { name: 'add_memory' } }],
      ...deps
    })

    const prompt = JSON.parse(plan.mainSystemPrompt)
    expect(plan.templateVars).toEqual({ char: 'Alice' })
    expect(prompt.mainPrompt).toBe('main|Alice')
    expect(prompt.personaPrompt).toBe('persona:chat_1|Alice')
    expect(prompt.forumPrompt).toBe('forum')
    expect(prompt.memoryPrompt).toBe('memory:chat_1')
    expect(prompt.specialFeaturesPrompt).toContain('tools:add_memory')
    expect(prompt.replyFormatPrompt).toBe('reply-format')
  })

  it('builds group single request plans without direct-only prompts', () => {
    const deps = createPlanDeps()
    const plan = buildGroupSingleRequestPlan({
      activeChat: { id: 'group_1', name: '群聊' },
      members: [{ id: 'm1', name: 'Alice' }, { id: 'm2', name: 'Bob' }],
      ...deps
    })

    const prompt = JSON.parse(plan.mainSystemPrompt)
    expect(prompt.mainPrompt).toBe('group:Alice,Bob|群聊')
    expect(prompt.personaPrompt).toBe('')
    expect(prompt.forumPrompt).toBe('')
    expect(prompt.memoryPrompt).toBe('memory:group_1')
  })

  it('builds group multi main prompts and plans from the selected member', () => {
    const deps = createPlanDeps()
    const activeChat = {
      id: 'group_1',
      members: [
        { id: 'm1', name: 'Alice', prompt: 'alice prompt' },
        { id: 'm2', name: 'Bob', prompt: 'bob prompt' }
      ]
    }
    const mainPrompt = buildGroupMultiMainPrompt(
      activeChat.members[0],
      [activeChat.members[1]],
      deps.applyTemplateVars,
      { char: 'Alice' }
    )

    expect(mainPrompt).toContain('alice prompt|Alice')
    expect(mainPrompt).toContain('Bob')
    expect(mainPrompt).toContain('Alice')

    const plan = buildGroupMultiRequestPlan({
      activeChat,
      member: activeChat.members[0],
      ...deps
    })
    const prompt = JSON.parse(plan.mainSystemPrompt)
    expect(prompt.stickerPrompt).toBe('stickers:m1')
    expect(prompt.forumPrompt).toBe('forum')
    expect(prompt.memoryPrompt).toBe('memory:group_1')
  })

  it('builds api request messages from shared history and post steps', async () => {
    const appendInstructionMessage = vi.fn((messages, postParts) => {
      messages.push({ role: 'system', content: postParts.join(' | ') })
    })

    const result = await buildApiRequestMessages({
      activeChat: { id: 'chat_1' },
      mainSystemPrompt: 'system-main',
      templateVars: { char: 'Alice' },
      loadContextWindowedMsgs: async () => ({
        contextMsgs: [{ role: 'user', content: 'hello' }],
        retrievedContext: 'memory-hit'
      }),
      resolveContextMessagesForApi: async (messages) => messages.map((item) => ({ ...item, resolved: true })),
      buildApiMessages: (messages) => messages.map((item) => ({ role: item.role, content: `${item.content}:api` })),
      insertLorebookEntries: (messages, templateVars) => [
        ...messages,
        { role: 'system', content: `lore:${templateVars.char}` }
      ],
      buildPostInstructionParts: async (retrievedContext) => [`post:${retrievedContext}`],
      appendInstructionMessage
    })

    expect(result.messages).toEqual([
      { role: 'system', content: 'system-main' },
      { role: 'user', content: 'hello:api' },
      { role: 'system', content: 'lore:Alice' },
      { role: 'system', content: 'post:memory-hit' }
    ])
    expect(appendInstructionMessage).toHaveBeenCalledTimes(1)
  })
})
