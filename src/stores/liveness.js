import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 活人感引擎 - 状态存储
 *
 * 每个联系人维护一组"角色状态"变量，随时间自然衰减/增长，
 * 注入到 Decision LLM 的 prompt 中影响角色行为。
 *
 * 状态模型 (ContactLivenessState):
 *   mood       0-1  情绪（1=开心，0=低落）—— 对话情感分析调整
 *   energy     0-1  精力（回复消耗，"睡眠"恢复）
 *   affection  0-1  好感度（长期积累，正向互动+，负向互动-）
 *   loneliness 0-1  孤独感（用户不在线时增长，互动后归零）
 *   lastInteraction  上次互动时间戳
 *   lastDecayAt  上次执行衰减时间戳
 *   lastProactiveMsg 上次主动消息时间戳
 */

// 默认状态
function defaultState() {
  return {
    mood: 0.7,
    energy: 0.8,
    affection: 0.3,
    loneliness: 0,
    lastInteraction: Date.now(),
    lastDecayAt: Date.now(),
    lastProactiveMsg: 0
  }
}

// 衰减/增长常量（每小时变化量）
const DECAY = {
  energy: -0.02,       // 精力自然消耗
  loneliness: 0.05,    // 孤独感增长
  mood: -0.01          // 心情缓慢回落到中性
}

const MOOD_NEUTRAL = 0.5

export const useLivenessStore = defineStore('liveness', () => {
  // 每个联系人的状态 Map: { [contactId]: ContactLivenessState }
  const states = ref({})

  // 事件日志（环形缓冲，最多保留 200 条）
  const eventLog = ref([])
  const EVENT_LOG_MAX = 200

  // ---- 状态访问 ----

  function getState(contactId) {
    if (!states.value[contactId]) {
      states.value[contactId] = defaultState()
    }
    return states.value[contactId]
  }

  function hasState(contactId) {
    return !!states.value[contactId]
  }

  // ---- 状态更新 ----

  function clamp01(v) { return Math.max(0, Math.min(1, v)) }

  /** 应用时间衰减（基于距上次更新的时间差） */
  function applyDecay(contactId) {
    const s = getState(contactId)
    const now = Date.now()
    const fromTs = Number(s.lastDecayAt || s.lastInteraction || now)
    const hours = (now - fromTs) / 3600000
    if (hours < 0.01) return s // 不到 36 秒，跳过

    s.energy = clamp01(s.energy + DECAY.energy * hours)
    s.loneliness = clamp01(s.loneliness + DECAY.loneliness * hours)
    // mood 向中性回归
    if (s.mood > MOOD_NEUTRAL) {
      s.mood = clamp01(Math.max(MOOD_NEUTRAL, s.mood + DECAY.mood * hours))
    } else if (s.mood < MOOD_NEUTRAL) {
      s.mood = clamp01(Math.min(MOOD_NEUTRAL, s.mood - DECAY.mood * hours))
    }
    s.lastDecayAt = now
    return s
  }

  /** 记录一次用户互动（重置孤独感，消耗精力） */
  function recordInteraction(contactId, sentiment = 0) {
    const s = getState(contactId)
    const now = Date.now()
    s.lastInteraction = now
    s.lastDecayAt = now
    s.loneliness = clamp01(s.loneliness - 0.3)
    s.energy = clamp01(s.energy - 0.03)
    // sentiment: -1 ~ +1，影响 mood 和 affection
    if (sentiment !== 0) {
      s.mood = clamp01(s.mood + sentiment * 0.1)
      s.affection = clamp01(s.affection + sentiment * 0.02)
    }
    return s
  }

  /** 记录一次主动消息发送 */
  function recordProactiveMsg(contactId) {
    const s = getState(contactId)
    const now = Date.now()
    s.lastProactiveMsg = now
    s.lastDecayAt = now
    s.energy = clamp01(s.energy - 0.05)
    s.loneliness = clamp01(s.loneliness - 0.1)
    return s
  }

  /** 直接设置某个状态值（用于 Decision LLM 返回的调整） */
  function adjustState(contactId, patch) {
    const s = getState(contactId)
    for (const [k, v] of Object.entries(patch)) {
      if (k in s && typeof v === 'number') {
        s[k] = clamp01(v)
      }
    }
    return s
  }

  /** 重置某个联系人的状态 */
  function resetState(contactId) {
    states.value[contactId] = defaultState()
  }

  // ---- 事件日志 ----

  function pushEvent(event) {
    eventLog.value.push({
      ...event,
      time: Date.now()
    })
    if (eventLog.value.length > EVENT_LOG_MAX) {
      eventLog.value = eventLog.value.slice(-EVENT_LOG_MAX)
    }
  }

  /** 获取某联系人最近 N 条事件 */
  function getRecentEvents(contactId, limit = 10) {
    return eventLog.value
      .filter(e => e.contactId === contactId)
      .slice(-limit)
  }

  // ---- 快照 / 恢复（用于持久化） ----

  function exportData() {
    return {
      states: JSON.parse(JSON.stringify(states.value)),
      eventLog: eventLog.value.slice(-50) // 只持久化最近 50 条
    }
  }

  function importData(data) {
    if (data?.states && typeof data.states === 'object') {
      states.value = data.states
      const now = Date.now()
      for (const [contactId, state] of Object.entries(states.value)) {
        if (!state || typeof state !== 'object') {
          states.value[contactId] = defaultState()
          continue
        }
        const fallbackTs = Number(state.lastInteraction) || now
        const decayTs = Number(state.lastDecayAt)
        state.lastDecayAt = (Number.isFinite(decayTs) && decayTs > 0) ? decayTs : fallbackTs
      }
    }
    if (Array.isArray(data?.eventLog)) {
      eventLog.value = data.eventLog
    }
  }

  // ---- 辅助计算 ----

  /** 获取状态摘要文本（注入 prompt 用，自然语言描述） */
  function getStateDescription(contactId) {
    const s = applyDecay(contactId)
    const moodLabel = s.mood > 0.7 ? '心情不错' : s.mood > 0.4 ? '心情平静' : '心情有些低落'
    const energyLabel = s.energy > 0.6 ? '精力充沛' : s.energy > 0.3 ? '精力一般' : '有些疲惫'
    const affLabel = s.affection > 0.7 ? '和对方关系亲密' : s.affection > 0.4 ? '和对方关系友好' : s.affection > 0.2 ? '和对方关系一般' : '对对方有些冷淡'
    const lonelyLabel = s.loneliness > 0.7 ? '非常想念对方' : s.loneliness > 0.4 ? '有些想念对方' : ''

    const idleMs = Date.now() - s.lastInteraction
    const idleHours = idleMs / 3600000
    const idleLabel = idleHours < 0.5 ? '刚互动过' : idleHours < 2 ? '不久前互动过' : idleHours < 6 ? '有一阵没互动了' : '很久没互动了'

    const parts = [moodLabel, energyLabel, affLabel]
    if (lonelyLabel) parts.push(lonelyLabel)
    parts.push(idleLabel)
    return '你现在' + parts.join('，') + '。'
  }

  return {
    states,
    eventLog,
    getState,
    hasState,
    applyDecay,
    recordInteraction,
    recordProactiveMsg,
    adjustState,
    resetState,
    pushEvent,
    getRecentEvents,
    exportData,
    importData,
    getStateDescription
  }
})
