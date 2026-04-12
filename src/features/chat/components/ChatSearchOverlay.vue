<template>
  <Transition name="search-panel">
    <div
      v-if="visible"
      class="search-overlay absolute inset-x-0 z-40 flex flex-col"
      :style="overlayStyle"
    >
      <div class="search-glass-bg absolute inset-0"></div>

      <div class="relative px-3 pt-3 pb-2">
        <div class="search-pill flex items-center gap-2.5 rounded-full px-4 py-[9px]">
          <i class="ph ph-magnifying-glass text-[16px] text-[var(--text-secondary)]"></i>
          <input
            ref="inputRef"
            :value="query"
            class="flex-1 bg-transparent outline-none text-[15px] text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
            placeholder="搜索聊天记录..."
            @input="$emit('update:query', $event.target.value)"
          >
          <button
            class="text-[var(--primary-color)] text-[14px] font-medium shrink-0 active:opacity-60 transition-opacity"
            @click="$emit('close')"
          >取消</button>
        </div>
      </div>

      <div class="relative flex-1 min-h-0">
        <div v-if="query && results.length === 0" class="flex flex-col items-center pt-14 pb-6">
          <div class="empty-icon w-14 h-14 rounded-full flex items-center justify-center mb-3">
            <i class="ph ph-magnifying-glass text-[24px] text-[var(--text-secondary)] opacity-35"></i>
          </div>
          <p class="text-[14px] text-[var(--text-secondary)] opacity-70">无搜索结果</p>
        </div>

        <div v-else-if="!query" class="flex flex-col items-center pt-14 pb-6 opacity-50">
          <i class="ph ph-chat-dots text-[32px] text-[var(--text-secondary)] mb-2"></i>
          <p class="text-[13px] text-[var(--text-secondary)]">输入关键词搜索聊天记录</p>
        </div>

        <div v-else class="relative flex h-full min-h-0 flex-col">
          <div class="search-result-count px-4 pb-1 text-[11px] text-[var(--text-secondary)] opacity-70">
            共 {{ results.length }} 条匹配
          </div>
          <div ref="resultsScrollerRef" class="relative flex-1 overflow-y-auto no-scrollbar">
            <div class="search-results-spacer" :style="{ height: `${totalSize}px` }">
              <button
                v-for="virtualRow in virtualRows"
                :key="results[virtualRow.index]?.key || virtualRow.key"
                class="result-item result-item-virtual block w-full px-3"
                :style="{ transform: `translateY(${virtualRow.start}px)` }"
                @click="$emit('jump', results[virtualRow.index].msgId, results[virtualRow.index].partKey)"
              >
                <div
                  class="text-[11px] text-[var(--text-secondary)] opacity-55 mb-1 px-1"
                  :class="results[virtualRow.index].role === 'user' ? 'text-right' : 'text-left'"
                >{{ results[virtualRow.index].timeText }}</div>

                <div class="flex" :class="results[virtualRow.index].role === 'user' ? 'justify-end' : 'justify-start'">
                  <div
                    class="result-bubble px-3 py-2 max-w-[85%] text-[14px] leading-[1.5] text-left"
                    :class="results[virtualRow.index].role === 'user'
                      ? 'bg-[var(--bubble-user-bg)] text-[var(--bubble-user-text)] rounded-[16px] rounded-br-[6px]'
                      : 'bg-[var(--bubble-ai-bg)] text-[var(--bubble-ai-text)] rounded-[16px] rounded-bl-[6px]'"
                  >
                    <span class="result-snippet" v-html="highlightSnippet(results[virtualRow.index].snippet)"></span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

const props = defineProps({
  visible: { type: Boolean, default: false },
  results: { type: Array, default: () => [] },
  query: { type: String, default: '' },
  topOffset: { type: [String, Number], default: 0 }
})

defineEmits(['close', 'update:query', 'jump'])

const RESULT_ITEM_ESTIMATE_PX = 96

const inputRef = ref(null)
const resultsScrollerRef = ref(null)

const overlayStyle = computed(() => ({
  top: typeof props.topOffset === 'number' ? `${props.topOffset}px` : props.topOffset,
  bottom: '0'
}))

const rowVirtualizer = useVirtualizer(computed(() => ({
  count: props.results.length,
  getScrollElement: () => resultsScrollerRef.value,
  estimateSize: () => RESULT_ITEM_ESTIMATE_PX,
  overscan: 10
})))

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const totalSize = computed(() => rowVirtualizer.value.getTotalSize())

watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => inputRef.value?.focus())
  }
})

watch(() => props.query, () => {
  nextTick(() => {
    resultsScrollerRef.value?.scrollTo?.({ top: 0 })
  })
})

function escapeHtml(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightSnippet(snippet) {
  if (!snippet || !props.query) return escapeHtml(snippet || '')
  const escaped = escapeHtml(snippet)
  const escapedQuery = escapeHtml(props.query)
  const regex = new RegExp('(' + escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
  return escaped.replace(regex, '<mark class="search-match">$1</mark>')
}
</script>

<style scoped>
.search-glass-bg {
  background-color: var(--bg-color);
  opacity: 0.94;
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}

.search-pill {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  opacity: 0.85;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: opacity 0.2s;
}

.search-pill:focus-within {
  opacity: 1;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.empty-icon {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.search-panel-enter-active,
.search-panel-leave-active {
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease;
}

.search-panel-enter-from,
.search-panel-leave-to {
  transform: translateY(-40px);
  opacity: 0;
}

.search-results-spacer {
  position: relative;
  width: 100%;
}

.result-item-virtual {
  position: absolute;
  inset-inline: 0;
  top: 0;
  min-height: 96px;
}

.result-bubble {
  animation: bubblePopIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  transition: transform 0.15s ease;
}

.result-item:active .result-bubble {
  transform: scale(0.97);
}

.result-snippet {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

@keyframes bubblePopIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

:deep(.search-match) {
  background: rgba(251, 191, 36, 0.45);
  border-radius: 3px;
  padding: 0 2px;
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.3);
  animation: matchBreathe 2.5s ease-in-out infinite alternate;
}

@keyframes matchBreathe {
  from { box-shadow: 0 0 4px rgba(251, 191, 36, 0.2); }
  to { box-shadow: 0 0 12px rgba(251, 191, 36, 0.5); }
}
</style>
