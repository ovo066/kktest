import { reactive, ref, watch } from 'vue'
import {
  buildAutoReplyVibeHint,
  cleanGeneratedComment,
  getRecentRepliesText,
  normalizeReplyForCompare,
  stripOuterCodeFence
} from '../utils/aiGeneration'
import { applyOptionalMaxTokens } from '../../../composables/api/chatCompletions'

export function useMomentsAIGeneration({
  configsStore,
  forumContacts,
  aiContactIdSet,
  momentsStore,
  scheduleSave,
  showAIPanel
}) {
  const aiGenerating = ref(false)
  const aiGeneratingText = ref('')
  const aiGenerate = reactive({
    contactId: '',
    type: 'post',
    postId: '',
    prompt: '',
    autoReplyEnabled: false,
    autoReplyContactIds: [],
    autoReplyRounds: 1,
    autoReplyVibe: 'drama',
    autoReplyPrompt: '',
    autoReplyThreaded: true,
    useAcquaintanceGroups: true
  })

  watch(() => [aiGenerate.contactId, aiGenerate.useAcquaintanceGroups], () => {
    pruneAutoReplyContactsByGroup()
  })

  function toggleAutoReplyContact(contactId) {
    if (!canJoinAutoReply(contactId)) return
    const index = aiGenerate.autoReplyContactIds.indexOf(contactId)
    if (index === -1) {
      aiGenerate.autoReplyContactIds.push(contactId)
      return
    }
    aiGenerate.autoReplyContactIds.splice(index, 1)
  }

  function selectAllAutoReplyContacts() {
    const ids = forumContacts.value
      .filter(contact => contact.id !== aiGenerate.contactId)
      .filter(contact => !aiGenerate.useAcquaintanceGroups || canContactsInteract(contact.id, aiGenerate.contactId))
      .map(contact => contact.id)
    aiGenerate.autoReplyContactIds.splice(0, aiGenerate.autoReplyContactIds.length, ...ids)
  }

  function clearAutoReplyContacts() {
    aiGenerate.autoReplyContactIds.splice(0, aiGenerate.autoReplyContactIds.length)
  }

  function addAcquaintanceGroup() {
    momentsStore.addContactGroup('新分组')
    scheduleSave()
  }

  function renameAcquaintanceGroup(groupId, name) {
    momentsStore.renameContactGroup(groupId, name)
    pruneAutoReplyContactsByGroup()
    scheduleSave()
  }

  function removeAcquaintanceGroup(groupId) {
    momentsStore.deleteContactGroup(groupId)
    pruneAutoReplyContactsByGroup()
    scheduleSave()
  }

  function getContactGroupId(contactId) {
    return momentsStore.getContactGroupId(contactId) || ''
  }

  function onContactGroupChange(contactId, value) {
    momentsStore.setContactGroup(contactId, value || null)
    pruneAutoReplyContactsByGroup()
    scheduleSave()
  }

  function isAiContactId(contactId) {
    return aiContactIdSet.value.has(contactId)
  }

  function canContactsInteract(aId, bId) {
    if (!aiGenerate.useAcquaintanceGroups) return true
    if (!isAiContactId(aId) || !isAiContactId(bId)) return true
    return momentsStore.areContactsAcquainted(aId, bId)
  }

  function canJoinAutoReply(contactId) {
    if (!aiGenerate.contactId) return true
    return canContactsInteract(contactId, aiGenerate.contactId)
  }

  function pruneAutoReplyContactsByGroup() {
    if (!aiGenerate.useAcquaintanceGroups) return
    const nextIds = aiGenerate.autoReplyContactIds.filter(id => canJoinAutoReply(id))
    if (nextIds.length === aiGenerate.autoReplyContactIds.length) return
    aiGenerate.autoReplyContactIds.splice(0, aiGenerate.autoReplyContactIds.length, ...nextIds)
  }

  async function requestChatCompletion(cfg, systemPrompt, userPrompt, maxTokens = null) {
    let url = (cfg?.url || '').replace(/\/$/, '')
    if (!url.endsWith('/chat/completions')) url += '/chat/completions'

    const body = {
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }
    applyOptionalMaxTokens(body, cfg?.maxTokens, maxTokens)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + cfg.key
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) throw new Error('API 请求失败')
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  function pickThreadTargetReply(moment, actorId) {
    if (!aiGenerate.autoReplyThreaded) return null
    const candidates = (moment?.replies || [])
      .filter(reply => reply?.id && reply.authorId !== actorId)
      .filter(reply => canContactsInteract(actorId, reply.authorId))
    if (candidates.length === 0) return null

    const recent = candidates.slice(-6)
    const chance = recent.length >= 3 ? 0.72 : 0.45
    if (Math.random() > chance) return null

    const pool = recent.slice(-Math.min(4, recent.length))
    return pool[Math.floor(Math.random() * pool.length)] || null
  }

  async function createAIReply(moment, replyContact, options = {}) {
    if (!moment?.id || !replyContact?.id) return null

    const replyCfg = configsStore.configs.find(config => config.id === replyContact.configId) || configsStore.getConfig
    if (!replyCfg?.key) return null

    const round = options.round || 1
    const rounds = options.rounds || 1
    aiGeneratingText.value = options.progressText || `正在生成评论 ${round}/${rounds} · ${replyContact.name}`

    const canTalkToAuthor = canContactsInteract(replyContact.id, moment.authorId)
    const replySystem = replyContact.prompt || `你是${replyContact.name}。`
    const targetReply = options.targetReply || pickThreadTargetReply(moment, replyContact.id)
    if (!targetReply && !canTalkToAuthor) return null

    const recentReplies = getRecentRepliesText(moment)
    const vibeHint = options.vibeHint || buildAutoReplyVibeHint(aiGenerate.autoReplyVibe)
    const extraHint = options.extraHint != null ? options.extraHint : (aiGenerate.autoReplyPrompt || '').trim()
    const targetHint = targetReply
      ? `本次请优先回复这条评论：\n${targetReply.authorName}: ${targetReply.content}`
      : '本次请直接评论动态正文，不要虚构被回复对象。'

    const replyUser = `朋友圈动态正文：${moment.content}

当前评论区（最新在后）：
${recentReplies || '(暂无)'}

${targetHint}
请以${replyContact.name}的身份写一条评论。${extraHint ? '评论提示：' + extraHint : ''}
${vibeHint}
请只输出评论正文，不要添加“回复xx：”前缀，不要输出角色名，不要用代码块。`

    const raw = await requestChatCompletion(replyCfg, replySystem, replyUser, 420)
    const replyText = cleanGeneratedComment(raw)
    if (!replyText) return null

    const normalized = normalizeReplyForCompare(replyText)
    const duplicated = (moment.replies || [])
      .slice(-8)
      .some(reply => reply.authorId === replyContact.id && normalizeReplyForCompare(reply.content) === normalized)
    if (duplicated) return null

    const newReply = momentsStore.addReply(moment.id, {
      content: replyText,
      authorId: replyContact.id,
      authorName: replyContact.name,
      authorAvatar: replyContact.avatar,
      replyToReplyId: targetReply?.id || null,
      replyToAuthorId: targetReply?.authorId || null,
      replyToAuthorName: targetReply?.authorName || null,
      replyToContentPreview: targetReply?.content ? targetReply.content.slice(0, 80) : null
    })
    if (newReply) scheduleSave()
    return newReply
  }

  async function runAutoReplyChain(moment, contactIds, options = {}) {
    if (!moment?.id) return
    const uniqueIds = Array.from(new Set(contactIds || []))
      .filter(Boolean)
      .filter(id => canContactsInteract(id, moment.authorId) || (moment.replies || []).some(reply => canContactsInteract(id, reply.authorId)))
    if (uniqueIds.length === 0) return

    const rounds = Math.max(1, Math.min(5, Number(options.rounds) || 1))
    const vibeHint = buildAutoReplyVibeHint(aiGenerate.autoReplyVibe)
    const extraHint = (aiGenerate.autoReplyPrompt || '').trim()

    for (let round = 1; round <= rounds; round += 1) {
      for (let index = 0; index < uniqueIds.length; index += 1) {
        const replyContact = forumContacts.value.find(contact => contact.id === uniqueIds[index])
        if (!replyContact) continue
        await createAIReply(moment, replyContact, {
          round,
          rounds,
          vibeHint,
          extraHint,
          progressText: `正在生成评论 ${round}/${rounds} · ${replyContact.name}`
        })
      }
    }
  }

  async function generateWithAI() {
    if (!aiGenerate.contactId) return
    const contact = forumContacts.value.find(item => item.id === aiGenerate.contactId)
    if (!contact) return

    const config = configsStore.configs.find(item => item.id === contact.configId) || configsStore.getConfig
    if (!config?.key) return

    aiGenerating.value = true
    aiGeneratingText.value = ''

    try {
      const systemPrompt = contact.prompt || `你是${contact.name}。`
      let userPrompt = ''
      let targetMoment = null

      if (aiGenerate.type === 'post') {
        userPrompt = `请以${contact.name}的身份写一条朋友圈动态。${aiGenerate.prompt ? '主题提示：' + aiGenerate.prompt : '自由发挥，写一条有趣的动态。'}

请直接输出动态正文内容，不要加标题、不要用JSON、不要用代码块。一段自然的话即可。`
      } else {
        targetMoment = momentsStore.moments.find(moment => moment.id === aiGenerate.postId)
        if (!targetMoment) return
        const existingReplies = getRecentRepliesText(targetMoment)
        userPrompt = `朋友圈动态内容：${targetMoment.content}

当前评论区（最新在后）：
${existingReplies || '(暂无)'}

请以${contact.name}的身份评论这条动态。${aiGenerate.prompt ? '评论提示：' + aiGenerate.prompt : ''}
请直接输出评论正文，不要加任何格式。`
      }

      aiGeneratingText.value = aiGenerate.type === 'post' ? '正在生成动态...' : '正在生成评论...'
      const content = await requestChatCompletion(config, systemPrompt, userPrompt, 600)

      if (aiGenerate.type === 'post') {
        const cleanContent = stripOuterCodeFence(content).trim()
        if (!cleanContent) return
        const createdMoment = momentsStore.addMoment({
          content: cleanContent,
          authorId: contact.id,
          authorName: contact.name,
          authorAvatar: contact.avatar
        })

        scheduleSave()

        if (aiGenerate.autoReplyEnabled && createdMoment?.id && aiGenerate.autoReplyContactIds.length > 0) {
          const participantIds = Array.from(new Set(aiGenerate.autoReplyContactIds))
            .filter(id => id && id !== aiGenerate.contactId)
          await runAutoReplyChain(createdMoment, participantIds, {
            rounds: aiGenerate.autoReplyRounds
          })
        }
      } else {
        const firstReply = cleanGeneratedComment(content)
        if (!firstReply || !targetMoment?.id) return
        momentsStore.addReply(targetMoment.id, {
          content: firstReply,
          authorId: contact.id,
          authorName: contact.name,
          authorAvatar: contact.avatar
        })
        scheduleSave()

        if (aiGenerate.autoReplyEnabled && targetMoment?.id && aiGenerate.autoReplyContactIds.length > 0) {
          const participantIds = Array.from(new Set(aiGenerate.autoReplyContactIds))
            .filter(id => id && id !== contact.id)
          await runAutoReplyChain(targetMoment, participantIds, {
            rounds: aiGenerate.autoReplyRounds
          })
        }
      }

      showAIPanel.value = false
      aiGenerate.prompt = ''
    } catch (error) {
      console.error(error)
    } finally {
      aiGenerating.value = false
      aiGeneratingText.value = ''
    }
  }

  return {
    addAcquaintanceGroup,
    aiGenerate,
    aiGenerating,
    aiGeneratingText,
    canJoinAutoReply,
    clearAutoReplyContacts,
    generateWithAI,
    getContactGroupId,
    onContactGroupChange,
    removeAcquaintanceGroup,
    renameAcquaintanceGroup,
    selectAllAutoReplyContacts,
    toggleAutoReplyContact
  }
}
