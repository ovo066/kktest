import { useContactsStore } from '../stores/contacts'
import { useConfigsStore } from '../stores/configs'
import { useSettingsStore } from '../stores/settings'
import { useMomentsStore } from '../stores/moments'
import { useChatStore } from '../stores/chat'
import { makeId } from '../utils/id'
import {
  getTemplateVars as getTemplateVarsRaw,
  applyTemplateVars,
  formatTimestampForAI,
  buildChatFormatSystemPrompt,
  buildReplyFormatSystemPrompt,
  buildPersonaSystemPrompt as buildPersonaSystemPromptRaw,
  buildStickerSystemPrompt as buildStickerSystemPromptRaw,
  buildSpecialFeaturesSystemPrompt as buildSpecialFeaturesSystemPromptRaw,
  buildImageGenerationPrompt as buildImageGenerationPromptRaw,
  buildUnifiedSystemPrompt,
  buildGroupSystemPrompt,
  insertLorebookEntries as insertLorebookEntriesRaw
} from './api/prompts'
import { usePromptContext } from './api/promptContext'
import {
  buildMomentsHintPrompt as buildMomentsHintPromptRaw,
  stripMomentBlocks as stripForumBlocks,
  parseMomentContent as parseMomentContentRaw
} from './api/momentsBlocks'
import { useDynamicIsland } from './useDynamicIsland'
import { useMemory } from './useMemory'
import { useMusicStore } from '../stores/music'
import { useToast } from './useToast'
import { getContextWindowedMsgs } from './api/contextWindowing'
import { createApiError, createApiFailureResult, trimText } from './api/errors'
import { stripImageTokensForDisplay } from './api/imageTokens'
import { fetchOpenAICompat, readOpenAICompatError } from './api/openaiCompat'
import { buildWeatherSummaryLine } from './useWeatherContext'
import {
  shouldAddReplyFormatPrompt,
  createStreamChunkBatcher as createStreamChunkBatcherRaw,
  applyForumOnlyPlaceholder as applyForumOnlyPlaceholderRaw
} from './api/responseHelpers'
import { resolveContextMessageImageUrls } from './api/messageHistoryBuilder'
import { createPostInstructionBuilder } from './api/postInstructionBuilder'
import { buildMusicContextBlock } from './api/musicContext'
import { buildToolCallingPrompt as buildToolCallingPromptRaw } from './api/tools'
import { stripPlannerActionBlocksForDisplay } from '../utils/plannerAssistantActions'
import { normalizeImageUrlForApi } from '../utils/imageData'
import { useSoundEffects } from './useSoundEffects'
import { useMcpBridge } from './useMcpBridge'
import { runDirectChatOrchestrator } from './api/chat/directChatOrchestrator'
import { runGroupChatOrchestrator } from './api/chat/groupChatOrchestrator'

export function useApi() {
  const contactsStore = useContactsStore()
  const configsStore = useConfigsStore()
  const settingsStore = useSettingsStore()
  const chatStore = useChatStore()
  const promptStore = usePromptContext()
  const { buildMemoryPrompt } = useMemory()
  const { showToast } = useToast()
  const soundEffects = useSoundEffects()
  const { discoverMcpTools } = useMcpBridge({ settingsStore, showToast })

  const makeMsgId = () => makeId('msg')

  const getTemplateVars = (charName) => getTemplateVarsRaw(promptStore, charName)
  const buildPersonaSystemPrompt = (contactId) => buildPersonaSystemPromptRaw(promptStore, contactId)
  const buildStickerSystemPrompt = (options = {}) => buildStickerSystemPromptRaw(promptStore, options)
  const buildSpecialFeaturesSystemPrompt = () => buildSpecialFeaturesSystemPromptRaw(promptStore)
  const buildImageGenerationPrompt = () => buildImageGenerationPromptRaw(promptStore)
  const buildToolCallingPrompt = (tools = []) => buildToolCallingPromptRaw(tools)
  const buildForumSystemPrompt = () => buildMomentsHintPromptRaw(settingsStore)
  const buildMusicContextPrompt = () => {
    try {
      const musicStore = useMusicStore()
      const ctx = musicStore.getMusicContext()
      return buildMusicContextBlock(ctx)
    } catch {
      return ''
    }
  }
  const buildWeatherLine = async () => {
    if (!settingsStore.enableWeatherContext) return ''
    try {
      return await buildWeatherSummaryLine(settingsStore)
    } catch {
      return ''
    }
  }
  const insertLorebookEntries = (messages, templateVars = {}) => {
    return insertLorebookEntriesRaw(promptStore, messages, templateVars)
  }

  const { buildDirectPostInstructionParts, buildGroupPostInstructionParts } = createPostInstructionBuilder({
    contactsStore,
    settingsStore,
    chatStore,
    buildWeatherLine,
    buildImageGenerationPrompt
  })

  function resolveConfig(configId = null) {
    return (configId ? configsStore.configs.find(config => config.id === configId) : null) || configsStore.getConfig
  }


  const FORUM_ONLY_PLACEHOLDER = '（已同步论坛内容，本次没有聊天文本）'
  const apiImageUrlCache = new WeakMap()

  function makeTraceId() {
    return makeId('trace')
  }

  function buildApiFailure(code, message, context = {}, options = {}) {
    return createApiFailureResult(
      createApiError(code, message, context, options),
      {
        context
      }
    )
  }

  async function resolveMessageImageUrlForApi(message, imageUrl) {
    const currentUrl = String(imageUrl || '').trim()
    if (!currentUrl) return currentUrl
    if (/^(?:https?:\/\/|data:image\/)/i.test(currentUrl)) return currentUrl

    const cached = apiImageUrlCache.get(message)
    if (cached?.sourceUrl === currentUrl && cached?.resolvedUrl) {
      return cached.resolvedUrl
    }

    const resolvedUrl = await normalizeImageUrlForApi(currentUrl)
    if (resolvedUrl) {
      apiImageUrlCache.set(message, {
        sourceUrl: currentUrl,
        resolvedUrl
      })
      return resolvedUrl
    }

    return currentUrl
  }

  async function resolveContextMessagesForApi(contextMsgs) {
    return await resolveContextMessageImageUrls(contextMsgs, resolveMessageImageUrlForApi)
  }

  function buildStreamingDisplayContent(content) {
    const withoutForumBlocks = stripForumBlocks(content)
    const withoutPlannerBlocks = stripPlannerActionBlocksForDisplay(withoutForumBlocks)
    return stripImageTokensForDisplay(withoutPlannerBlocks, settingsStore.allowAIImageGeneration)
  }

  function createStreamChunkBatcher(streamMsg, onChunk) {
    return createStreamChunkBatcherRaw(streamMsg, onChunk, buildStreamingDisplayContent)
  }


  function applyForumOnlyPlaceholder(msg, parsed) {
    return applyForumOnlyPlaceholderRaw(msg, parsed, {
      stripForumBlocks,
      trimText,
      placeholder: FORUM_ONLY_PLACEHOLDER
    })
  }

  function buildIslandPreview(text, fallback = '') {
    const compact = String(text || '').replace(/\s+/g, ' ').trim()
    return (compact || fallback).slice(0, 30)
  }

  function pushMomentsIslandNotifications(parsed, actor = {}) {
    if (!parsed) return

    const momentsCount = Number(parsed.moments || parsed.posts || 0)
    const repliesCount = Number(parsed.replies || 0)
    if (momentsCount <= 0 && repliesCount <= 0) return

    const { push } = useDynamicIsland()
    const momentsStore = useMomentsStore()
    const actorName = actor?.name || '好友'
    const actorAvatar = actor?.avatar
    const actorAvatarType = actor?.avatarType

    if (momentsCount > 0) {
      const createdMoment = (parsed.latestMomentId && momentsStore.getMomentById(parsed.latestMomentId)) || momentsStore.moments[0]
      if (createdMoment) {
        push({
          avatar: actorAvatar,
          avatarType: actorAvatarType,
          name: actorName,
          preview: buildIslandPreview(createdMoment.content || parsed.latestMomentContent, '发布了新动态'),
          momentId: createdMoment.id
        })
      }
    }

    if (repliesCount > 0) {
      const targetMoment = (parsed.latestReplyMomentId && momentsStore.getMomentById(parsed.latestReplyMomentId)) || momentsStore.moments[0]
      if (targetMoment) {
        const replyPreview = parsed.latestReplyContent
          ? `评论了：${String(parsed.latestReplyContent).replace(/\s+/g, ' ').trim()}`
          : '评论了动态'
        push({
          avatar: actorAvatar,
          avatarType: actorAvatarType,
          name: actorName,
          preview: buildIslandPreview(replyPreview, '评论了动态'),
          momentId: targetMoment.id
        })
      }
    }
  }

  // getContextWindowedMsgs moved to ./api/contextWindowing

  async function fetchModels() {
    const cfg = resolveConfig()
    if (!cfg.url || !cfg.key) {
      return buildApiFailure('CONFIG_MISSING', '请先填写 URL 和 Key', {
        feature: 'chat',
        action: 'fetchModels'
      })
    }

    try {
      const { response: res } = await fetchOpenAICompat(cfg.url, {
        path: '/models',
        method: 'GET',
        apiKey: cfg.key,
        contentType: false
      })
      if (!res.ok) throw new Error(await readOpenAICompatError(res))
      const data = await res.json()
      let models = []
      if (data.data && Array.isArray(data.data)) {
        models = data.data.map(m => m.id).filter(Boolean).sort()
      }
      if (models.length === 0) {
        throw createApiError('MODEL_LIST_EMPTY', '未找到模型', {
          feature: 'chat',
          action: 'fetchModels'
        })
      }
      return { success: true, models }
    } catch (e) {
      return createApiFailureResult(e, {
        context: {
          feature: 'chat',
          action: 'fetchModels'
        }
      })
    }
  }

  const orchestrationContext = {
    contactsStore,
    settingsStore,
    chatStore,
    promptStore,
    showToast,
    soundEffects,
    makeMsgId,
    resolveConfig,
    makeTraceId,
    buildApiFailure,
    getTemplateVars,
    applyTemplateVars,
    buildPersonaSystemPrompt,
    buildStickerSystemPrompt,
    buildSpecialFeaturesSystemPrompt,
    buildToolCallingPrompt,
    buildForumSystemPrompt,
    buildMemoryPrompt,
    buildMusicContextPrompt,
    discoverMcpTools,
    buildChatFormatSystemPrompt,
    shouldAddReplyFormatPrompt,
    buildReplyFormatSystemPrompt,
    buildUnifiedSystemPrompt,
    buildGroupSystemPrompt,
    getContextWindowedMsgs,
    resolveContextMessagesForApi,
    insertLorebookEntries,
    buildDirectPostInstructionParts,
    buildGroupPostInstructionParts,
    createStreamChunkBatcher,
    buildStreamingDisplayContent,
    parseMomentContent: parseMomentContentRaw,
    applyForumOnlyPlaceholder,
    pushMomentsIslandNotifications,
    stripForumBlocks,
    forumOnlyPlaceholder: FORUM_ONLY_PLACEHOLDER
  }

  function callAPI(onChunk) {
    return runDirectChatOrchestrator(orchestrationContext, onChunk)
  }

  function callGroupAPI(onChunk) {
    return runGroupChatOrchestrator(orchestrationContext, onChunk)
  }

  return {
    fetchModels,
    callAPI,
    callGroupAPI,
    formatTimestampForAI
  }
}
