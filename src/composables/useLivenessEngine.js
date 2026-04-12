/**
 * 拟真互动引擎 — 核心 composable
 *
 * 职责:
 * 1. 管理事件源的注册/启停
 * 2. 接收事件 → 调用 Decision LLM 决定是否行动
 * 3. 通过 Timing Layer 模拟真人节奏（延迟、已读、打字中）
 * 4. 将主动消息注入聊天记录
 * 5. 发送通知（灵动岛 / 浏览器推送）
 * 6. AI主动发动态
 * 7. 聊天时已读不回拦截（shouldSuppressReply）
 */
import { ref, watch } from 'vue'
import { useContactsStore } from '../stores/contacts'
import { useConfigsStore } from '../stores/configs'
import { useSettingsStore } from '../stores/settings'
import { useLivenessStore } from '../stores/liveness'
import { useMomentsStore } from '../stores/moments'
import { useChatStore } from '../stores/chat'
import { createKeepAliveController } from './liveness/keepAlive'
import { createProactiveDelivery } from './liveness/proactiveDelivery'
import {
  createHeartbeatSource,
  createUserActivitySource,
  createMomentsSource,
  createTimeTriggerSource,
  createPlannerTriggerSource,
  createScheduleTriggerSource
} from './liveness'
import {
  parseDecision,
  parseChatReadOnlyDecision,
  normalizeReadOnlyReason
} from './liveness/decisionParser'
import {
  buildChatReadOnlyPrompt,
  buildDecisionSystemPrompt,
  formatNowTimeHHMM,
  isPlannerEventActiveNow
} from './liveness/decisionPrompts'
import { callDecisionAPI } from './liveness/decisionApi'
import {
  collectRecentProactiveSummaries,
  countRecentGlobalProactiveMessages,
  countRecentProactiveMessages,
  getLatestGlobalProactiveTimestamp,
  hasRecentDuplicateAssistantMessage
} from './liveness/duplicateDetection'
import { buildContextMessages } from './api/contextWindow'
import { usePlannerStore } from '../stores/planner'
import { getBeijingDayStartTimestamp } from '../utils/beijingTime'
import { toLocalDateKey } from '../utils/dateKey'

const EVENT_COALESCE_WINDOW_MS = 90 * 1000
const DEFAULT_GLOBAL_PROACTIVE_COOLDOWN = 12 * 60 * 1000
const DEFAULT_PER_CONTACT_DAILY_CAP = 2
const DEFAULT_GLOBAL_DAILY_CAP = 6

function toPositiveNumber(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

function getStartOfLocalDay(now = Date.now()) {
  return getBeijingDayStartTimestamp(now)
}

function getEventMergeBucket(type) {
  const t = String(type || '').toLowerCase()
  if (t === 'heartbeat' || t === 'time_trigger' || t === 'user_return') return 'proactive_check'
  if (t === 'moment_post') return 'moment_post'
  return t
}

function createLivenessStoreAdapter({ contactsStore, configsStore, settingsStore }) {
  return {
    get activeChat() {
      return contactsStore.activeChat
    },
    get contacts() {
      return contactsStore.contacts
    },
    get configs() {
      return configsStore.configs
    },
    get getConfig() {
      return configsStore.getConfig
    },
    get allowLivenessEngine() {
      return settingsStore.allowLivenessEngine
    },
    get livenessConfig() {
      return settingsStore.livenessConfig
    },
    get allowPlannerAI() {
      return settingsStore.allowPlannerAI
    },
    get allowCharacterSchedule() {
      return settingsStore.allowCharacterSchedule
    }
  }
}

export function useLivenessEngine() {
  const contactsStore = useContactsStore()
  const configsStore = useConfigsStore()
  const settingsStore = useSettingsStore()
  const store = createLivenessStoreAdapter({ contactsStore, configsStore, settingsStore })
  const livenessStore = useLivenessStore()
  const chatStore = useChatStore()
  let momentsStore = null
  try { momentsStore = useMomentsStore() } catch { /* optional */ }

  const isRunning = ref(false)
  const eventQueue = ref([])
  let sources = []
  let processing = false
  let stopWatcher = null
  let stopKeepAliveWatcher = null
  let globalLastProactiveAt = 0

  const { startKeepAlive, stopKeepAlive } = createKeepAliveController({ store })
  const { deliverProactiveMessage, deliverProactiveMoment } = createProactiveDelivery({
    chatStore,
    hasRecentDuplicateAssistantMessage,
    livenessStore,
    momentsStore,
    store,
    setGlobalLastProactiveAt: (value) => {
      globalLastProactiveAt = value
    }
  })

  // ---- 事件接收 ----

  function emit(event) {
    const now = Date.now()
    const bucket = getEventMergeBucket(event?.type)
    if (event?.contactId) {
      const duplicatedInQueue = eventQueue.value.some((queued) => {
        if (!queued || queued.contactId !== event.contactId) return false
        if (getEventMergeBucket(queued.type) !== bucket) return false
        const queuedAt = Number(queued._queuedAt) || 0
        return queuedAt > 0 && now - queuedAt < EVENT_COALESCE_WINDOW_MS
      })
      if (duplicatedInQueue) return
    }
    livenessStore.pushEvent(event)
    eventQueue.value.push({ ...event, _queuedAt: now })
    processQueue()
  }

  // ---- 事件处理队列 ----

  async function processQueue() {
    if (processing) return
    processing = true
    try {
      while (eventQueue.value.length > 0) {
        const event = eventQueue.value.shift()
        if (!store.allowLivenessEngine) continue
        await handleEvent(event)
      }
    } finally {
      processing = false
    }
  }

  // ---- 本地预筛选（节省 API 调用） ----

  function shouldCallDecisionAPI(contactId, event) {
    const config = store.livenessConfig || {}
    const s = livenessStore.getState(contactId)
    const contact = store.contacts?.find(c => c.id === contactId)
    const now = Date.now()
    const eventType = String(event?.type || '').toLowerCase()
    const isMomentEvent = eventType === 'moment_post'
    const isHeartbeatEvent = eventType === 'heartbeat'
    const isTimeTriggerEvent = eventType === 'time_trigger'
    const isUserReturnEvent = eventType === 'user_return'

    if (globalLastProactiveAt <= 0) {
      globalLastProactiveAt = getLatestGlobalProactiveTimestamp(store.contacts || [])
    }
    const globalCooldown = toPositiveNumber(config.globalProactiveCooldown, DEFAULT_GLOBAL_PROACTIVE_COOLDOWN)
    if (globalLastProactiveAt > 0 && now - globalLastProactiveAt < globalCooldown) return false

    const dayStart = getStartOfLocalDay(now)
    const perContactDailyCap = Math.max(1, Math.floor(toPositiveNumber(config.proactiveDailyCap, DEFAULT_PER_CONTACT_DAILY_CAP)))
    if (countRecentProactiveMessages(contact, { sinceMs: dayStart, stopAfter: perContactDailyCap }) >= perContactDailyCap) return false

    const globalDailyCap = Math.max(1, Math.floor(toPositiveNumber(config.proactiveGlobalDailyCap, DEFAULT_GLOBAL_DAILY_CAP)))
    if (countRecentGlobalProactiveMessages(store.contacts || [], { sinceMs: dayStart, stopAfter: globalDailyCap }) >= globalDailyCap) return false

    // 冷却期内直接跳过（硬性限制）
    const cooldown = config.proactiveCooldown || 1800000
    if (now - (s.lastProactiveMsg || 0) < cooldown) return false

    // 动态事件：总是调 API（用户发了动态，角色应该有机会反应）
    if (isMomentEvent) return true

    // 用户忙碌检测：用户日程中 shareWithAI 的事件正在进行时，大幅降低主动消息概率
    if (store.allowPlannerAI && (isHeartbeatEvent || isTimeTriggerEvent)) {
      try {
        const plannerStore = usePlannerStore()
        const todayStr = toLocalDateKey()
        const userEvents = plannerStore.getEventsForDate(todayStr).filter(e => e.shareWithAI && !e.completed)
        const nowTime = formatNowTimeHHMM()
        const userBusy = userEvents.some(e => isPlannerEventActiveNow(e, nowTime))
        if (userBusy && Math.random() > 0.05) return false // 95% 抑制
      } catch { /* planner not available */ }
    }

    const idleHours = (now - s.lastInteraction) / 3600000
    if (idleHours > 24 && s.affection < 0.45) return false

    // 角色活跃度因子：好感度高 + 孤独感强 = 更主动
    // 范围 0~1，越高越容易触发
    const activeness = Math.min(1, s.affection * 0.5 + s.loneliness * 0.4 + (s.mood > 0.6 ? 0.1 : 0))

    // 心跳事件
    if (isHeartbeatEvent) {
      // 精力太低且好感度不够高，不主动
      if (s.energy < 0.15 && s.affection < 0.6) return false
      // 刚互动过：活跃度高的角色等待时间更短
      const minIdleHours = activeness > 0.75 ? 0.8 : activeness > 0.45 ? 1.8 : 3
      if (idleHours < minIdleHours) return false
      // 触发概率随活跃度动态调整
      // 活跃度 0.1 → 6.5% 概率, 0.5 → 20.5%, 0.8 → 31%, 1.0 → 38%
      const triggerChance = 0.03 + activeness * 0.35
      if (Math.random() > triggerChance) return false
    }

    // 时间触发（早安/晚安）：好感度越高越可能发
    if (isTimeTriggerEvent) {
      if (s.affection < 0.1) return false
      // 好感度低时只有小概率触发
      if (s.affection < 0.4 && Math.random() > s.affection) return false
      if (s.affection < 0.55 && Math.random() > s.affection * 0.6) return false
    }

    // 用户返回事件
    if (isUserReturnEvent) {
      if (s.affection < 0.15 && s.loneliness < 0.3) return false
      const awayMinutes = Number(event?.context?.awayMinutes) || 0
      if (awayMinutes < 15 && s.affection < 0.6) return false
    }

    return true
  }

  // ---- 核心: 处理单个事件 ----

  async function handleEvent(event) {
    const { contactId } = event
    if (!contactId) return

    const contact = store.contacts?.find(c => c.id === contactId)
    if (!contact) return

    // 本地预筛选：大部分事件在这里就被过滤掉，不调 API
    if (!shouldCallDecisionAPI(contactId, event)) return

    const config = store.livenessConfig || {}
    const cfgId = config.decisionConfigId || contact.configId
    const cfg = store.configs?.find(c => c.id === cfgId) || store.getConfig
    if (!cfg?.key) return

    const stateDesc = livenessStore.getStateDescription(contactId)
    const allowMoments = !!(config.allowProactiveMoments && momentsStore)
    const delayMin = config.proactiveDelayMin || 5
    const delayMax = config.proactiveDelayMax || 120
    const now = Date.now()
    const proactiveCount24h = countRecentProactiveMessages(contact, { sinceMs: now - (24 * 60 * 60 * 1000), maxScan: 60 })
    const recentProactiveSummaries = collectRecentProactiveSummaries(contact, {
      sinceMs: now - (24 * 60 * 60 * 1000),
      limit: 3
    })
    const systemPrompt = buildDecisionSystemPrompt(contact, stateDesc, event, {
      allowMoments,
      delayMin,
      delayMax,
      proactiveCount24h,
      recentProactiveSummaries
    })

    // 构建聊天历史上下文（复用正常聊天的 head+tail 结构）
    const allMsgs = (contact.msgs || [])
      .filter(m => m && !m.hideInChat && !m.hidden)
      .map(m => ({
        role: m.role,
        content: (m.content || '').slice(0, 300)
      }))
    const contextMsgs = buildContextMessages(allMsgs, {
      headRounds: 1,
      tailRounds: 4,
      middleSummary: contact.memory?.core?.length
        ? contact.memory.core.map(m => m.content || m).join('；')
        : null
    })

    const messages = [
      { role: 'system', content: systemPrompt },
      ...contextMsgs,
      { role: 'user', content: `根据当前的情境和你的内心状态，请决定你的行动。` }
    ]

    try {
      const responseText = await callDecisionAPI(cfg, messages)
      const decision = parseDecision(responseText, { delayMin, delayMax })

      if (decision.moodDelta) {
        const s = livenessStore.getState(contactId)
        livenessStore.adjustState(contactId, {
          mood: s.mood + decision.moodDelta
        })
      }

      if (decision.action === 'ignore') return

      if (decision.action === 'read_only') {
        livenessStore.pushEvent({
          type: 'decision_read_only',
          contactId,
          context: { reason: decision.reason }
        })
        return
      }

      if (decision.action === 'post_moment' && decision.momentContent && momentsStore) {
        await deliverProactiveMoment(contact, decision, config)
        return
      }

      if (decision.action === 'message' && decision.content) {
        await deliverProactiveMessage(contact, decision, config)
      }
    } catch (e) {
      console.warn('[LivenessEngine] Decision call failed:', e.message)
      livenessStore.pushEvent({
        type: 'decision_error',
        contactId,
        context: { error: e.message }
      })
    }
  }

  // ---- 聊天已读不回拦截（委托给独立导出函数） ----

  // ---- 生命周期 ----

  function start() {
    if (isRunning.value) return
    isRunning.value = true

    const ctx = { emit, store, livenessStore, momentsStore }

    sources = [
      createHeartbeatSource(ctx),
      createUserActivitySource(ctx),
      createTimeTriggerSource(ctx)
    ]

    if (momentsStore) {
      sources.push(createMomentsSource(ctx))
    }

    // 日程提醒事件源
    sources.push(createPlannerTriggerSource(ctx))

    // 日程感知事件源（角色日程生成 + 状态跟踪）
    if (store.allowCharacterSchedule) {
      sources.push(createScheduleTriggerSource(ctx))
    }

    globalLastProactiveAt = getLatestGlobalProactiveTimestamp(store.contacts || [])
    sources.forEach(s => s.start())
    startKeepAlive()
  }

  function stop() {
    if (!isRunning.value) return
    isRunning.value = false
    sources.forEach(s => s.stop())
    sources = []
    eventQueue.value = []
    stopKeepAlive()
  }

  function triggerEvent(event) {
    if (!store.allowLivenessEngine) return
    emit(event)
  }

  // ---- 自动启停（监听设置开关） ----

  function setupAutoToggle() {
    if (stopWatcher) stopWatcher()
    if (stopKeepAliveWatcher) stopKeepAliveWatcher()
    stopWatcher = watch(
      () => [store.allowLivenessEngine, store.allowCharacterSchedule],
      ([enabled, allowCharacterSchedule], previous) => {
        if (!enabled) {
          stop()
          return
        }
        if (!isRunning.value) {
          start()
          return
        }
        if (Array.isArray(previous) && previous[1] !== allowCharacterSchedule) {
          stop()
          start()
        }
      },
      { immediate: true }
    )
    stopKeepAliveWatcher = watch(
      () => [store.allowLivenessEngine, store.livenessConfig?.backgroundKeepAlive, store.livenessConfig?.notifyMode],
      ([enabled, keepAliveEnabled]) => {
        if (enabled && keepAliveEnabled) startKeepAlive()
        else stopKeepAlive()
      },
      { immediate: true }
    )
  }

  function destroy() {
    stop()
    if (stopWatcher) {
      stopWatcher()
      stopWatcher = null
    }
    if (stopKeepAliveWatcher) {
      stopKeepAliveWatcher()
      stopKeepAliveWatcher = null
    }
    stopKeepAlive()
  }

  return {
    isRunning,
    eventQueue,
    start,
    stop,
    destroy,
    triggerEvent,
    setupAutoToggle
  }
}

/**
 * 独立导出：聊天已读不回拦截
 * 供 useApi.js 直接 import 调用，无需实例化 composable
 * 返回 { suppress, reason } 而非简单 boolean，方便调用方做 UI 反馈
 */
export async function shouldSuppressReply(contactId, userMessage) {
  const contactsStore = useContactsStore()
  const configsStore = useConfigsStore()
  const settingsStore = useSettingsStore()
  const store = createLivenessStoreAdapter({ contactsStore, configsStore, settingsStore })
  if (!store.allowLivenessEngine) return { suppress: false }
  const config = store.livenessConfig || {}
  if (!config.allowChatReadOnly) return { suppress: false }
  const requireReason = !!config.showReadOnlyReasonToast

  const contact = store.contacts?.find(c => c.id === contactId)
  if (!contact) return { suppress: false }

  const cfgId = config.decisionConfigId || contact.configId
  const cfg = store.configs?.find(c => c.id === cfgId) || store.getConfig
  if (!cfg?.key) return { suppress: false }

  try {
    const livenessStore = useLivenessStore()
    const stateDesc = livenessStore.getStateDescription(contactId)
    const systemPrompt = buildChatReadOnlyPrompt(contact, stateDesc, userMessage, { requireReason })
    const recentMsgs = (contact.msgs || []).slice(-2).map(m => ({
      role: m.role,
      content: (m.content || '').slice(0, 120)
    }))
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMsgs
    ]
    const responseText = await callDecisionAPI(cfg, messages, {
      retries: 0,
      temperature: 0.2,
      timeoutMs: requireReason ? 4200 : 3500
    })
    const result = parseChatReadOnlyDecision(responseText)
    const normalizedReason = result.shouldReply
      ? ''
      : normalizeReadOnlyReason(result.reason)
    const finalReason = requireReason && !result.shouldReply
      ? (normalizedReason || '想先缓一会儿')
      : ''

    if (!result.shouldReply) {
      livenessStore.pushEvent({
        type: 'chat_read_only',
        contactId,
        context: { reason: finalReason, userMessage: (userMessage || '').slice(0, 50) }
      })
    }

    return { suppress: !result.shouldReply, reason: finalReason }
  } catch (e) {
    console.warn('[LivenessEngine] Chat read-only check failed:', e.message)
    return { suppress: false, error: e.message }
  }
}


