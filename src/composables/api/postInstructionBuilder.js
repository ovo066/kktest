import { useLivenessStore } from '../../stores/liveness'
import { useMomentsStore } from '../../stores/moments'
import { buildTimestampData } from './prompts'

const MOMENTS_TARGETS_INTRO = '动态评论目标可用 latest/最新/最近（默认最近一条）。也可用以下 momentId：'
const USER_ACTION_TEXT_PREFIX = '用户刚查看了你的动态："'
const USER_ACTION_TEXT_SUFFIX = '"。可以自然地聊聊这个话题。'

/**
 * 构建 <now> 块：把时间、天气、角色日程、关系时长合并为一个紧凑的情境描述
 */
function buildNowBlock({ timestampData, weatherLine, characterScheduleContent, relationshipLine }) {
  const lines = []
  if (timestampData?.time) {
    let timeLine = timestampData.time
    if (timestampData.gap) timeLine += `（${timestampData.gap}）`
    lines.push(timeLine)
  }
  if (relationshipLine) lines.push(relationshipLine)
  if (weatherLine) lines.push('天气：' + weatherLine)
  if (characterScheduleContent) lines.push(characterScheduleContent)
  if (lines.length === 0) return ''
  return '<now>\n' + lines.join('\n') + '\n</now>'
}

function computeRelationshipDuration(contact) {
  const msgs = contact?.msgs
  if (!Array.isArray(msgs) || msgs.length === 0) return ''

  const firstMsg = msgs.find(m => m.time)
  if (!firstMsg?.time) return ''

  let ts = Number(firstMsg.time)
  if (!Number.isFinite(ts) || ts <= 0) {
    ts = Date.parse(String(firstMsg.time))
  }
  if (!Number.isFinite(ts) || ts <= 0) return ''

  const daysSince = Math.floor((Date.now() - ts) / 86400000)
  if (daysSince < 3) return ''
  return `首次对话于${daysSince}天前`
}

export function createPostInstructionBuilder({
  contactsStore,
  settingsStore,
  chatStore,
  buildWeatherLine,
  buildImageGenerationPrompt,
  getMomentsStore = useMomentsStore,
  getLivenessStore = useLivenessStore,
  loadMomentsPromptLayers = async () => {
    const { buildMomentsPromptLayers } = await import('../useMomentsContext')
    return buildMomentsPromptLayers
  },
  loadPlannerPromptLayers = async () => {
    const { buildPlannerPromptLayers } = await import('../usePlannerContext')
    return buildPlannerPromptLayers
  }
}) {
  function buildMomentsCommentTargetsPrompt(authorId) {
    if (!settingsStore.syncForumToAI) return ''

    const momentsStore = getMomentsStore()
    const all = Array.isArray(momentsStore.sortedMoments) ? momentsStore.sortedMoments : []
    if (all.length === 0) return ''

    const isKnownAi = !!(
      authorId
      && Array.isArray(contactsStore.contacts)
      && contactsStore.contacts.some(contact => contact.id === authorId && contact.type !== 'group')
    )

    const visible = all
      .filter(moment => {
        if (!moment) return false
        if (!isKnownAi) return true
        return moment.authorId === authorId || momentsStore.areContactsAcquainted(authorId, moment.authorId)
      })
      .slice(0, 3)

    if (visible.length === 0) return ''

    const lines = visible.map(moment => {
      const preview = String(moment.content || '').replace(/\s+/g, ' ').slice(0, 24)
      return `- ${moment.id} | ${moment.authorName}: ${preview}${preview.length >= 24 ? '\u2026' : ''}`
    })

    return ['<moments_targets>', MOMENTS_TARGETS_INTRO, ...lines, '</moments_targets>'].join('\n')
  }

  function getTimestampData() {
    if (!settingsStore.sendTimestampsToAI) return null
    return buildTimestampData(contactsStore.activeChat?.msgs)
  }

  async function getWeatherLine() {
    if (!settingsStore.enableWeatherContext || !buildWeatherLine) return ''
    try { return await buildWeatherLine() } catch { return '' }
  }

  async function getPlannerLayers(contact, lastUserContent) {
    if (!settingsStore.allowPlannerAI && !settingsStore.allowAIPlannerCapture) {
      return { layer1: '', layer2: '', layer3: '', action: '' }
    }
    try {
      const fn = await loadPlannerPromptLayers()
      return fn(contact, lastUserContent)
    } catch {
      return { layer1: '', layer2: '', layer3: '', action: '' }
    }
  }

  /**
   * 从 planner L3 的 <character_schedule> XML 中提取纯文本内容
   */
  function extractScheduleContent(layer3) {
    if (!layer3) return ''
    return layer3.replace(/<\/?character_schedule>/g, '').trim()
  }

  async function buildGroupPostInstructionParts({ postHistoryPrompt, retrievedContext, momentsAuthorId }) {
    const postParts = []
    if (postHistoryPrompt) postParts.push(postHistoryPrompt)

    // <now> 块（群聊不含角色日程）
    const [timestampData, weatherLine] = await Promise.all([getTimestampData(), getWeatherLine()])
    const relationshipLine = computeRelationshipDuration(contactsStore.activeChat)
    const nowBlock = buildNowBlock({ timestampData, weatherLine, relationshipLine })
    if (nowBlock) postParts.push(nowBlock)

    if (retrievedContext) {
      postParts.push('<history_retrieval>\n' + retrievedContext + '\n</history_retrieval>')
    }

    const momentsTargets = buildMomentsCommentTargetsPrompt(momentsAuthorId)
    if (momentsTargets) postParts.push(momentsTargets)

    const contact = contactsStore.contacts?.find(item => item.id === contactsStore.activeChat?.id)
    const lastUserContent = contactsStore.activeChat?.msgs?.slice().reverse().find(msg => msg.role === 'user')?.content || ''
    const plannerLayers = await getPlannerLayers(contact, lastUserContent)
    if (plannerLayers.layer1) postParts.push(plannerLayers.layer1)
    if (plannerLayers.layer2) postParts.push(plannerLayers.layer2)

    const imageGenPrompt = buildImageGenerationPrompt()
    if (imageGenPrompt) postParts.push(imageGenPrompt)

    return postParts
  }

  async function buildDirectPostInstructionParts({ postHistoryPrompt, retrievedContext }) {
    const activeChat = contactsStore.activeChat
    const lastUserContent = activeChat?.msgs?.slice().reverse().find(message => message.role === 'user')?.content || ''

    // 并行获取时间、天气、日程数据
    const [timestampData, weatherLine, plannerLayers] = await Promise.all([
      getTimestampData(),
      getWeatherLine(),
      getPlannerLayers(activeChat, lastUserContent)
    ])

    const postParts = []
    if (postHistoryPrompt) postParts.push(postHistoryPrompt)

    // <now> 块：合并时间 + 天气 + 角色日程（planner L3）+ 关系时长
    const relationshipLine = computeRelationshipDuration(activeChat)
    const nowBlock = buildNowBlock({
      timestampData,
      weatherLine,
      characterScheduleContent: extractScheduleContent(plannerLayers.layer3),
      relationshipLine
    })
    if (nowBlock) postParts.push(nowBlock)

    if (retrievedContext) {
      postParts.push('<history_retrieval>\n' + retrievedContext + '\n</history_retrieval>')
    }

    // Moments 上下文
    if (settingsStore.syncForumToAI) {
      const buildMomentsPromptLayers = await loadMomentsPromptLayers()
      const momentsLayers = buildMomentsPromptLayers(activeChat, lastUserContent)
      if (momentsLayers.layer1) postParts.push(momentsLayers.layer1)
      if (momentsLayers.layer2) postParts.push(momentsLayers.layer2)

      // moments_targets 仅在 L1 触发时注入（用户提到朋友圈才需要 momentId 列表）
      if (momentsLayers.layer1) {
        const momentsTargets = buildMomentsCommentTargetsPrompt(activeChat?.id)
        if (momentsTargets) postParts.push(momentsTargets)
      }
    }

    // Planner L1, L2（L3 已合并到 <now> 块）
    if (plannerLayers.layer1) postParts.push(plannerLayers.layer1)
    if (plannerLayers.layer2) postParts.push(plannerLayers.layer2)
    if (plannerLayers.action) postParts.push(plannerLayers.action)

    // 角色情绪状态（拟真互动）
    let characterStatePrompt = ''
    if (settingsStore.allowLivenessEngine && activeChat?.id) {
      try {
        const livenessStore = getLivenessStore()
        const stateDesc = livenessStore.getStateDescription(activeChat.id)
        if (stateDesc) {
          characterStatePrompt = '<character_state>\n' + stateDesc + '\n</character_state>'
        }
        livenessStore.recordInteraction(activeChat.id)
      } catch {
        // liveness store not available
      }
    }

    // 用户刚看了动态
    if (chatStore.returnedFromMomentId) {
      const returnedMoment = getMomentsStore().getMomentById(chatStore.returnedFromMomentId)
      if (returnedMoment) {
        const preview = String(returnedMoment.content || '').slice(0, 100)
        postParts.push('<user_action>\n' + USER_ACTION_TEXT_PREFIX + preview + USER_ACTION_TEXT_SUFFIX + '\n</user_action>')
      }
      chatStore.returnedFromMomentId = null
    }

    const imageGenPrompt = buildImageGenerationPrompt()
    if (imageGenPrompt) postParts.push(imageGenPrompt)
    if (characterStatePrompt) postParts.push(characterStatePrompt)

    return postParts
  }

  return {
    buildDirectPostInstructionParts,
    buildGroupPostInstructionParts
  }
}
