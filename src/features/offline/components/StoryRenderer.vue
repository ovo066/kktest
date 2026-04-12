<template>
  <div ref="containerRef" class="story-renderer">
    <div class="dot-pattern"></div>

    <div v-if="segments.length === 0" class="empty-state">
      <i class="ph ph-book-open-text empty-icon"></i>
      <p class="empty-title">故事还未开始...</p>
      <p class="empty-sub">在下方输入第一句话吧</p>
    </div>

    <StorySegment
      v-for="(seg, idx) in segments"
      :key="seg.id"
      :segment="seg"
      :layout-mode="layoutMode"
      :avatar-mode="avatarMode"
      :floor-number="floorMap[seg.id] || 0"
      :user-name="userName"
      :user-avatar="userAvatar"
      :user-avatar-type="userAvatarType"
      :char-name="charName"
      :char-avatar="charAvatar"
      :char-avatar-type="charAvatarType"
      :is-last="idx === segments.length - 1 && seg.role === 'assistant'"
      @reroll="(s) => $emit('reroll', s)"
      @edit="(s) => $emit('edit', s)"
      @delete="(s) => $emit('delete', s)"
      @copy="(s) => $emit('copy', s)"
    />

    <div ref="bottomAnchor" class="h-anchor"></div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed, onMounted } from 'vue'
import StorySegment from './StorySegment.vue'

const props = defineProps({
  segments: { type: Array, default: () => [] },
  layoutMode: { type: String, default: 'classic' },
  avatarMode: { type: String, default: 'side' },
  userName: { type: String, default: '你' },
  userAvatar: { type: String, default: '' },
  userAvatarType: { type: String, default: 'emoji' },
  charName: { type: String, default: '' },
  charAvatar: { type: String, default: '' },
  charAvatarType: { type: String, default: 'emoji' }
})

defineEmits(['reroll', 'edit', 'delete', 'copy'])

const containerRef = ref(null)
const bottomAnchor = ref(null)
const hasInitialScrollDone = ref(false)
const floorMap = computed(() => {
  const map = {}
  let floor = 0
  for (const seg of (props.segments || [])) {
    if (seg?.role === 'user' || seg?.role === 'assistant') floor++
    map[seg?.id] = floor
  }
  return map
})

function scrollToBottom(options = {}) {
  const smooth = options?.smooth !== false
  nextTick(() => {
    const container = containerRef.value
    if (!container) return
    const top = Math.max(0, container.scrollHeight - container.clientHeight)

    if (smooth && typeof container.scrollTo === 'function') {
      container.scrollTo({ top, behavior: 'smooth' })
    } else {
      container.scrollTop = top
    }
  })
}

function scrollToBottomImmediate() {
  scrollToBottom({ smooth: false })
}

onMounted(() => {
  // Entering offline view should land on latest floor immediately.
  scrollToBottomImmediate()
  requestAnimationFrame(() => {
    scrollToBottomImmediate()
    hasInitialScrollDone.value = true
  })
})

watch(() => props.segments.length, () => {
  if (!hasInitialScrollDone.value) {
    scrollToBottomImmediate()
    return
  }
  scrollToBottom({ smooth: true })
})

watch(() => {
  const last = props.segments[props.segments.length - 1]
  return last?.isStreaming ? last.html : null
}, () => {
  if (!hasInitialScrollDone.value) {
    scrollToBottomImmediate()
    return
  }
  scrollToBottom({ smooth: true })
})

defineExpose({ scrollToBottom })
</script>

<style scoped>
.story-renderer {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  padding: 12px 0;
  scrollbar-width: none;
}
.story-renderer::-webkit-scrollbar {
  display: none;
}

.dot-pattern {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--off-border) 1px, transparent 0);
  background-size: 20px 20px;
  opacity: 0.04;
  pointer-events: none;
  z-index: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--off-text-sec);
  text-align: center;
  gap: 8px;
  position: relative;
  z-index: 1;
}
.empty-icon {
  font-size: 48px;
  opacity: 0.25;
}
.empty-title {
  font-size: 16px;
  font-weight: 700;
}
.empty-sub {
  font-size: 13px;
  opacity: 0.6;
}

.h-anchor {
  height: 16px;
}
</style>
