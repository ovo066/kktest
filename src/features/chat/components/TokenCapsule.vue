<template>
  <div class="token-capsule">
    <!-- Collapsed pill -->
    <div v-if="!expanded" class="capsule-pill" @click.stop="expanded = true">
      <i class="ph ph-chart-pie-slice" style="font-size: 11px; opacity: 0.7;"></i>
      <span>{{ totalDisplay }}</span>
    </div>

    <!-- Expanded panel -->
    <Transition name="capsule-expand">
      <div v-if="expanded" class="capsule-panel" @click.stop>
        <div class="flex items-center justify-between mb-2">
          <span class="text-[13px] font-semibold" style="color: var(--text-primary);">对话统计</span>
          <button class="text-[16px] leading-none opacity-50 active:opacity-80" style="color: var(--text-secondary);" @click.stop="expanded = false">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <!-- Companion days -->
        <div class="text-center py-2 mb-2" style="border-bottom: 1px solid var(--token-capsule-separator);">
          <div class="text-[22px] font-light tabular-nums" style="color: var(--primary-color, #007AFF);">
            {{ companionDays }}
          </div>
          <div class="text-[11px] opacity-60" style="color: var(--text-secondary);">
            陪伴天数
          </div>
        </div>

        <!-- Token stats -->
        <div class="space-y-1.5 text-[12px]">
          <div class="flex justify-between">
            <span style="color: var(--text-secondary);">总消耗</span>
            <span class="font-medium tabular-nums" style="color: var(--text-primary);">{{ formattedTotal }} tokens</span>
          </div>
          <div v-if="hasTotalBreakdown" class="flex justify-between text-[11px]">
            <span class="opacity-50" style="color: var(--text-secondary);">↑输入 / ↓输出</span>
            <span class="tabular-nums opacity-65" style="color: var(--text-primary);">{{ formattedTotalPrompt }} / {{ formattedTotalCompletion }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--text-secondary);">API 调用</span>
            <span class="tabular-nums" style="color: var(--text-primary);">{{ callCountDisplay }} 次</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--text-secondary);">最近一次</span>
            <span class="tabular-nums" style="color: var(--text-primary);">{{ latestCallDisplay }}</span>
          </div>
        </div>

        <!-- Breakdown -->
        <div class="mt-2 pt-2" style="border-top: 1px solid var(--token-capsule-separator);">
          <div class="text-[11px] opacity-50 mb-1.5" style="color: var(--text-secondary);">上下文估算</div>

          <!-- Bar -->
          <div class="h-2 rounded-full overflow-hidden flex" style="background: var(--token-capsule-breakdown-bg);">
            <div class="h-full transition-all duration-300" style="background: #5B8DEF;" :style="{ width: personaPct + '%' }"></div>
            <div class="h-full transition-all duration-300" style="background: #F5A623;" :style="{ width: lorebookPct + '%' }"></div>
            <div class="h-full transition-all duration-300" style="background: #7ED38C;" :style="{ width: historyPct + '%' }"></div>
            <div class="h-full transition-all duration-300" style="background: var(--token-capsule-system-color);" :style="{ width: systemPct + '%' }"></div>
          </div>

          <!-- Legend -->
          <div class="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px]">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full shrink-0" style="background: #5B8DEF;"></span>
              <span style="color: var(--text-secondary);">人设</span>
              <span class="ml-auto tabular-nums" style="color: var(--text-primary);">{{ formatTokenCount(personaDisplayTokens) }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full shrink-0" style="background: #F5A623;"></span>
              <span style="color: var(--text-secondary);">世界书(自定义)</span>
              <span class="ml-auto tabular-nums" style="color: var(--text-primary);">{{ formatTokenCount(lorebookDisplayTokens) }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full shrink-0" style="background: #7ED38C;"></span>
              <span style="color: var(--text-secondary);">历史</span>
              <span class="ml-auto tabular-nums" style="color: var(--text-primary);">{{ formatTokenCount(historyDisplayTokens) }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full shrink-0" style="background: var(--token-capsule-system-color);"></span>
              <span style="color: var(--text-secondary);">系统</span>
              <span class="ml-auto tabular-nums" style="color: var(--text-primary);">{{ formatTokenCount(systemDisplayTokens) }}</span>
            </div>
          </div>
          <div class="text-[10px] mt-1 opacity-45" style="color: var(--text-secondary);">
            {{ contact?.type === 'group' ? '群聊提示词' : '角色' }} {{ formatTokenCount(characterPersonaDisplayTokens) }} + 面具 {{ formatTokenCount(userPersonaDisplayTokens) }}
          </div>
          <div v-if="systemDetailItems.length > 0" class="text-[10px] mt-0.5 opacity-45" style="color: var(--text-secondary);">
            {{ systemDetailItems.join(' + ') }}
          </div>
        </div>

        <!-- Per-call usage -->
        <div class="mt-2 pt-2" style="border-top: 1px solid var(--token-capsule-separator);">
          <div class="text-[11px] opacity-50 mb-1.5" style="color: var(--text-secondary);">最近单次消耗</div>
          <div v-if="recentCalls.length === 0" class="text-[11px] opacity-50" style="color: var(--text-secondary);">
            暂无明细
          </div>
          <div
            v-for="(call, idx) in recentCalls"
            :key="call.time + '_' + idx"
            class="flex items-center justify-between text-[11px] py-0.5"
          >
            <span class="tabular-nums opacity-70" style="color: var(--text-secondary);">{{ formatCallTime(call.time) }}</span>
            <span class="tabular-nums" style="color: var(--text-primary);">{{ formatCallDisplay(call) }}</span>
          </div>
        </div>

        <!-- Hide button -->
        <button
          class="w-full mt-2 pt-2 text-[11px] opacity-40 active:opacity-60 text-center"
          style="border-top: 1px solid var(--token-capsule-separator); color: var(--text-secondary);"
          @click.stop="$emit('hide')"
        >
          隐藏统计胶囊
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useConfigsStore } from '../../../stores/configs'
import { usePersonasStore } from '../../../stores/personas'
import { useSettingsStore } from '../../../stores/settings'
import { estimateTokensForModel, formatTokenCount, preloadTokenEstimatorForModel } from '../../../utils/tokenEstimate'
import {
  buildChatFormatSystemPrompt,
  buildImageGenerationPrompt as buildImageGenerationPromptForEstimate,
  buildStickerSystemPrompt as buildStickerSystemPromptForEstimate,
  getTemplateVars as getPromptTemplateVars,
  insertLorebookEntries as insertLorebookEntriesForEstimate
} from '../../../composables/api/prompts'
import { usePromptContext } from '../../../composables/api/promptContext'

const props = defineProps({
  contact: { type: Object, default: null }
})

defineEmits(['hide'])

const configsStore = useConfigsStore()
const personasStore = usePersonasStore()
const settingsStore = useSettingsStore()
const promptStore = usePromptContext()
const expanded = ref(false)
const estimatedTotalTokens = ref(0)
const estimatedCallCount = ref(0)
const tokenEstimatorTick = ref(0)

// Click outside to collapse
function handleClickOutside(e) {
  if (expanded.value && !e.target.closest('.token-capsule')) {
    expanded.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true)
})

const modelName = computed(() => {
  const cfg = configsStore.configs.find(c => c.id === props.contact?.configId) || configsStore.getConfig
  return cfg?.model || ''
})

// Companion days from first message
const companionDays = computed(() => {
  const msgs = props.contact?.msgs || []
  if (msgs.length === 0) return 0
  const firstTime = msgs[0]?.time
  if (!firstTime) return 0
  return Math.max(1, Math.ceil((Date.now() - firstTime) / (1000 * 60 * 60 * 24)))
})

// Token stats from actual API usage
const tokenStats = computed(() => props.contact?.tokenStats || {})
const totalTokens = computed(() => (tokenStats.value.totalPromptTokens || 0) + (tokenStats.value.totalCompletionTokens || 0))
const callCount = computed(() => tokenStats.value.callCount || 0)
const lastCalls = computed(() => Array.isArray(tokenStats.value.lastCalls) ? tokenStats.value.lastCalls : [])
const estimateScale = computed(() => {
  const scale = tokenStats.value?.estimateScale
  const prompt = Number(scale?.prompt)
  const total = Number(scale?.total)
  const base = Number.isFinite(prompt) && prompt > 0
    ? prompt
    : (Number.isFinite(total) && total > 0 ? total : 1)
  return Math.min(1.8, Math.max(0.55, base))
})
const estimatorKey = computed(() => `${modelName.value}::${estimateScale.value.toFixed(3)}`)

function t(text) {
  const tick = tokenEstimatorTick.value
  void tick
  const base = estimateTokensForModel(text, modelName.value)
  const scaled = Math.round(base * estimateScale.value)
  return Math.max(0, scaled)
}

let recomputeTimer = null
let cacheContactId = null
const msgTokenCache = new Map()

function getMsgContentKey(m) {
  if (!m) return ''
  if (typeof m.content === 'string') return m.content
  if (m.content == null) return ''
  try {
    return JSON.stringify(m.content)
  } catch {
    return String(m.content)
  }
}

function estimateMsgTokens(m) {
  const id = m?.id
  const key = getMsgContentKey(m)
  if (!key) return 0
  if (id != null) {
    const cached = msgTokenCache.get(id)
    if (cached && cached.key === key && cached.estimator === estimatorKey.value) return cached.tokens
  }
  const tokens = t(key)
  if (id != null) {
    msgTokenCache.set(id, { key, tokens, estimator: estimatorKey.value })
  }
  return tokens
}

function recomputeEstimatedTotals() {
  const contact = props.contact
  const msgs = contact?.msgs || []
  if (cacheContactId !== contact?.id) {
    msgTokenCache.clear()
    cacheContactId = contact?.id || null
  }

  // Treat each non-error assistant message as one API call.
  const assistantIdxs = []
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]
    if (!m || m.hidden || m.hideInChat) continue
    if (m.role !== 'assistant') continue
    if (m.errorCode) continue
    assistantIdxs.push(i)
  }
  estimatedCallCount.value = assistantIdxs.length

  const windowSize = 20
  const staticTokens = personaEst.value + lorebookEst.value + systemEst.value + 10
  let total = 0

  if (assistantIdxs.length > 0) {
    for (const idx of assistantIdxs) {
      let promptTokens = staticTokens
      const start = Math.max(0, idx - windowSize)
      for (let j = start; j < idx; j++) {
        const m = msgs[j]
        if (!m || m.hidden || m.hideInChat) continue
        promptTokens += estimateMsgTokens(m) + 4
      }
      const completionTokens = estimateMsgTokens(msgs[idx]) + 4
      total += promptTokens + completionTokens
    }
  } else if (msgs.length > 0) {
    // No assistant msgs (or old data): fall back to transcript size + static prompts.
    total = staticTokens
    msgs.forEach(m => {
      if (!m || m.hidden || m.hideInChat) return
      total += estimateMsgTokens(m) + 4
    })
  }

  estimatedTotalTokens.value = Math.max(0, Math.round(total))
}

function scheduleRecompute() {
  if (recomputeTimer) clearTimeout(recomputeTimer)
  recomputeTimer = setTimeout(() => {
    recomputeTimer = null
    recomputeEstimatedTotals()
  }, 280)
}

watch(() => props.contact?.id, () => {
  cacheContactId = null
  msgTokenCache.clear()
  scheduleRecompute()
}, { immediate: true })

watch(() => props.contact?.msgs?.length, scheduleRecompute)
watch(() => props.contact?.msgs?.[props.contact?.msgs?.length - 1]?.content, scheduleRecompute)
watch([expanded, modelName], async ([isExpanded, value]) => {
  if (!isExpanded) return
  const loaded = await preloadTokenEstimatorForModel(value)
  if (!loaded) return
  tokenEstimatorTick.value += 1
  msgTokenCache.clear()
  scheduleRecompute()
}, { immediate: true })

onMounted(() => {
  scheduleRecompute()
})

onBeforeUnmount(() => {
  if (recomputeTimer) {
    clearTimeout(recomputeTimer)
    recomputeTimer = null
  }
})

// Formatted display
function getCallTotalTokens(call) {
  if (!call || typeof call !== 'object') return 0
  const direct = Number(call.totalTokens || 0)
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct)
  const prompt = Number(call.promptTokens || 0)
  const completion = Number(call.completionTokens || 0)
  return Math.max(0, Math.round((Number.isFinite(prompt) ? prompt : 0) + (Number.isFinite(completion) ? completion : 0)))
}

function formatCallTime(ts) {
  if (!ts) return '--:--'
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatCallDisplay(call) {
  const prompt = toSafe(call?.promptTokens)
  const completion = toSafe(call?.completionTokens)
  if (prompt > 0 || completion > 0) {
    return `↑${formatTokenCount(prompt)} ↓${formatTokenCount(completion)}`
  }
  const total = getCallTotalTokens(call)
  if (total <= 0) return '--'
  return formatTokenCount(total)
}

function toSafe(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

function normalizePromptBreakdownShape(raw) {
  if (!raw || typeof raw !== 'object') return null
  const persona = toSafe(raw.persona)
  const lorebook = toSafe(raw.lorebook)
  const history = toSafe(raw.history)
  const system = toSafe(raw.system)
  const characterPersona = toSafe(raw.personaParts?.characterPersona)
  const userPersona = toSafe(raw.personaParts?.userPersona)
  const systemCore = toSafe(raw.systemParts?.systemCore)
  const outputFormat = toSafe(raw.systemParts?.outputFormat)
  const presetImageRule = toSafe(raw.systemParts?.presetImageRule)
  const sticker = toSafe(raw.systemParts?.sticker)
  const total = persona + lorebook + history + system
  if (total <= 0) return null
  return {
    persona,
    lorebook,
    history,
    system,
    total,
    personaParts: {
      characterPersona,
      userPersona,
      total: characterPersona + userPersona
    },
    systemParts: {
      systemCore,
      outputFormat,
      presetImageRule,
      sticker,
      total: systemCore + outputFormat + presetImageRule + sticker
    }
  }
}

const recentCalls = computed(() => lastCalls.value.slice(0, 5))
const latestCall = computed(() => recentCalls.value[0] || null)
const latestCallDisplay = computed(() => formatCallDisplay(latestCall.value))
const lastCallsTotalTokens = computed(() => lastCalls.value.reduce((sum, call) => sum + getCallTotalTokens(call), 0))
const latestPromptBreakdown = computed(() => normalizePromptBreakdownShape(latestCall.value?.promptBreakdown))

const effectiveTotalTokens = computed(() => {
  if (totalTokens.value > 0) return totalTokens.value
  if (lastCallsTotalTokens.value > 0) return lastCallsTotalTokens.value
  return estimatedTotalTokens.value || 0
})

const totalDisplay = computed(() => {
  const t = effectiveTotalTokens.value
  if (t === 0) return '--'
  return formatTokenCount(t)
})
const formattedTotal = computed(() => {
  const t = effectiveTotalTokens.value
  if (t === 0) return '暂无数据'
  return formatTokenCount(t)
})
const effectiveTotalPrompt = computed(() => {
  const fromStats = tokenStats.value.totalPromptTokens || 0
  if (fromStats > 0) return fromStats
  return lastCalls.value.reduce((sum, c) => sum + toSafe(c.promptTokens), 0)
})
const effectiveTotalCompletion = computed(() => {
  const fromStats = tokenStats.value.totalCompletionTokens || 0
  if (fromStats > 0) return fromStats
  return lastCalls.value.reduce((sum, c) => sum + toSafe(c.completionTokens), 0)
})
const hasTotalBreakdown = computed(() => effectiveTotalPrompt.value > 0 || effectiveTotalCompletion.value > 0)
const formattedTotalPrompt = computed(() => {
  const t = effectiveTotalPrompt.value
  return t > 0 ? formatTokenCount(t) : '--'
})
const formattedTotalCompletion = computed(() => {
  const t = effectiveTotalCompletion.value
  return t > 0 ? formatTokenCount(t) : '--'
})
const callCountDisplay = computed(() => {
  const c = callCount.value || 0
  if (c > 0) return String(c)
  if (lastCalls.value.length > 0) return String(lastCalls.value.length)
  const est = estimatedCallCount.value || 0
  if (est <= 0) return '--'
  return String(est)
})

// Breakdown estimates (current context, reactive)
const userPersonaEst = computed(() => {
  const personaId = props.contact?.personaId || personasStore.defaultPersonaId
  if (!personaId) return 0
  const persona = personasStore.personas.find(p => p.id === personaId)
  if (!persona) return 0
  let text = ''
  if (persona.name) text += persona.name
  if (persona.description) text += persona.description
  return t(text) + 10
})

const characterPersonaEst = computed(() => {
  const contact = props.contact
  // Group chat: estimate the group system prompt that combines all members' prompts
  if (contact?.type === 'group' && Array.isArray(contact.members) && contact.members.length > 0) {
    const members = contact.members
    const memberList = members.map(m => {
      let desc = `- ${m.name || ''}`
      if (m.prompt) desc += `：${m.prompt}`
      return desc
    }).join('\n')
    const groupPrompt = `你正在模拟一个群聊场景。群里有以下成员：\n${memberList}\n\n重要规则：\n1. 你需要模拟这些角色之间的对话\n2. 每条消息必须以 [角色名]: 开头\n3. 可以让多个角色发言\n4. 保持每个角色的性格一致\n5. 用户的消息会以 [用户]: 开头\n6. 根据对话内容自然地选择哪些角色应该回应`
    return t(groupPrompt)
  }
  const prompt = typeof contact?.prompt === 'string' ? contact.prompt.trim() : ''
  return t(prompt)
})

const personaEst = computed(() => userPersonaEst.value + characterPersonaEst.value)

const promptTemplateVars = computed(() => getPromptTemplateVars(promptStore, props.contact?.name))

function collectInjectedLorebookSystemMessages() {
  if (!promptStore.activeChat) return []
  const seeded = [{ role: 'system', content: '<seed />' }]
  const injected = insertLorebookEntriesForEstimate(promptStore, seeded, promptTemplateVars.value)
  if (!Array.isArray(injected) || injected.length <= 1) return []
  return injected
    .slice(1)
    .filter(msg => msg?.role === 'system')
    .map(msg => String(msg?.content || '').trim())
    .filter(Boolean)
}

function estimateTextArrayTokens(texts = []) {
  if (!Array.isArray(texts) || texts.length === 0) return 0
  return texts.reduce((sum, text) => sum + t(text), 0)
}

const lorebookTextsUserBooks = computed(() => collectInjectedLorebookSystemMessages())

const lorebookEst = computed(() => {
  return estimateTextArrayTokens(lorebookTextsUserBooks.value)
})

const presetImageRuleEst = computed(() => {
  const prompt = buildImageGenerationPromptForEstimate(promptStore)
  if (!prompt) return 0
  return t(prompt)
})

const outputFormatEst = computed(() => {
  const prompt = buildChatFormatSystemPrompt(promptStore, promptTemplateVars.value)
  if (!prompt) return 0
  return t('<output_format>\n' + prompt + '\n</output_format>')
})

const historyEst = computed(() => {
  const msgs = props.contact?.msgs || []
  const recent = msgs.slice(-20)
  let total = 0
  recent.forEach(m => {
    total += t(m.content || '') + 4
  })
  return total
})

const stickerSystemPrompt = computed(() => {
  return buildStickerSystemPromptForEstimate(promptStore)
})

const stickerEst = computed(() => {
  if (!stickerSystemPrompt.value) return 0
  return t(stickerSystemPrompt.value)
})

const systemCoreEst = computed(() => {
  const lines = []
  if (settingsStore.sendTimestampsToAI) {
    lines.push('Current time + last user message time')
  }
  if (settingsStore.allowAICall) lines.push('Call token enabled: (call:voice|video:text)')
  if (settingsStore.allowAITransfer) lines.push('Transfer card feature enabled')
  if (settingsStore.allowAIGift) lines.push('Gift card feature enabled')
  if (settingsStore.allowAIVoice) lines.push('Voice bubble feature enabled')
  if (settingsStore.allowAIMockImage) lines.push('Mock image feature enabled')
  return t(lines.join('\n'))
})

const systemPresetEst = computed(() => outputFormatEst.value + presetImageRuleEst.value)
const systemEst = computed(() => systemCoreEst.value + stickerEst.value + systemPresetEst.value)
const systemDetailItems = computed(() => {
  const items = []
  if (systemCoreDisplayTokens.value > 0) items.push('系统 ' + formatTokenCount(systemCoreDisplayTokens.value))
  if (outputFormatDisplayTokens.value > 0) items.push('格式预设 ' + formatTokenCount(outputFormatDisplayTokens.value))
  if (presetImageRuleDisplayTokens.value > 0) items.push('生图规则 ' + formatTokenCount(presetImageRuleDisplayTokens.value))
  if (stickerDisplayTokens.value > 0) items.push('表情包 ' + formatTokenCount(stickerDisplayTokens.value))
  return items
})

const characterPersonaDisplayTokens = computed(() => latestPromptBreakdown.value?.personaParts?.characterPersona ?? characterPersonaEst.value)
const userPersonaDisplayTokens = computed(() => latestPromptBreakdown.value?.personaParts?.userPersona ?? userPersonaEst.value)
const personaDisplayTokens = computed(() => latestPromptBreakdown.value?.persona ?? personaEst.value)
const lorebookDisplayTokens = computed(() => latestPromptBreakdown.value?.lorebook ?? lorebookEst.value)
const historyDisplayTokens = computed(() => latestPromptBreakdown.value?.history ?? historyEst.value)
const systemCoreDisplayTokens = computed(() => latestPromptBreakdown.value?.systemParts?.systemCore ?? systemCoreEst.value)
const outputFormatDisplayTokens = computed(() => latestPromptBreakdown.value?.systemParts?.outputFormat ?? outputFormatEst.value)
const presetImageRuleDisplayTokens = computed(() => latestPromptBreakdown.value?.systemParts?.presetImageRule ?? presetImageRuleEst.value)
const stickerDisplayTokens = computed(() => latestPromptBreakdown.value?.systemParts?.sticker ?? stickerEst.value)
const systemDisplayTokens = computed(() => latestPromptBreakdown.value?.system ?? systemEst.value)

watch([personaEst, lorebookEst, systemEst, modelName, estimateScale], scheduleRecompute)

// Breakdown percentages
const totalEst = computed(() => Math.max(1, personaDisplayTokens.value + lorebookDisplayTokens.value + historyDisplayTokens.value + systemDisplayTokens.value))
const personaPct = computed(() => Math.round(personaDisplayTokens.value / totalEst.value * 100))
const lorebookPct = computed(() => Math.round(lorebookDisplayTokens.value / totalEst.value * 100))
const historyPct = computed(() => Math.round(historyDisplayTokens.value / totalEst.value * 100))
const systemPct = computed(() => Math.max(0, 100 - personaPct.value - lorebookPct.value - historyPct.value))
</script>

<style scoped>
.token-capsule {
  --token-capsule-separator: var(--border-color);
  --token-capsule-breakdown-bg: var(--border-color);
  --token-capsule-system-color: var(--text-secondary);
  --token-capsule-pill-bg-start: var(--card-bg);
  --token-capsule-pill-bg-end: var(--bg-color);
  --token-capsule-pill-border: var(--border-color);
  --token-capsule-panel-bg-start: var(--card-bg);
  --token-capsule-panel-bg-end: var(--bg-color);
  --token-capsule-panel-border: var(--border-color);
}

.capsule-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 11px;
  border-radius: 100px;
  cursor: pointer;
  user-select: none;
  color: var(--text-secondary);
  background: linear-gradient(135deg, var(--token-capsule-pill-bg-start) 0%, var(--token-capsule-pill-bg-end) 100%);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--token-capsule-pill-border);
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.72;
}
.capsule-pill:active {
  opacity: 0.9;
  transform: scale(0.96);
}

.capsule-panel {
  min-width: 220px;
  max-width: 260px;
  padding: 12px 14px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--token-capsule-panel-bg-start) 0%, var(--token-capsule-panel-bg-end) 100%);
  backdrop-filter: blur(40px) saturate(200%);
  -webkit-backdrop-filter: blur(40px) saturate(200%);
  border: 1px solid var(--token-capsule-panel-border);
  box-shadow: 0 8px 28px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08);
}

/* Transition */
.capsule-expand-enter-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.capsule-expand-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.capsule-expand-enter-from,
.capsule-expand-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-4px);
}
</style>
