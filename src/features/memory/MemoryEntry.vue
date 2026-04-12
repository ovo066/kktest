<template>
  <div
    class="relative overflow-hidden mb-2.5"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- 删除按钮背景层 -->
    <div
      class="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center transition-opacity duration-200"
      :class="swipeX < 0 ? 'opacity-100' : 'opacity-0'"
      style="background: rgba(255, 59, 48, 0.9); backdrop-filter: blur(8px);"
    >
      <button
        class="w-full h-full flex items-center justify-center text-white active:opacity-70"
        @click.stop="handleDelete"
      >
        <i class="ph ph-trash text-[20px]"></i>
      </button>
    </div>

    <!-- 主内容区 - 玻璃卡片 -->
    <div
      class="memory-entry-glass rounded-2xl px-4 py-3.5 flex items-start gap-3 transition-transform"
      :class="swiping ? '' : 'duration-200'"
      :style="{ transform: `translateX(${swipeX}px)` }"
    >
      <!-- 勾选框（仅核心记忆） -->
      <button
        v-if="type === 'core'"
        class="shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center mt-0.5 transition-all duration-200"
        :class="memory.enabled
          ? 'bg-[var(--primary-color)] shadow-[0_0_10px_var(--primary-color)/30]'
          : 'bg-transparent border-[1.5px] border-[var(--text-secondary)]/20'"
        @click.stop="$emit('toggle')"
      >
        <i v-if="memory.enabled" class="ph-bold ph-check text-white text-[11px]"></i>
      </button>

      <!-- 类型指示点（总结） -->
      <div
        v-else
        class="shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center mt-0.5"
        :class="type === 'long' ? 'bg-amber-400/10' : 'bg-[var(--primary-color)]/8'"
      >
        <i
          class="ph text-[12px]"
          :class="type === 'long' ? 'ph-book-bookmark text-amber-400' : 'ph-chat-text text-[var(--primary-color)]'"
        ></i>
      </div>

      <!-- 内容 -->
      <div class="flex-1 min-w-0">
        <div class="flex items-start gap-1.5">
          <i
            v-if="type === 'core' && memory.priority === 'high'"
            class="ph-fill ph-star text-amber-400 text-[12px] shrink-0 mt-1"
          ></i>
          <span
            v-if="type !== 'core' && memory.amCode"
            class="am-code-badge shrink-0 mt-0.5"
          >{{ memory.amCode }}</span>
          <p class="text-[14px] text-[var(--text-primary)] leading-[1.6] opacity-90">{{ displayContentText }}</p>
        </div>
        <div class="flex items-center gap-1.5 mt-2 text-[11px] text-[var(--text-secondary)] opacity-60">
          <span v-if="type === 'core'" class="inline-flex items-center gap-1">
            <i class="ph" :class="sourceIcon"></i>
            {{ sourceLabel }}
          </span>
          <span v-else-if="type === 'long'" class="text-amber-400/80 font-medium">长期记忆</span>
          <span v-else class="text-[var(--primary-color)]/80">近期总结</span>
          <span class="opacity-40">·</span>
          <span v-if="memory.msgRange?.count">{{ memory.msgRange.count }} 条消息</span>
          <span v-else>{{ timeAgo }}</span>
          <span
            v-if="summaryStatusLabel"
            class="summary-status-chip"
            :class="summaryStatusClass"
            :title="memory.lastError || ''"
          >
            {{ summaryStatusLabel }}
          </span>
          <span v-if="!hasInteracted" class="opacity-30 ml-auto text-[10px]">← 左滑删除</span>
        </div>
      </div>

      <!-- 重Roll按钮 -->
      <button
        v-if="showReroll"
        class="shrink-0 w-7 h-7 flex items-center justify-center text-[var(--text-secondary)] opacity-40 active:opacity-80 transition-opacity"
        :disabled="rerolling"
        @click.stop="$emit('reroll')"
      >
        <i class="ph text-[15px]" :class="rerolling ? 'ph-circle-notch animate-spin' : 'ph-arrow-counter-clockwise'"></i>
      </button>

      <!-- 编辑按钮 -->
      <button
        class="shrink-0 w-7 h-7 flex items-center justify-center text-[var(--text-secondary)] opacity-30 active:opacity-80 transition-opacity"
        @click.stop="$emit('edit')"
      >
        <i class="ph ph-pencil-simple text-[16px]"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  memory: { type: Object, required: true },
  displayContent: { type: String, default: '' },
  type: { type: String, default: 'core' },
  showBorder: { type: Boolean, default: true },
  showReroll: { type: Boolean, default: false },
  rerolling: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle', 'edit', 'delete', 'reroll'])

const swipeX = ref(0)
const swiping = ref(false)
const hasInteracted = ref(false)
let startX = 0
let startY = 0

onMounted(() => {
  hasInteracted.value = localStorage.getItem('memory_swipe_hint') === '1'
})

const sourceLabel = computed(() => {
  const map = { manual: '手动', keyword: '关键词', extracted: 'AI候选', promoted: '提升', manager: '管家' }
  return map[props.memory.source] || '手动'
})

const sourceIcon = computed(() => {
  const map = { manual: 'ph-user', keyword: 'ph-hash', extracted: 'ph-robot', promoted: 'ph-arrow-up', manager: 'ph-broom' }
  return map[props.memory.source] || 'ph-user'
})

const displayContentText = computed(() => {
  const rendered = String(props.displayContent || '').trim()
  if (rendered) return rendered
  return String(props.memory?.content || '')
})

const timeAgo = computed(() => {
  if (!props.memory.time) return ''
  const diff = Date.now() - props.memory.time
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return min + '分钟前'
  const hr = Math.floor(min / 60)
  if (hr < 24) return hr + '小时前'
  const d = Math.floor(hr / 24)
  return d + '天前'
})

const summaryStatusLabel = computed(() => {
  if (props.type === 'core') return ''
  const status = String(props.memory?.status || 'ok')
  if (status === 'failed') return '失败'
  if (status === 'truncated') return '截断'
  return ''
})

const summaryStatusClass = computed(() => {
  const status = String(props.memory?.status || 'ok')
  if (status === 'failed') return 'is-failed'
  if (status === 'truncated') return 'is-truncated'
  return ''
})

function handleTouchStart(e) {
  startX = e.touches[0].clientX
  startY = e.touches[0].clientY
  swiping.value = false
}

function handleTouchMove(e) {
  const dx = e.touches[0].clientX - startX
  const dy = e.touches[0].clientY - startY

  if (!swiping.value && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
    swiping.value = true
    if (!hasInteracted.value) {
      hasInteracted.value = true
      localStorage.setItem('memory_swipe_hint', '1')
    }
  }

  if (swiping.value) {
    if (dx < 0) {
      swipeX.value = Math.max(dx, -80)
    } else if (dx > 0 && swipeX.value < 0) {
      swipeX.value = Math.min(0, swipeX.value + dx)
    }
  }
}

function handleTouchEnd() {
  swiping.value = false
  if (swipeX.value < -40) {
    swipeX.value = -80
  } else {
    swipeX.value = 0
  }
}

function handleDelete() {
  swipeX.value = 0
  setTimeout(() => {
    emit('delete')
  }, 200)
}
</script>

<style scoped>
.memory-entry-glass {
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 0.5px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
}
.dark .memory-entry-glass {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}

.am-code-badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  font-family: monospace;
  line-height: 1.5;
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb, 0, 122, 255), 0.1);
  border: 0.5px solid rgba(var(--primary-color-rgb, 0, 122, 255), 0.2);
  letter-spacing: 0.5px;
}

.summary-status-chip {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1.5;
  border: 1px solid transparent;
}

.summary-status-chip.is-failed {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
}

.summary-status-chip.is-truncated {
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.35);
  background: rgba(245, 158, 11, 0.08);
}
</style>
