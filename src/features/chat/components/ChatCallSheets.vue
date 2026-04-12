<template>
  <Teleport to="body">
    <Transition name="action-sheet">
      <div v-if="sheetUiMounted" v-show="callModeVisible" class="fixed inset-0 z-[1100] flex items-end justify-center">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-[1px]" @click="$emit('close-call-mode-sheet')"></div>
        <div class="relative w-[95%] max-w-md mx-auto mb-4 safe-area-bottom z-10 flex flex-col gap-2 transition-transform duration-300">
          <div class="bg-[rgba(255,255,255,0.85)] dark:bg-[rgba(30,30,30,0.85)] backdrop-blur-lg rounded-[14px] overflow-hidden">
            <div class="text-[13px] text-[var(--text-secondary)] py-3 text-center border-b border-[var(--border-color)] font-medium">
              选择通话方式
            </div>
            <button
              class="w-full py-4 text-[17px] text-[var(--primary-color)] active:bg-black/5 dark:active:bg-white/10 transition-colors flex items-center justify-center gap-2 border-b border-[var(--border-color)] font-medium"
              @click="$emit('start-call', 'voice')"
            >
              <i class="ph-fill ph-phone text-xl"></i>
              语音通话
            </button>
            <button
              class="w-full py-4 text-[17px] text-[var(--primary-color)] active:bg-black/5 dark:active:bg-white/10 transition-colors flex items-center justify-center gap-2 font-medium"
              @click="$emit('start-call', 'video')"
            >
              <i class="ph-fill ph-video-camera text-xl"></i>
              视频通话
            </button>
            <button
              class="w-full py-4 text-[17px] text-[var(--primary-color)] active:bg-black/5 dark:active:bg-white/10 transition-colors flex items-center justify-center gap-2 border-t border-[var(--border-color)] font-medium"
              @click="$emit('start-offline')"
            >
              <i class="ph ph-book-open text-xl"></i>
              线下剧情
            </button>
          </div>

          <button
            class="w-full py-4 rounded-[14px] bg-white dark:bg-[#2C2C2E] text-[17px] font-semibold text-[var(--primary-color)] active:scale-[0.98] transition-all shadow-sm"
            @click="$emit('close-call-mode-sheet')"
          >
            取消
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="fade-scale">
      <div v-if="sheetUiMounted && incomingInfo" v-show="incomingVisible" class="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-[1px]">
        <div class="relative w-full max-w-sm bg-[rgba(255,255,255,0.95)] dark:bg-[rgba(28,28,30,0.95)] backdrop-blur-lg rounded-[28px] shadow-2xl p-8 flex flex-col items-center gap-6 overflow-hidden ring-1 ring-white/20 dark:ring-white/5">
          <div class="relative">
            <div class="w-24 h-24 rounded-full overflow-hidden shadow-lg ring-4 ring-white/20 dark:ring-white/10 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-4xl">
              <img v-if="incomingInfo.avatarType === 'image'" :src="incomingInfo.avatar" class="w-full h-full object-cover" />
              <span v-else>{{ incomingInfo.avatar }}</span>
            </div>
            <div class="absolute -bottom-1 -right-1 bg-white dark:bg-[#1C1C1E] rounded-full p-2 shadow-md flex items-center justify-center">
              <i v-if="incomingInfo.mode === 'video'" class="ph-fill ph-video-camera text-lg text-[var(--primary-color)]"></i>
              <i v-else class="ph-fill ph-phone text-lg text-[var(--primary-color)]"></i>
            </div>
          </div>

          <div class="text-center space-y-2">
            <h3 class="text-2xl font-semibold text-[var(--text-primary)]">{{ incomingInfo.name }}</h3>
            <p class="text-[15px] text-[var(--text-secondary)]">{{ incomingInfo.text }}</p>
          </div>

          <div class="grid grid-cols-2 gap-8 w-full mt-4 px-4">
            <button class="flex flex-col items-center gap-2 group" @click="$emit('decline-call')">
              <div class="w-16 h-16 rounded-full bg-[#FF3B30] flex items-center justify-center text-white shadow-lg group-active:scale-90 transition-transform duration-200">
                <i class="ph-fill ph-phone-slash text-2xl"></i>
              </div>
              <span class="text-xs font-medium text-[var(--text-secondary)]">拒绝</span>
            </button>

            <button class="flex flex-col items-center gap-2 group" @click="$emit('accept-call')">
              <div class="w-16 h-16 rounded-full bg-[#34C759] flex items-center justify-center text-white shadow-lg group-active:scale-90 transition-transform duration-200">
                <i class="ph-fill ph-video-camera text-2xl" v-if="incomingInfo.mode === 'video'"></i>
                <i class="ph-fill ph-phone text-2xl" v-else></i>
              </div>
              <span class="text-xs font-medium text-[var(--text-secondary)]">接听</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  callModeVisible: { type: Boolean, default: false },
  incomingVisible: { type: Boolean, default: false },
  incomingInfo: { type: Object, default: null }
})

defineEmits(['close-call-mode-sheet', 'start-call', 'start-offline', 'accept-call', 'decline-call'])

const sheetUiMounted = ref(false)
let warmupTimer = 0
let warmupIdleId = null

function finalizeWarmup() {
  warmupTimer = 0
  warmupIdleId = null
  sheetUiMounted.value = true
}

onMounted(() => {
  if (typeof window === 'undefined') {
    sheetUiMounted.value = true
    return
  }
  if (typeof window.requestIdleCallback === 'function') {
    warmupIdleId = window.requestIdleCallback(finalizeWarmup, { timeout: 700 })
    return
  }
  warmupTimer = window.setTimeout(finalizeWarmup, 220)
})

watch(() => [props.callModeVisible, props.incomingVisible], ([callModeVisible, incomingVisible]) => {
  if (!callModeVisible && !incomingVisible) return
  finalizeWarmup()
}, { immediate: true })

onBeforeUnmount(() => {
  if (warmupTimer) {
    clearTimeout(warmupTimer)
    warmupTimer = 0
  }
  if (warmupIdleId !== null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(warmupIdleId)
    warmupIdleId = null
  }
})
</script>

<style scoped>
/* Action Sheet 动画 */
.action-sheet-enter-active,
.action-sheet-leave-active {
  transition: opacity 0.3s ease;
}
.action-sheet-enter-active .relative,
.action-sheet-leave-active .relative {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.action-sheet-enter-from {
  opacity: 0;
}
.action-sheet-enter-from .relative {
  transform: translateY(100%);
}

.action-sheet-leave-to {
  opacity: 0;
}
.action-sheet-leave-to .relative {
  transform: translateY(100%);
}

/* Incoming Call Popup Animation */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.3s ease;
}
.fade-scale-enter-active .relative,
.fade-scale-leave-active .relative {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
}
.fade-scale-enter-from .relative,
.fade-scale-leave-to .relative {
  transform: scale(0.9);
}
</style>
