<template>
  <Teleport to="body">
    <Transition name="reader-chat-window">
      <div
        v-if="visible"
        class="fixed z-[965] right-[max(8px,env(safe-area-inset-right,0px))] bottom-[calc(env(safe-area-inset-bottom,0px)+86px)] w-[min(94vw,396px)] h-[min(64vh,500px)] rounded-[30px] bg-white/90 dark:bg-[#1f1f21]/90 backdrop-blur-2xl border border-white/45 dark:border-white/12 shadow-[0_20px_46px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col"
      >
        <div class="shrink-0 flex items-center justify-between px-3.5 py-2.5 border-b border-black/6 dark:border-white/8">
          <div class="text-[13px] font-semibold text-[var(--text-primary)]">共读胶囊</div>
          <button
            class="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
            @click="$emit('close')"
          >
            <i class="ph-bold ph-x text-[11px] text-[var(--text-secondary)]"></i>
          </button>
        </div>

        <div class="shrink-0 px-2.5 pt-2 space-y-1.5">
          <div
            v-if="selectedText"
            class="p-2.5 rounded-[18px] bg-[var(--primary-color)]/12 dark:bg-[var(--primary-color)]/16 text-[12px] text-[var(--text-primary)]"
          >
            <div class="text-[10px] font-semibold text-[var(--primary-color)]/85 mb-1">选中文字</div>
            <div class="line-clamp-3 leading-relaxed">{{ selectedText }}</div>
          </div>
          <div
            v-if="pageText"
            class="p-2.5 rounded-[18px] bg-black/[0.04] dark:bg-white/[0.07] text-[12px] text-[var(--text-primary)]/88"
          >
            <div class="text-[10px] font-semibold text-[var(--text-secondary)] mb-1">当前页内容</div>
            <div class="line-clamp-3 leading-relaxed">{{ pageText }}</div>
          </div>
        </div>

        <div ref="messagesRef" class="flex-1 overflow-y-auto no-scrollbar px-2.5 py-2 space-y-2">
          <div v-if="messages.length === 0" class="h-full flex items-center justify-center opacity-45">
            <div class="text-[12px] text-[var(--text-secondary)]">问问{{ roleName || '伴读' }}对这段内容的看法</div>
          </div>

          <div
            v-for="msg in messages"
            :key="msg.id"
            class="flex flex-col"
            :class="msg.role === 'user' ? 'items-end' : 'items-start'"
          >
            <div class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
              <!-- Normal bubble (highlight when editing) -->
              <div
                class="max-w-[86%] px-3 py-2 rounded-2xl text-[12px] sm:text-[13px] leading-relaxed cursor-pointer"
                :class="[
                  msg.role === 'user'
                    ? 'bg-[var(--primary-color)] text-white rounded-br-md'
                    : 'bg-black/5 dark:bg-white/10 text-[var(--text-primary)] rounded-bl-md',
                  editingMsgId === msg.id ? 'ring-2 ring-[var(--primary-color)]' : ''
                ]"
                @click="toggleMsgActions(msg.id)"
              >
                <span class="reader-rich-text" v-html="renderMessageContent(msg.content)"></span>
                <span
                  v-if="msg.role === 'assistant' && isStreaming && msg === messages[messages.length - 1]"
                  class="inline-block w-1 h-3 bg-[var(--text-secondary)] ml-0.5 animate-pulse align-middle"
                ></span>
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

        <div v-if="editingMsgId" class="shrink-0 border-t border-black/6 dark:border-white/8">
          <div class="px-2.5 pt-2 pb-1 flex items-center justify-between">
            <span class="text-[11px] text-[var(--primary-color)] font-medium">编辑消息</span>
            <button class="text-[11px] text-[var(--text-secondary)] active:opacity-60" @click="cancelEdit">取消</button>
          </div>
          <div class="px-2.5 pb-2.5 flex items-end gap-2">
            <textarea
              ref="editAreaRef"
              v-model="editText"
              class="flex-1 min-h-[36px] max-h-[100px] px-3 py-2 rounded-2xl bg-black/5 dark:bg-white/10 text-[12px] sm:text-[13px] text-[var(--text-primary)] outline-none resize-none leading-relaxed"
              @keydown.enter.ctrl.prevent="confirmEditById"
            ></textarea>
            <button
              class="w-9 h-9 rounded-full bg-[var(--primary-color)] text-white flex items-center justify-center active:scale-90 transition-transform shrink-0"
              :class="{ 'opacity-40': !editText.trim() }"
              :disabled="!editText.trim()"
              @click="confirmEditById"
            >
              <i class="ph-bold ph-check text-[12px]"></i>
            </button>
          </div>
        </div>
        <div v-else class="shrink-0 p-2.5 border-t border-black/6 dark:border-white/8 flex items-center gap-2">
          <input
            ref="inputRef"
            v-model="inputText"
            type="text"
            class="flex-1 h-9 px-3 rounded-full bg-black/5 dark:bg-white/10 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 outline-none"
            placeholder="输入想讨论的问题..."
            @keydown.enter.prevent="handleSend"
          >
          <button
            v-if="isStreaming"
            class="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center active:scale-90 transition-transform"
            @click="$emit('stop')"
          >
            <i class="ph-fill ph-stop text-[14px] text-red-500"></i>
          </button>
          <button
            v-else
            class="w-9 h-9 rounded-full bg-[var(--primary-color)] text-white flex items-center justify-center active:scale-90 transition-transform"
            :class="{ 'opacity-40': !inputText.trim() }"
            :disabled="!inputText.trim()"
            @click="handleSend"
          >
            <i class="ph-bold ph-arrow-up text-[12px]"></i>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { renderReaderRichText } from '../composables/readerRichText'

const props = defineProps({
  visible: { type: Boolean, default: false },
  selectedText: { type: String, default: '' },
  pageText: { type: String, default: '' },
  messages: { type: Array, default: () => [] },
  isStreaming: { type: Boolean, default: false },
  roleName: { type: String, default: '' }
})

const emit = defineEmits(['close', 'send', 'stop', 'regenerate', 'edit', 'delete'])

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

function confirmEditById() {
  const msg = props.messages.find(m => m.id === editingMsgId.value)
  if (msg) confirmEdit(msg)
  else cancelEdit()
}

function confirmEdit(msg) {
  const trimmed = editText.value.trim()
  if (trimmed && trimmed !== msg.content) {
    emit('edit', { msgId: msg.id, content: trimmed })
  }
  editingMsgId.value = null
  editText.value = ''
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

function handleSend() {
  const text = inputText.value.trim()
  if (!text || props.isStreaming) return
  emit('send', {
    text,
    selectedText: props.selectedText,
    pageText: props.pageText
  })
  inputText.value = ''
}

function renderMessageContent(text) {
  return renderReaderRichText(text)
}

function scrollToBottom() {
  if (!messagesRef.value) return
  messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}

watch(() => props.visible, (val) => {
  if (!val) return
  nextTick(() => {
    inputRef.value?.focus()
    scrollToBottom()
  })
})

watch(() => props.messages.length, () => {
  nextTick(scrollToBottom)
})

onMounted(() => {
  if (props.visible) {
    nextTick(scrollToBottom)
  }
})
</script>

<style scoped>
.reader-chat-window-enter-active,
.reader-chat-window-leave-active {
  transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.reader-chat-window-enter-from,
.reader-chat-window-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
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

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
