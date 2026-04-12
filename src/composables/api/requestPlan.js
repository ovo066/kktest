function buildSharedRequestPlan({
  templateVars,
  promptStore,
  mainPrompt,
  personaPrompt = '',
  stickerPrompt = '',
  specialFeaturesPrompt = '',
  toolCallingPrompt = '',
  forumPrompt = '',
  memoryPrompt = '',
  musicContextPrompt = '',
  buildChatFormatSystemPrompt,
  shouldAddReplyFormatPrompt,
  buildReplyFormatSystemPrompt,
  buildUnifiedSystemPrompt
}) {
  const outputFormatPrompt = buildChatFormatSystemPrompt(promptStore, templateVars)
  const replyFormatPrompt = shouldAddReplyFormatPrompt(outputFormatPrompt)
    ? buildReplyFormatSystemPrompt()
    : ''
  const combinedFeaturesPrompt = [toolCallingPrompt, specialFeaturesPrompt].filter(Boolean).join('\n')

  const { mainSystemPrompt, postHistoryPrompt } = buildUnifiedSystemPrompt({
    mainPrompt,
    personaPrompt,
    outputFormatPrompt,
    stickerPrompt,
    replyFormatPrompt,
    forumPrompt,
    memoryPrompt,
    specialFeaturesPrompt: combinedFeaturesPrompt,
    musicContextPrompt,
    includeContextAwareness: true
  })

  return {
    templateVars,
    mainSystemPrompt,
    postHistoryPrompt
  }
}

export function buildDirectRequestPlan({
  activeChat,
  promptStore,
  getTemplateVars,
  applyTemplateVars,
  buildPersonaSystemPrompt,
  buildStickerSystemPrompt,
  buildSpecialFeaturesSystemPrompt,
  buildToolCallingPrompt,
  buildForumSystemPrompt,
  buildMemoryPrompt,
  buildMusicContextPrompt,
  buildChatFormatSystemPrompt,
  shouldAddReplyFormatPrompt,
  buildReplyFormatSystemPrompt,
  buildUnifiedSystemPrompt,
  tools = []
}) {
  const templateVars = getTemplateVars(activeChat?.name)
  const mainPrompt = applyTemplateVars(String(activeChat?.prompt || ''), templateVars)
  const personaPrompt = applyTemplateVars(buildPersonaSystemPrompt(activeChat?.id), templateVars)
  const stickerPrompt = buildStickerSystemPrompt()
  const specialFeaturesPrompt = applyTemplateVars(buildSpecialFeaturesSystemPrompt(), templateVars)
  const toolCallingPrompt = buildToolCallingPrompt(tools)
  const forumPrompt = buildForumSystemPrompt()
  const memoryPrompt = buildMemoryPrompt(activeChat)
  const musicContextPrompt = buildMusicContextPrompt()

  return buildSharedRequestPlan({
    templateVars,
    promptStore,
    mainPrompt,
    personaPrompt,
    stickerPrompt,
    specialFeaturesPrompt,
    toolCallingPrompt,
    forumPrompt,
    memoryPrompt,
    musicContextPrompt,
    buildChatFormatSystemPrompt,
    shouldAddReplyFormatPrompt,
    buildReplyFormatSystemPrompt,
    buildUnifiedSystemPrompt
  })
}

export function buildGroupSingleRequestPlan({
  activeChat,
  members,
  promptStore,
  getTemplateVars,
  applyTemplateVars,
  buildGroupSystemPrompt,
  buildStickerSystemPrompt,
  buildSpecialFeaturesSystemPrompt,
  buildToolCallingPrompt,
  buildMemoryPrompt,
  buildMusicContextPrompt,
  buildChatFormatSystemPrompt,
  shouldAddReplyFormatPrompt,
  buildReplyFormatSystemPrompt,
  buildUnifiedSystemPrompt,
  tools = []
}) {
  const templateVars = getTemplateVars(activeChat?.name)
  const mainPrompt = applyTemplateVars(buildGroupSystemPrompt(members), templateVars)
  const stickerPrompt = buildStickerSystemPrompt()
  const specialFeaturesPrompt = applyTemplateVars(buildSpecialFeaturesSystemPrompt(), templateVars)
  const toolCallingPrompt = buildToolCallingPrompt(tools)
  const memoryPrompt = buildMemoryPrompt(activeChat)
  const musicContextPrompt = buildMusicContextPrompt()

  return buildSharedRequestPlan({
    templateVars,
    promptStore,
    mainPrompt,
    stickerPrompt,
    specialFeaturesPrompt,
    toolCallingPrompt,
    memoryPrompt,
    musicContextPrompt,
    buildChatFormatSystemPrompt,
    shouldAddReplyFormatPrompt,
    buildReplyFormatSystemPrompt,
    buildUnifiedSystemPrompt
  })
}

export function buildGroupMultiMainPrompt(member, otherMembers, applyTemplateVars, templateVars) {
  const otherMembersDesc = otherMembers.map(item => `${item.name}`).join('、')
  let mainPrompt = applyTemplateVars(member.prompt || `你是${member.name}。`, templateVars)
  mainPrompt += `\n\n你正在一个群聊中，群里还有：${otherMembersDesc}，以及用户。请以${member.name}的身份回复。
重要：直接输出回复内容，绝对不要在开头加上"[${member.name}]:"或任何角色名前缀。`
  return mainPrompt
}

export function buildGroupMultiRequestPlan({
  activeChat,
  member,
  promptStore,
  getTemplateVars,
  applyTemplateVars,
  buildStickerSystemPrompt,
  buildSpecialFeaturesSystemPrompt,
  buildToolCallingPrompt,
  buildForumSystemPrompt,
  buildMemoryPrompt,
  buildMusicContextPrompt,
  buildChatFormatSystemPrompt,
  shouldAddReplyFormatPrompt,
  buildReplyFormatSystemPrompt,
  buildUnifiedSystemPrompt,
  tools = []
}) {
  const otherMembers = Array.isArray(activeChat?.members)
    ? activeChat.members.filter(item => item.id !== member.id)
    : []
  const templateVars = getTemplateVars(member.name)
  const mainPrompt = buildGroupMultiMainPrompt(member, otherMembers, applyTemplateVars, templateVars)
  const stickerPrompt = buildStickerSystemPrompt({ targetMemberId: member.id })
  const specialFeaturesPrompt = applyTemplateVars(buildSpecialFeaturesSystemPrompt(), templateVars)
  const toolCallingPrompt = buildToolCallingPrompt(tools)
  const forumPrompt = buildForumSystemPrompt()
  const memoryPrompt = buildMemoryPrompt(activeChat)
  const musicContextPrompt = buildMusicContextPrompt()

  return buildSharedRequestPlan({
    templateVars,
    promptStore,
    mainPrompt,
    stickerPrompt,
    specialFeaturesPrompt,
    toolCallingPrompt,
    forumPrompt,
    memoryPrompt,
    musicContextPrompt,
    buildChatFormatSystemPrompt,
    shouldAddReplyFormatPrompt,
    buildReplyFormatSystemPrompt,
    buildUnifiedSystemPrompt
  })
}

export async function buildApiRequestMessages({
  activeChat,
  mainSystemPrompt,
  templateVars,
  loadContextWindowedMsgs,
  resolveContextMessagesForApi,
  buildApiMessages,
  insertLorebookEntries,
  buildPostInstructionParts,
  appendInstructionMessage
}) {
  const { contextMsgs, retrievedContext } = await loadContextWindowedMsgs(activeChat)
  const resolvedContextMsgs = await resolveContextMessagesForApi(contextMsgs)

  let messages = [
    { role: 'system', content: mainSystemPrompt },
    ...buildApiMessages(resolvedContextMsgs)
  ]

  messages = insertLorebookEntries(messages, templateVars)

  const postParts = await buildPostInstructionParts(retrievedContext)
  appendInstructionMessage(messages, postParts)

  return {
    messages,
    retrievedContext
  }
}
