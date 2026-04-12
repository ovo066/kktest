<template>
  <div
    v-if="visible"
    class="absolute inset-0 z-50 flex flex-col memory-panel-bg"
  >
    <!-- 液态玻璃头部 -->
    <div class="memory-glass-header pt-app-lg pb-3 px-5 flex items-center justify-between">
      <button class="text-[var(--primary-color)] text-[17px] opacity-80 hover:opacity-100 transition-opacity" @click="$emit('settings')">
        <i class="ph ph-gear-six text-[22px]"></i>
      </button>
      <span class="text-[17px] font-medium text-[var(--text-primary)] tracking-wide">记忆</span>
      <button class="text-[var(--primary-color)] text-[17px] font-medium opacity-80 hover:opacity-100 transition-opacity" @click="$emit('close')">完成</button>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 overflow-y-auto no-scrollbar px-4">
      <!-- 注入中 -->
      <div class="pt-6">
        <div
          class="flex items-center justify-between mb-3 cursor-pointer px-1"
          @click="injectedExpanded = !injectedExpanded"
        >
          <div class="flex items-center gap-2">
            <div class="w-1 h-4 rounded-full bg-[var(--primary-color)] opacity-60"></div>
            <span class="text-[13px] font-medium text-[var(--text-secondary)] tracking-widest uppercase">注入中</span>
          </div>
          <i class="ph text-[var(--text-secondary)] text-[14px] opacity-50" :class="injectedExpanded ? 'ph-caret-up' : 'ph-caret-down'"></i>
        </div>

        <div v-if="injectedExpanded">
          <div class="text-[12px] text-[var(--text-secondary)] opacity-70 px-1 mb-2">
            会注入到提示词；点左侧圆点可关闭注入（移入“待整理”）。
          </div>
          <div v-if="injectedMemories.length === 0" class="memory-glass-card rounded-2xl px-4 py-10 text-center text-[var(--text-secondary)] text-[14px] opacity-60">
            暂无注入记忆
          </div>
          <template v-else>
            <MemoryEntry
              v-for="(mem, index) in injectedMemories"
              :key="mem.id"
              :memory="mem"
              :display-content="renderMemoryContent(mem.content)"
              type="core"
              :show-border="index < injectedMemories.length - 1"
              @toggle="toggleMemory(mem)"
              @edit="editMemory(mem)"
              @delete="deleteMemory(mem, 'core')"
            />
          </template>
        </div>
      </div>

      <!-- 待整理（不注入） -->
      <div class="pt-6">
        <div
          class="flex items-center justify-between mb-3 cursor-pointer px-1"
          @click="pendingExpanded = !pendingExpanded"
        >
          <div class="flex items-center gap-2">
            <div class="w-1 h-4 rounded-full bg-slate-400 opacity-50"></div>
            <span class="text-[13px] font-medium text-[var(--text-secondary)] tracking-widest uppercase">待整理</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="pendingMemories.length > 0"
              class="text-[11px] text-red-500/90 hover:text-red-500 transition-colors"
              @click.stop="clearPendingMemories"
            >
              清空
            </button>
            <i class="ph text-[var(--text-secondary)] text-[14px] opacity-50" :class="pendingExpanded ? 'ph-caret-up' : 'ph-caret-down'"></i>
          </div>
        </div>

        <div v-if="pendingExpanded">
          <div class="text-[12px] text-[var(--text-secondary)] opacity-70 px-1 mb-2">
            不会注入提示词；建议只开启真正长期有用的条目，或点击“清空”批量删除。
          </div>
          <div v-if="pendingMemories.length === 0" class="memory-glass-card rounded-2xl px-4 py-10 text-center text-[var(--text-secondary)] text-[14px] opacity-60">
            暂无待整理记忆（不会注入提示词）
          </div>
          <template v-else>
            <MemoryEntry
              v-for="(mem, index) in pendingMemories"
              :key="mem.id"
              :memory="mem"
              :display-content="renderMemoryContent(mem.content)"
              type="core"
              :show-border="index < pendingMemories.length - 1"
              @toggle="toggleMemory(mem)"
              @edit="editMemory(mem)"
              @delete="deleteMemory(mem, 'core')"
            />
          </template>
        </div>
      </div>

      <!-- 对话总结区块 -->
      <div class="pt-6">
        <div
          class="flex items-center justify-between mb-3 cursor-pointer px-1"
          @click="summaryExpanded = !summaryExpanded"
        >
          <div class="flex items-center gap-2">
            <div class="w-1 h-4 rounded-full bg-amber-400 opacity-60"></div>
            <span class="text-[13px] font-medium text-[var(--text-secondary)] tracking-widest uppercase">对话总结</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="text-[11px] px-2 py-1 rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] opacity-80 hover:opacity-100 transition-opacity"
              @click.stop="openRangeSummaryModal"
            >
              选范围
            </button>
            <i class="ph text-[var(--text-secondary)] text-[14px] opacity-50" :class="summaryExpanded ? 'ph-caret-up' : 'ph-caret-down'"></i>
          </div>
        </div>

        <div v-if="summaryExpanded">
          <div v-if="allSummaries.length === 0" class="memory-glass-card rounded-2xl px-4 py-10 text-center text-[var(--text-secondary)] text-[14px] opacity-60">
            暂无总结
          </div>
          <template v-else>
            <MemoryEntry
              v-for="(item, index) in summaryEntries"
              :key="item.memory.id"
              :memory="item.memory"
              :display-content="renderMemoryContent(item.memory.content)"
              :type="item.type"
              :show-border="index < summaryEntries.length - 1"
              :show-reroll="canRerollSummary(item.memory)"
              :rerolling="rerollingSummaryId === item.memory.id"
              @reroll="handleRerollSummary(item.memory, item.type)"
              @edit="editSummary(item.memory, item.type)"
              @delete="deleteMemory(item.memory, item.type)"
            />
          </template>
        </div>
      </div>

      <!-- 底部留白 -->
      <div class="h-36"></div>
    </div>

    <!-- 底部操作栏 -->
    <div class="absolute bottom-0 left-0 right-0 p-4 pb-app-lg memory-bottom-gradient">
      <div class="flex gap-2.5">
        <button
          class="flex-1 py-3 rounded-2xl memory-glass-btn text-[var(--text-primary)] text-[14px] font-medium active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
          @click="showAddModal = true"
        >
          <i class="ph ph-plus text-[16px] opacity-70"></i>
          添加
        </button>
        <button
          class="flex-1 py-3 rounded-2xl memory-glass-btn-primary text-white text-[14px] font-medium active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
          :disabled="summarizing"
          @click="handleAISummary"
        >
          <i class="ph text-[16px]" :class="summarizing ? 'ph-circle-notch animate-spin' : 'ph-sparkle'"></i>
          {{ summarizing ? '总结中' : 'AI 总结' }}
        </button>
        <button
          class="flex-1 py-3 rounded-2xl memory-glass-btn text-[var(--text-primary)] text-[14px] font-medium active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
          :disabled="managingMemory"
          @click="handleMemoryManager"
        >
          <i class="ph text-[16px] opacity-70" :class="managingMemory ? 'ph-circle-notch animate-spin' : 'ph-broom'"></i>
          {{ managingMemory ? '整理中' : '管家' }}
        </button>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <MemoryEditModal
      :visible="showAddModal || !!editingMemory"
      :memory="editingMemory"
      :show-priority="editingType === 'core' || !editingMemory"
      @cancel="closeEditModal"
      @confirm="handleSaveMemory"
    />

    <!-- 范围总结 -->
    <div
      v-if="showRangeSummaryModal"
      class="absolute inset-0 z-[60] bg-black/30 flex items-end"
      @click.self="closeRangeSummaryModal"
    >
      <div class="w-full rounded-t-[24px] memory-glass-card px-4 pt-4 pb-app-lg">
        <div class="flex items-center justify-between mb-3">
          <span class="text-[16px] font-semibold text-[var(--text-primary)]">按范围总结</span>
          <button class="text-[var(--primary-color)] text-[15px] font-medium" @click="closeRangeSummaryModal">取消</button>
        </div>
        <div v-if="rangeMessageOptions.length === 0" class="text-[13px] text-[var(--text-secondary)] py-8 text-center">
          暂无可总结的文本消息
        </div>
        <template v-else>
          <div class="text-[12px] text-[var(--text-secondary)] mb-3">
            选择起止消息后会在该范围内生成一条总结。
          </div>
          <div class="space-y-3">
            <label class="block">
              <div class="text-[12px] text-[var(--text-secondary)] mb-1">起始</div>
              <select v-model="rangeStartId" class="w-full rounded-xl px-3 py-2 text-[13px] bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-primary)]">
                <option v-for="item in rangeMessageOptions" :key="'start-' + item.id" :value="item.id">{{ item.label }}</option>
              </select>
            </label>
            <label class="block">
              <div class="text-[12px] text-[var(--text-secondary)] mb-1">结束</div>
              <select v-model="rangeEndId" class="w-full rounded-xl px-3 py-2 text-[13px] bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-primary)]">
                <option v-for="item in rangeMessageOptions" :key="'end-' + item.id" :value="item.id">{{ item.label }}</option>
              </select>
            </label>
          </div>
          <button
            class="w-full mt-4 py-3 rounded-2xl memory-glass-btn-primary text-white text-[14px] font-medium active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            :disabled="rangeSummarizing"
            @click="handleRangeSummary"
          >
            <i class="ph text-[16px]" :class="rangeSummarizing ? 'ph-circle-notch animate-spin' : 'ph-sparkle'"></i>
            {{ rangeSummarizing ? '总结中' : '生成范围总结' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useContactsStore } from '../../stores/contacts'
import { usePersonasStore } from '../../stores/personas'
import { useStorage } from '../../composables/useStorage'
import { runMemoryManager, useMemory } from '../../composables/useMemory'
import { useToast } from '../../composables/useToast'
import { applyTemplateVars, normalizeRoleAliasesToTemplateVars } from '../../composables/api/prompts'
import { showConfirm } from '../../composables/useConfirm'
import { formatBeijingLocale } from '../../utils/beijingTime'
import MemoryEntry from './MemoryEntry.vue'
import MemoryEditModal from './MemoryEditModal.vue'

defineProps({
  visible: { type: Boolean, default: false }
})

defineEmits(['close', 'settings'])

const contactsStore = useContactsStore()
const personasStore = usePersonasStore()
const { scheduleSave } = useStorage()
const {
  initContactMemory,
  addCoreMemory,
  updateCoreMemory,
  deleteCoreMemory,
  deleteSummary,
  updateSummary,
  generateShortSummary,
  rerollSummary
} = useMemory()
const { showToast } = useToast()

const injectedExpanded = ref(true)
const pendingExpanded = ref(true)
const summaryExpanded = ref(true)
const showAddModal = ref(false)
const editingMemory = ref(null)
const editingType = ref(null)
const summarizing = ref(false)
const managingMemory = ref(false)
const rerollingSummaryId = ref('')
const showRangeSummaryModal = ref(false)
const rangeStartId = ref('')
const rangeEndId = ref('')
const rangeSummarizing = ref(false)

const contact = computed(() => contactsStore.activeChat)

const templateVars = computed(() => {
  const c = contact.value
  const persona = c?.id ? personasStore.getPersonaForContact(c.id) : null
  return {
    char: String(c?.name || '角色').trim() || '角色',
    user: String(persona?.name || '用户').trim() || '用户'
  }
})

function renderMemoryContent(content) {
  const normalized = normalizeRoleAliasesToTemplateVars(String(content || ''))
  return applyTemplateVars(normalized, templateVars.value)
}

const coreMemories = computed(() => {
  return contact.value?.memory?.core || []
})

const injectedMemories = computed(() => {
  return (coreMemories.value || [])
    .filter(m => m && m.content && m.enabled === true)
    .slice()
    .sort((a, b) => (b.time || 0) - (a.time || 0))
})

const pendingMemories = computed(() => {
  return (coreMemories.value || [])
    .filter(m => m && m.content && m.enabled === false)
    .slice()
    .sort((a, b) => (b.time || 0) - (a.time || 0))
})

const longTermSummaries = computed(() => {
  return contact.value?.memory?.longTerm || []
})

const shortTermSummaries = computed(() => {
  return (contact.value?.memory?.shortTerm || []).filter(s => !s.merged)
})

const summaryEntries = computed(() => {
  return [
    ...longTermSummaries.value.map(memory => ({ memory, type: 'long' })),
    ...shortTermSummaries.value.map(memory => ({ memory, type: 'short' }))
  ].sort((a, b) => (b.memory?.time || 0) - (a.memory?.time || 0))
})

const allSummaries = computed(() => {
  return summaryEntries.value.map(item => item.memory)
})

function refreshSummaryLists() {
  if (!contact.value?.memory) return
  contact.value.memory.shortTerm = [...(contact.value.memory.shortTerm || [])]
  contact.value.memory.longTerm = [...(contact.value.memory.longTerm || [])]
}

function isSummarizableTextMessage(msg) {
  if (!msg) return false
  if (msg.hideInChat) return false
  if (msg.isImage || msg.isSticker) return false
  if (!msg.content) return false
  if (typeof msg.content === 'string' && msg.content.startsWith('⚠️ ')) return false
  return true
}

const rangeMessageOptions = computed(() => {
  const msgs = Array.isArray(contact.value?.msgs) ? contact.value.msgs : []
  const candidates = msgs.filter(isSummarizableTextMessage)
  const start = Math.max(0, candidates.length - 240)
  return candidates.slice(start).map((msg, idx) => {
    const who = msg.role === 'user' ? templateVars.value.user : templateVars.value.char
    const text = String(msg.content || '').replace(/\s+/g, ' ').trim()
    const preview = text.length > 32 ? text.slice(0, 32).trimEnd() + '…' : text
    const time = msg.time
      ? formatBeijingLocale(new Date(msg.time), { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : ''
    const indexText = start + idx + 1
    const label = `${indexText}. ${who}: ${preview}${time ? ` (${time})` : ''}`
    return {
      id: msg.id,
      label
    }
  })
})

function toggleMemory(mem) {
  if (!contact.value) return
  initContactMemory(contact.value)
  updateCoreMemory(contact.value, mem.id, { enabled: !mem.enabled })
  scheduleSave()
}

function editMemory(mem) {
  editingMemory.value = mem
  editingType.value = 'core'
}

function editSummary(sum, type) {
  editingMemory.value = sum
  editingType.value = type
}

function deleteMemory(mem, type) {
  if (!contact.value) return
  if (type === 'core') {
    deleteCoreMemory(contact.value, mem.id)
  } else {
    deleteSummary(contact.value, mem.id, type)
    refreshSummaryLists()
  }
  scheduleSave()
  showToast('已删除')
}

function canRerollSummary(summary) {
  if (!summary) return false
  const start = String(summary?.msgRange?.start || '').trim()
  const end = String(summary?.msgRange?.end || '').trim()
  return !!start && !!end
}

async function handleRerollSummary(summary, type = 'short') {
  if (!contact.value || !summary?.id) return
  if (!canRerollSummary(summary)) {
    showToast('该总结缺少范围，无法重Roll')
    return
  }
  if (rerollingSummaryId.value) return

  rerollingSummaryId.value = summary.id
  try {
    const result = await rerollSummary(contact.value, summary.id, type)
    if (result.summary) {
      refreshSummaryLists()
      scheduleSave()
    }

    if (result.success) {
      showToast(result.truncated ? '重Roll完成，但响应被截断，可再次重试' : '重Roll完成')
      return
    }
    const suffix = result.summary ? '（已保留失败条目，可继续重Roll）' : ''
    showToast((result.error || '重Roll失败') + suffix)
  } catch (e) {
    showToast('重Roll失败: ' + (e?.message || e))
  } finally {
    rerollingSummaryId.value = ''
  }
}

function openRangeSummaryModal() {
  const options = rangeMessageOptions.value
  if (!contact.value || options.length === 0) {
    showToast('暂无可总结的文本消息')
    return
  }
  const startIdx = Math.max(0, options.length - 20)
  rangeStartId.value = options[startIdx]?.id || options[0].id
  rangeEndId.value = options[options.length - 1]?.id || options[0].id
  showRangeSummaryModal.value = true
}

function closeRangeSummaryModal() {
  showRangeSummaryModal.value = false
  rangeSummarizing.value = false
}

async function handleRangeSummary() {
  if (!contact.value || rangeSummarizing.value) return
  const options = rangeMessageOptions.value
  if (options.length === 0) {
    showToast('暂无可总结的文本消息')
    return
  }

  const optionIndex = new Map(options.map((item, idx) => [String(item.id), idx]))
  let startId = String(rangeStartId.value || options[0].id)
  let endId = String(rangeEndId.value || options[options.length - 1].id)
  if (!optionIndex.has(startId)) startId = String(options[0].id)
  if (!optionIndex.has(endId)) endId = String(options[options.length - 1].id)
  if ((optionIndex.get(startId) ?? 0) > (optionIndex.get(endId) ?? 0)) {
    const tmp = startId
    startId = endId
    endId = tmp
  }

  rangeSummarizing.value = true
  try {
    const result = await generateShortSummary(contact.value, {
      startMsgId: startId,
      endMsgId: endId,
      minMessages: 2,
      maxMessages: 120,
      force: true,
      persistFailure: true
    })

    if (result.summary) {
      refreshSummaryLists()
      scheduleSave()
    }

    if (result.success) {
      showToast(result.truncated ? '范围总结完成，但响应被截断，可在条目中重Roll' : '范围总结完成')
      closeRangeSummaryModal()
      return
    }
    const suffix = result.summary ? '（已保留失败条目，可重Roll）' : ''
    showToast((result.error || '范围总结失败') + suffix)
  } catch (e) {
    showToast('范围总结失败: ' + (e?.message || e))
  } finally {
    rangeSummarizing.value = false
  }
}

async function clearPendingMemories() {
  if (!contact.value) return
  const count = pendingMemories.value.length
  if (count <= 0) return

  const ok = await showConfirm({
    title: '清空待整理',
    message: `确定清空 ${count} 条待整理记忆？（注入中的不会受影响）`,
    confirmText: '清空',
    destructive: true
  })
  if (!ok) return

  initContactMemory(contact.value)
  contact.value.memory.core = (contact.value.memory.core || []).filter(m => m && m.enabled !== false)
  scheduleSave()
  showToast('已清空')
}

function closeEditModal() {
  showAddModal.value = false
  editingMemory.value = null
  editingType.value = null
}

function handleSaveMemory(content, priority) {
  if (!contact.value || !content.trim()) return
  initContactMemory(contact.value)

  if (editingMemory.value) {
    if (editingType.value === 'core') {
      updateCoreMemory(contact.value, editingMemory.value.id, {
        content: content.trim(),
        priority
      })
    } else {
      updateSummary(contact.value, editingMemory.value.id, content.trim(), editingType.value)
      refreshSummaryLists()
    }
    showToast('已更新')
  } else {
    const mem = addCoreMemory(contact.value, content.trim(), 'manual')
    mem.priority = priority
    showToast('已添加')
  }

  scheduleSave()
  closeEditModal()
}

async function handleAISummary() {
  if (!contact.value || summarizing.value) return

  initContactMemory(contact.value)
  summarizing.value = true

  try {
    const result = await generateShortSummary(contact.value, { persistFailure: true })
    if (result.summary) {
      refreshSummaryLists()
      scheduleSave()
    }

    if (result.success) {
      showToast(result.truncated ? '总结完成，但响应被截断，可重Roll补全' : '总结完成')
    } else {
      const suffix = result.summary ? '（已保留失败条目，可重Roll）' : ''
      showToast((result.error || '总结失败') + suffix)
    }
  } catch (e) {
    showToast('总结失败: ' + e.message)
  } finally {
    summarizing.value = false
  }
}

async function handleMemoryManager() {
  if (!contact.value || managingMemory.value) return

  initContactMemory(contact.value)
  managingMemory.value = true

  try {
    const result = await runMemoryManager(contact.value, scheduleSave, { force: true })
    if (result.success) {
      contact.value.memory.core = [...contact.value.memory.core]
      const parts = []
      if (result.merged > 0) parts.push(`合并 ${result.merged} 条`)
      if (result.deleted > 0) parts.push(`删除 ${result.deleted} 条`)
      if (result.updated > 0) parts.push(`更新 ${result.updated} 条`)
      showToast(parts.length ? `记忆整理完成：${parts.join('，')}` : '记忆已是最优状态')
    } else {
      showToast(result.error || '整理失败')
    }
  } catch (e) {
    showToast('整理失败: ' + e.message)
  } finally {
    managingMemory.value = false
  }
}
</script>

<style scoped>
.memory-panel-bg {
  background: var(--bg-color);
}
.memory-glass-header {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.3);
}
.dark .memory-glass-header {
  background: rgba(30, 30, 30, 0.7);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}
.memory-glass-card {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 0.5px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
}
.dark .memory-glass-card {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}
.memory-bottom-gradient {
  background: linear-gradient(to top, var(--bg-color) 60%, transparent);
}
.memory-glass-btn {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 0.5px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}
.dark .memory-glass-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}
.memory-glass-btn-primary {
  background: var(--primary-color);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}
</style>

