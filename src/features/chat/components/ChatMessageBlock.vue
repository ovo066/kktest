<template>
  <div v-if="block.type === 'timestamp'" class="chat-timestamp-row w-full">
    <div class="chat-timestamp">{{ block.text }}</div>
  </div>

  <div
    v-else-if="block.type === 'narration'"
    class="chat-narration-row w-full mb-1 relative"
    :data-msg-id="block.msgId"
    :data-msg-part="block.msgPartKey || 'message'"
    @click="multiSelectMode ? emit('toggle-select', block.key) : null"
  >
    <div v-if="multiSelectMode" class="absolute left-2 top-1/2 -translate-y-1/2 z-[1]">
      <ChatMultiSelectCheckbox :visible="true" :selected="isSelected" />
    </div>
    <div
      class="narration"
      :class="block.animClass"
      @contextmenu.prevent="multiSelectMode ? emit('toggle-select', block.key) : emit('narration-menu', $event, block)"
    >
      {{ block.text }}
    </div>
  </div>

  <ChatMediaBlock
    v-else-if="isMediaType(block.type)"
    :block="block"
    :multi-select-mode="multiSelectMode"
    :selected="selected"
    :show-chat-avatars="showChatAvatars"
    @toggle-select="emit('toggle-select', $event)"
    @context-menu="forwardContextMenu"
  />

  <ChatActionBlock
    v-else-if="isActionType(block.type)"
    :block="block"
    :multi-select-mode="multiSelectMode"
    :selected="selected"
    :show-chat-avatars="showChatAvatars"
    @toggle-select="emit('toggle-select', $event)"
    @context-menu="forwardContextMenu"
    @open-call-history="emit('open-call-history', $event)"
    @accept-transfer="emit('accept-transfer', $event)"
    @reject-transfer="emit('reject-transfer', $event)"
    @accept-gift="emit('accept-gift', $event)"
    @reject-gift="emit('reject-gift', $event)"
    @accept-meet="emit('accept-meet', $event)"
    @reject-meet="emit('reject-meet', $event)"
    @open-transfer-detail="emit('open-transfer-detail', $event)"
  />

  <div
    v-else-if="block.type === 'toolLog'"
    class="flex justify-center my-2"
  >
    <div class="tool-log-card w-full max-w-[88%]" :class="block.success ? 'tool-log-card-success' : 'tool-log-card-error'">
      <div class="tool-log-header">
        <div class="flex items-center gap-2 min-w-0">
          <span class="tool-log-badge" :class="block.source === 'mcp' ? 'tool-log-badge-mcp' : 'tool-log-badge-internal'">
            {{ block.sourceLabel }}
          </span>
          <span class="tool-log-title">{{ block.title }}</span>
        </div>
        <span class="tool-log-status" :class="block.success ? 'tool-log-status-success' : 'tool-log-status-error'">
          {{ block.success ? '已执行' : '失败' }}
        </span>
      </div>
      <div v-if="block.subtitle" class="tool-log-subtitle">{{ block.subtitle }}</div>
      <div v-if="block.summary" class="tool-log-summary">{{ block.summary }}</div>
      <div v-if="block.argsPreview" class="tool-log-section">
        <div class="tool-log-section-label">参数</div>
        <pre class="tool-log-pre">{{ block.argsPreview }}</pre>
      </div>
      <div v-if="block.resultPreview" class="tool-log-section">
        <div class="tool-log-section-label">结果</div>
        <pre class="tool-log-pre">{{ block.resultPreview }}</pre>
      </div>
      <div v-else-if="block.errorText" class="tool-log-error">{{ block.errorText }}</div>
      <div class="tool-log-meta">
        <span>第 {{ block.round }} 轮</span>
        <span v-if="block.durationLabel">{{ block.durationLabel }}</span>
      </div>
    </div>
  </div>

  <div
    v-else-if="block.type === 'offlineCard'"
    class="flex justify-center my-3"
    @contextmenu.prevent="emit('context-menu', $event, block)"
    @touchstart.passive="onOfflineCardTouchStart($event, block)"
    @touchend="clearOfflineCardLongPress"
    @touchcancel="clearOfflineCardLongPress"
    @touchmove="clearOfflineCardLongPress"
  >
    <div class="bg-[var(--card-bg)] rounded-[12px] border border-[var(--border-color)] px-4 py-3 max-w-[80%] shadow-sm w-full">
      <div class="flex items-center justify-between gap-2 mb-1.5">
        <div class="flex items-center gap-2 min-w-0">
          <i class="ph ph-book-open text-[var(--primary-color)] text-lg"></i>
          <span class="text-[13px] font-medium text-[var(--text-primary)]">线下剧情</span>
        </div>
        <button
          class="offline-card-delete-btn"
          title="删除线下卡片"
          @touchstart.stop
          @click.stop="emit('delete-offline-card', block)"
        >
          <i class="ph ph-trash"></i>
        </button>
      </div>
      <div class="text-[12px] text-[var(--text-secondary)] mb-1">{{ block.summary }}</div>
      <div class="text-[10px] text-[var(--text-secondary)] opacity-60">
        {{ formatOfflineTime(block.startTime) }} - {{ formatOfflineTime(block.endTime) }}
      </div>
    </div>
  </div>

  <ChatBubbleBlock
    v-else-if="block.type === 'bubble'"
    :block="block"
    :multi-select-mode="multiSelectMode"
    :selected="selected"
    :show-chat-avatars="showChatAvatars"
    @toggle-select="emit('toggle-select', $event)"
    @context-menu="forwardContextMenu"
  />
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import ChatActionBlock from './message-blocks/ChatActionBlock.vue'
import ChatBubbleBlock from './message-blocks/ChatBubbleBlock.vue'
import ChatMediaBlock from './message-blocks/ChatMediaBlock.vue'
import ChatMultiSelectCheckbox from './message-blocks/ChatMultiSelectCheckbox.vue'
import { formatBeijingLocale } from '../../../utils/beijingTime'

const MEDIA_BLOCK_TYPES = Object.freeze(['image', 'mockImage', 'imageRendering', 'stickerMessage', 'sticker'])
const ACTION_BLOCK_TYPES = Object.freeze(['transfer', 'gift', 'meet', 'voice', 'call', 'callRecord', 'music'])

const props = defineProps({
  block: { type: Object, required: true },
  multiSelectMode: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  showChatAvatars: { type: Boolean, default: false }
})

const emit = defineEmits([
  'toggle-select',
  'context-menu',
  'narration-menu',
  'open-call-history',
  'delete-offline-card',
  'accept-transfer',
  'reject-transfer',
  'accept-gift',
  'reject-gift',
  'accept-meet',
  'reject-meet',
  'open-transfer-detail'
])

const isSelected = computed(() => props.multiSelectMode && props.selected)
const offlineCardLongPressTimer = ref(null)

function isMediaType(type) {
  return MEDIA_BLOCK_TYPES.includes(type)
}

function isActionType(type) {
  return ACTION_BLOCK_TYPES.includes(type)
}

function forwardContextMenu(event, block) {
  emit('context-menu', event, block)
}

function clearOfflineCardLongPress() {
  if (!offlineCardLongPressTimer.value) return
  clearTimeout(offlineCardLongPressTimer.value)
  offlineCardLongPressTimer.value = null
}

function onOfflineCardTouchStart(event, block) {
  if (props.multiSelectMode) return

  clearOfflineCardLongPress()

  const touch = event?.touches?.[0]
  if (!touch) return

  offlineCardLongPressTimer.value = setTimeout(() => {
    emit('context-menu', {
      currentTarget: event.currentTarget,
      clientX: touch.clientX,
      clientY: touch.clientY
    }, block)
    clearOfflineCardLongPress()
  }, 430)
}

function formatOfflineTime(ts) {
  if (!ts) return ''
  return formatBeijingLocale(new Date(ts), {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onBeforeUnmount(() => {
  clearOfflineCardLongPress()
})
</script>

<style scoped>
.offline-card-delete-btn {
  border: 1px solid var(--border-color, #d8d8d8);
  border-radius: 8px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #8e8e93);
  background: transparent;
}

.offline-card-delete-btn:active {
  opacity: 0.7;
}

.tool-log-card {
  border: 1px solid var(--border-color, #d8d8d8);
  border-radius: 14px;
  padding: 12px 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--card-bg, #fff) 92%, #f4f7fb 8%) 0%, var(--card-bg, #fff) 100%);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
}

.tool-log-card-success {
  border-color: color-mix(in srgb, var(--border-color, #d8d8d8) 70%, #10b981 30%);
}

.tool-log-card-error {
  border-color: color-mix(in srgb, var(--border-color, #d8d8d8) 68%, #ef4444 32%);
}

.tool-log-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tool-log-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.tool-log-badge-mcp {
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
}

.tool-log-badge-internal {
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
}

.tool-log-title {
  color: var(--text-primary, #111827);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  word-break: break-word;
}

.tool-log-status {
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.tool-log-status-success {
  color: #059669;
}

.tool-log-status-error {
  color: #dc2626;
}

.tool-log-subtitle {
  margin-top: 6px;
  color: var(--text-secondary, #8e8e93);
  font-size: 11px;
  line-height: 1.4;
  word-break: break-word;
}

.tool-log-summary {
  margin-top: 8px;
  color: var(--text-primary, #111827);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.tool-log-section {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--border-color, #d8d8d8) 78%, transparent 22%);
}

.tool-log-section-label {
  color: var(--text-secondary, #8e8e93);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.tool-log-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-primary, #111827);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.tool-log-error {
  margin-top: 10px;
  color: #dc2626;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.tool-log-meta {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary, #8e8e93);
  font-size: 10px;
}
</style>
