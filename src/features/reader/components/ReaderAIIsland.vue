<template>
  <div class="reader-ai-island">
    <!-- Collapsed: Floating Avatar Bubble -->
    <Transition name="island-avatar">
      <div
        v-if="!expanded"
        class="reader-ai-draggable fixed z-[950] flex flex-col items-center cursor-pointer select-none"
        :style="collapsedPosition"
        @pointerdown="onCollapsedPointerDown"
        @click="handleCollapsedClick"
      >
        <!-- Speech bubble hint -->
        <Transition name="hint-bubble">
          <div
            v-if="showHint"
            class="px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#2c2c2e]/90 backdrop-blur-xl shadow-lg text-[11px] sm:text-[12px] font-medium text-[var(--text-primary)] whitespace-nowrap border border-white/40 dark:border-white/10 mb-1"
          >
            想聊聊吗？
          </div>
        </Transition>

        <!-- Avatar circle -->
        <div class="island-avatar-ring w-[44px] h-[44px] sm:w-[48px] sm:h-[48px] rounded-full bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-white/50 dark:border-white/10 flex items-center justify-center overflow-hidden">
          <div class="island-breathe w-[38px] h-[38px] sm:w-[42px] sm:h-[42px] rounded-full overflow-hidden flex items-center justify-center" :class="avatarType === 'image' ? '' : 'text-[20px] sm:text-[22px]'">
            <img v-if="avatarType === 'image'" :src="avatar" class="w-full h-full object-cover">
            <span v-else>{{ avatar || '🤖' }}</span>
          </div>
        </div>

      </div>
    </Transition>

    <!-- Expanded: Bottom Sheet Dialog -->
    <Teleport to="body">
      <Transition name="island-expand">
        <div
          v-if="expanded"
          class="fixed inset-x-0 bottom-0 z-[960] flex flex-col sm:items-center"
          :style="expandedPanelStyle"
        >
          <!-- Backdrop -->
          <div class="fixed inset-0 z-[-1] bg-black/18 backdrop-blur-[1px]" @click="$emit('toggle')"></div>

          <!-- Panel -->
          <div class="flex-1 w-full sm:max-w-[680px] flex flex-col bg-white/85 dark:bg-[#1c1c1e]/88 backdrop-blur-2xl rounded-t-[24px] sm:rounded-t-[24px] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] border-t border-white/30 dark:border-white/8 overflow-hidden">
            <!-- Header -->
            <div class="flex items-center gap-3 px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-2 shrink-0">
              <div class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-[var(--primary-color)]/10 shrink-0" :class="avatarType === 'image' ? '' : 'text-[18px]'">
                <img v-if="avatarType === 'image'" :src="avatar" class="w-full h-full object-cover">
                <span v-else>{{ avatar || '🤖' }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[14px] sm:text-[15px] font-semibold text-[var(--text-primary)] truncate">{{ name }}</div>
                <div class="text-[11px] text-[var(--primary-color)] font-medium">一起读中</div>
              </div>
              <button
                class="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
                @click="$emit('toggle')"
              >
                <i class="ph-bold ph-caret-down text-[14px] text-[var(--text-secondary)]"></i>
              </button>
            </div>

            <!-- Selected Text Quote -->
            <div v-if="selectedText" class="mx-3.5 sm:mx-4 mb-2 shrink-0">
              <div class="flex items-start gap-2 p-3 rounded-2xl bg-[var(--primary-color)]/8 dark:bg-[var(--primary-color)]/12">
                <i class="ph-fill ph-quotes text-[16px] text-[var(--primary-color)] mt-0.5 shrink-0"></i>
                <div class="flex-1 min-w-0">
                  <div class="text-[13px] text-[var(--text-primary)] leading-relaxed line-clamp-3">{{ selectedText }}</div>
                </div>
                <button
                  class="w-5 h-5 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0 active:scale-90"
                  @click="$emit('dismiss-selection')"
                >
                  <i class="ph-bold ph-x text-[10px] text-[var(--text-secondary)]"></i>
                </button>
              </div>
            </div>

            <!-- Messages -->
            <div ref="messagesRef" class="flex-1 overflow-y-auto px-3.5 sm:px-4 py-2 space-y-3 no-scrollbar">
              <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full opacity-40">
                <i class="ph ph-chat-dots text-[32px]"></i>
                <p class="text-[13px] mt-2">聊聊你正在读的内容</p>
              </div>

              <div
                v-for="msg in messages"
                :key="msg.id"
                class="flex flex-col"
                :class="msg.role === 'user' ? 'items-end' : 'items-start'"
              >
                <div class="flex gap-2" :class="msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'">
                  <!-- Normal bubble (highlight when editing) -->
                  <div
                    class="max-w-[84%] sm:max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13px] sm:text-[14px] leading-relaxed cursor-pointer"
                    :class="[
                      msg.role === 'user'
                        ? 'bg-[var(--primary-color)] text-white rounded-br-md'
                        : 'bg-white/70 dark:bg-white/10 text-[var(--text-primary)] rounded-bl-md shadow-sm',
                      editingMsgId === msg.id ? 'ring-2 ring-[var(--primary-color)]' : ''
                    ]"
                    @click="toggleMsgActions(msg.id)"
                  >
                    <span class="reader-rich-text" v-html="renderMessageContent(msg.content)"></span>
                    <span v-if="msg.role === 'assistant' && isStreaming && msg === messages[messages.length - 1]" class="inline-block w-1 h-4 bg-[var(--text-secondary)] ml-0.5 animate-pulse align-middle"></span>
                  </div>
                </div>
                <!-- Action buttons -->
                <Transition name="msg-actions">
                  <div
                    v-if="expandedMsgId === msg.id && editingMsgId !== msg.id && !isStreaming"
                    class="flex gap-1 mt-1 px-1"
                  >
                    <button
                      v-if="msg.role === 'assistant'"
                      class="px-2 py-0.5 rounded-full text-[10px] bg-black/5 dark:bg-white/8 text-[var(--text-secondary)] active:scale-90 transition-transform"
                      @click="handleRegenerate(msg.id)"
                    >重新生成</button>
                    <button
                      class="px-2 py-0.5 rounded-full text-[10px] bg-black/5 dark:bg-white/8 text-[var(--text-secondary)] active:scale-90 transition-transform"
                      @click="startEdit(msg)"
                    >编辑</button>
                    <button
                      class="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-500 active:scale-90 transition-transform"
                      @click="handleDelete(msg.id)"
                    >删除</button>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Input / Edit Bar -->
            <div v-if="editingMsgId" class="shrink-0 border-t border-black/5 dark:border-white/5">
              <div class="px-3.5 sm:px-4 pt-2 pb-1 flex items-center justify-between">
                <span class="text-[11px] text-[var(--primary-color)] font-medium">编辑消息</span>
                <button class="text-[11px] text-[var(--text-secondary)] active:opacity-60" @click="cancelEdit">取消</button>
              </div>
              <div class="px-3.5 sm:px-4 pb-[max(12px,env(safe-area-inset-bottom,0px))] flex items-end gap-2">
                <textarea
                  ref="editAreaRef"
                  v-model="editText"
                  class="flex-1 min-h-[40px] max-h-[120px] px-4 py-2.5 rounded-2xl bg-black/5 dark:bg-white/8 text-[13px] sm:text-[14px] text-[var(--text-primary)] outline-none resize-none leading-relaxed"
                  @keydown.enter.ctrl.prevent="confirmEditById"
                ></textarea>
                <button
                  class="w-10 h-10 rounded-full bg-[var(--primary-color)] flex items-center justify-center active:scale-90 transition-transform shrink-0"
                  :class="{ 'opacity-40': !editText.trim() }"
                  :disabled="!editText.trim()"
                  @click="confirmEditById"
                >
                  <i class="ph-bold ph-check text-[14px] text-white"></i>
                </button>
              </div>
            </div>
            <div v-else class="shrink-0 px-3.5 sm:px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom,0px))] flex items-center gap-2 border-t border-black/5 dark:border-white/5">
              <input
                ref="inputRef"
                v-model="inputText"
                type="text"
                class="flex-1 h-10 px-4 rounded-full bg-black/5 dark:bg-white/8 text-[13px] sm:text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 outline-none"
                placeholder="聊聊你的想法..."
                @keydown.enter.prevent="handleSend"
              >
              <button
                v-if="isStreaming"
                class="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center active:scale-90 transition-transform shrink-0"
                @click="$emit('stop')"
              >
                <i class="ph-fill ph-stop text-[16px] text-red-500"></i>
              </button>
              <button
                v-else
                class="w-10 h-10 rounded-full bg-[var(--primary-color)] flex items-center justify-center active:scale-90 transition-transform shrink-0"
                :class="{ 'opacity-40': !inputText.trim() }"
                :disabled="!inputText.trim()"
                @click="handleSend"
              >
                <i class="ph-bold ph-arrow-up text-[14px] text-white"></i>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { renderReaderRichText } from '../composables/readerRichText'

const props = defineProps({
  avatar: { type: String, default: '' },
  avatarType: { type: String, default: 'emoji' },
  name: { type: String, default: '伴读' },
  expanded: { type: Boolean, default: false },
  messages: { type: Array, default: () => [] },
  selectedText: { type: String, default: '' },
  isStreaming: { type: Boolean, default: false },
  showHint: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle', 'send', 'stop', 'dismiss-selection', 'regenerate', 'edit', 'delete'])

const inputText = ref('')
const inputRef = ref(null)
const messagesRef = ref(null)
const expandedMsgId = ref(null)
const editingMsgId = ref(null)
const editText = ref('')
const editAreaRef = ref(null)

function toggleMsgActions(msgId) {
  expandedMsgId.value = expandedMsgId.value === msgId ? null : msgId
}

function startEdit(msg) {
  editingMsgId.value = msg.id
  editText.value = msg.content
  expandedMsgId.value = null
  nextTick(() => editAreaRef.value?.focus())
}

function confirmEdit(msg) {
  const trimmed = editText.value.trim()
  if (trimmed && trimmed !== msg.content) {
    emit('edit', { msgId: msg.id, content: trimmed })
  }
  editingMsgId.value = null
  editText.value = ''
}

function confirmEditById() {
  const msg = props.messages.find(m => m.id === editingMsgId.value)
  if (msg) confirmEdit(msg)
  else cancelEdit()
}

function cancelEdit() {
  editingMsgId.value = null
  editText.value = ''
}

function handleDelete(msgId) {
  expandedMsgId.value = null
  emit('delete', msgId)
}

function handleRegenerate(msgId) {
  expandedMsgId.value = null
  emit('regenerate', msgId)
}

const COLLAPSED_SIZE = 48
const EDGE_GAP = 10
const POSITION_STORAGE_KEY = 'reader_ai_island_position_v1'
const collapsedPos = ref({ x: null, y: null })
const dragPointerId = ref(null)
const dragStart = ref({ x: 0, y: 0, left: 0, top: 0 })
const dragged = ref(false)

const collapsedPosition = computed(() => ({
  left: `${getSafePosition(collapsedPos.value.x, 'x')}px`,
  top: `${getSafePosition(collapsedPos.value.y, 'y')}px`
}))

const expandedPanelStyle = computed(() => ({
  height: 'min(68vh, 560px)',
  maxHeight: 'calc(100vh - env(safe-area-inset-top, 0px) - 8px)',
  minHeight: '280px'
}))

function handleSend() {
  const text = inputText.value.trim()
  if (!text || props.isStreaming) return
  emit('send', text)
  inputText.value = ''
}

function renderMessageContent(text) {
  return renderReaderRichText(text)
}

function getViewportLimit() {
  if (typeof window === 'undefined') {
    return { maxX: 360, maxY: 760 }
  }
  return {
    maxX: Math.max(EDGE_GAP, window.innerWidth - COLLAPSED_SIZE - EDGE_GAP),
    maxY: Math.max(EDGE_GAP, window.innerHeight - COLLAPSED_SIZE - EDGE_GAP)
  }
}

function getSafePosition(value, axis) {
  const { maxX, maxY } = getViewportLimit()
  const max = axis === 'x' ? maxX : maxY
  const fallback = axis === 'x' ? maxX : Math.max(EDGE_GAP, maxY - 88)
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(EDGE_GAP, Math.min(max, n))
}

function setCollapsedPosition(x, y) {
  collapsedPos.value = {
    x: getSafePosition(x, 'x'),
    y: getSafePosition(y, 'y')
  }
}

function persistCollapsedPosition() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(collapsedPos.value))
  } catch {}
}

function restoreCollapsedPosition() {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      setCollapsedPosition(parsed.x, parsed.y)
    }
  } catch {}
}

function onWindowResize() {
  setCollapsedPosition(collapsedPos.value.x, collapsedPos.value.y)
  persistCollapsedPosition()
}

function onCollapsedPointerDown(event) {
  if (props.expanded) return
  dragPointerId.value = event.pointerId
  dragged.value = false
  dragStart.value = {
    x: event.clientX,
    y: event.clientY,
    left: getSafePosition(collapsedPos.value.x, 'x'),
    top: getSafePosition(collapsedPos.value.y, 'y')
  }
  window.addEventListener('pointermove', onCollapsedPointerMove)
  window.addEventListener('pointerup', onCollapsedPointerUp)
  window.addEventListener('pointercancel', onCollapsedPointerUp)
}

function onCollapsedPointerMove(event) {
  if (event.pointerId !== dragPointerId.value) return
  const dx = event.clientX - dragStart.value.x
  const dy = event.clientY - dragStart.value.y
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged.value = true
  setCollapsedPosition(dragStart.value.left + dx, dragStart.value.top + dy)
}

function onCollapsedPointerUp(event) {
  if (event.pointerId !== dragPointerId.value) return
  dragPointerId.value = null
  window.removeEventListener('pointermove', onCollapsedPointerMove)
  window.removeEventListener('pointerup', onCollapsedPointerUp)
  window.removeEventListener('pointercancel', onCollapsedPointerUp)
  persistCollapsedPosition()
}

function handleCollapsedClick() {
  if (dragged.value) {
    dragged.value = false
    return
  }
  emit('toggle')
}

function scrollToBottom() {
  if (!messagesRef.value) return
  messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}

// Auto scroll to bottom on new messages
watch(() => props.messages.length, () => {
  nextTick(scrollToBottom)
})

// Focus input when expanded
watch(() => props.expanded, (val) => {
  if (val) {
    nextTick(() => {
      inputRef.value?.focus()
      scrollToBottom()
    })
  }
})

onMounted(() => {
  restoreCollapsedPosition()
  setCollapsedPosition(collapsedPos.value.x, collapsedPos.value.y)
  persistCollapsedPosition()
  if (props.expanded) {
    nextTick(scrollToBottom)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onWindowResize)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onWindowResize)
  }
  window.removeEventListener('pointermove', onCollapsedPointerMove)
  window.removeEventListener('pointerup', onCollapsedPointerUp)
  window.removeEventListener('pointercancel', onCollapsedPointerUp)
})
</script>

<style scoped>
/* Breathe animation */
.island-breathe {
  animation: breathe 3s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.92; }
  50% { transform: scale(1.06); opacity: 1; }
}

/* Avatar ring glow */
.island-avatar-ring {
  box-shadow: 0 4px 20px rgba(0,0,0,0.1), 0 0 0 2px rgba(var(--primary-color-rgb, 0, 122, 255), 0.15);
}

/* Collapsed avatar transition */
.island-avatar-enter-active,
.island-avatar-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.island-avatar-enter-from {
  opacity: 0;
  transform: scale(0.5) translateY(20px);
}
.island-avatar-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* Expanded panel transition */
.island-expand-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.island-expand-leave-active {
  transition: all 0.25s ease-in;
}
.island-expand-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.island-expand-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* Hint bubble */
.hint-bubble-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hint-bubble-leave-active {
  transition: all 0.2s ease;
}
.hint-bubble-enter-from {
  opacity: 0;
  transform: scale(0.7) translateY(8px);
}
.hint-bubble-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.reader-ai-draggable {
  touch-action: none;
}

.msg-actions-enter-active,
.msg-actions-leave-active {
  transition: all 0.15s ease;
}
.msg-actions-enter-from,
.msg-actions-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.reader-rich-text :deep(strong) {
  font-weight: 700;
}

.reader-rich-text :deep(em) {
  font-style: italic;
}

.reader-rich-text :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.92em;
  padding: 0.08em 0.35em;
  border-radius: 0.35em;
  background: rgba(127, 127, 127, 0.18);
}
</style>
