export function buildUnifiedSystemPrompt(options = {}) {
  const {
    mainPrompt = '',
    personaPrompt = '',
    outputFormatPrompt = '',
    stickerPrompt = '',
    replyFormatPrompt = '',
    forumPrompt = '',
    memoryPrompt = '',
    specialFeaturesPrompt = '',
    musicContextPrompt = '',
    includeContextAwareness = false
  } = options

  const mainSections = []

  mainSections.push('<role>\n' + mainPrompt + '\n</role>')

  if (personaPrompt) {
    mainSections.push('<user_persona>\n' + personaPrompt.replace('用户面具：\n', '') + '\n</user_persona>')
  }

  if (memoryPrompt) {
    mainSections.push('<memory>\n' + memoryPrompt + '\n</memory>')
  }

  if (includeContextAwareness) {
    const contextLines = [
      '对话历史中的 [当前对话] 标记表示本次交流中的一次重新开聊或返回，之前的内容是更早的聊天。',
      '<relationship_bootstrap> 是你和用户在更早阶段建立关系的片段，仅用于维持熟悉感、称呼和关系连续性，不是当前正在发生的对话。',
      '<context_summary> 是被压缩后的历史阶段概要，仅作背景参考。',
      '<history_retrieval> 是从过去对话中检索到的回忆片段，仅做背景参考，不要当作刚发生的事来回应。',
      '<current_dialogue> 后面的最近消息才是你现在要直接续接的对话。',
      '始终以当前对话段落里的最后一条用户消息为直接回复目标。',
      '<now> 描述了此刻的真实时间和间隔状态。'
    ]
    if (memoryPrompt) {
      contextLines.splice(4, 0, '<memory> 是你的长期记忆，自然融入即可。')
    }
    mainSections.push('<context_awareness>\n' + contextLines.join('\n') + '\n</context_awareness>')
  }

  const mainSystemPrompt = mainSections.join('\n\n')

  const postParts = []

  if (outputFormatPrompt) {
    postParts.push('<output_format>\n' + outputFormatPrompt + '\n</output_format>')
  }

  const featureParts = []
  if (stickerPrompt) featureParts.push(stickerPrompt)
  if (replyFormatPrompt) featureParts.push(replyFormatPrompt)
  if (specialFeaturesPrompt) featureParts.push(specialFeaturesPrompt)
  if (forumPrompt) featureParts.push(forumPrompt)
  if (featureParts.length > 0) {
    postParts.push('<features>\n' + featureParts.join('\n') + '\n</features>')
  }

  if (musicContextPrompt) postParts.push(musicContextPrompt)

  const postHistoryPrompt = postParts.length > 0 ? postParts.join('\n\n') : ''

  return { mainSystemPrompt, postHistoryPrompt }
}
