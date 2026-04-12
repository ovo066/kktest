<template>
  <div class="px-4 pb-3 ctrl-bar-entrance relative z-10">
    <!-- 更多按钮（视频模式，控制栏上方） -->
    <div v-if="isVideo" class="flex justify-center mb-2">
      <div class="relative">
        <button
          class="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/[0.08] active:bg-white/[0.12] transition-all"
          @click="showMore = !showMore"
        >
          <i class="ph ph-dots-three text-[16px] text-white/50"></i>
        </button>
        <!-- Popover 菜单 -->
        <Transition name="popover">
          <div
            v-if="showMore"
            class="absolute z-[80] bottom-full left-1/2 -translate-x-1/2 mb-2 popover-in"
          >
            <div class="glass-heavy rounded-2xl py-1.5 px-1 min-w-[140px] shadow-2xl">
              <button
                class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/75 text-[13px] active:bg-white/[0.08] transition-colors"
                @click="handleResources"
              >
                <i class="ph ph-gear text-[15px] text-white/50"></i>
                <span>素材管理</span>
              </button>
              <button
                class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/75 text-[13px] active:bg-white/[0.08] transition-colors"
                @click="handleToggleVideoMode"
              >
                <i class="ph ph-swap text-[15px] text-white/50"></i>
                <span>{{ videoSubMode === 'video' ? '切换见面模式' : '切换模拟视频' }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 主控制面板 — 3 按钮 -->
    <div v-if="showRecognizeButton" class="flex justify-center mb-2.5">
      <button
        class="px-4 h-8 rounded-full text-[12px] font-medium border transition-all"
        :class="recognizeDisabled ? 'bg-white/5 text-white/35 border-white/10' : 'bg-white/12 text-white/85 border-white/20 active:bg-white/20'"
        :disabled="recognizeDisabled"
        @click="$emit('trigger-recognition')"
      >
        {{ recognizeLabel }}
      </button>
    </div>

    <div class="flex items-end call-ctrl-bar rounded-[32px] py-3 px-3">
      <!-- 左侧：静音 -->
      <div class="flex-1 flex items-end justify-end">
        <button class="ctrl-btn-wrap" @click="$emit('toggle-mute')">
          <div
            class="ctrl-btn ctrl-btn-breathe"
            :class="{ 'ctrl-btn-on': muted }"
            style="animation-delay: 0s"
          >
            <i class="text-[18px]" :class="muted ? 'ph-fill ph-microphone-slash' : 'ph ph-microphone'"></i>
          </div>
          <span class="ctrl-label" :class="muted ? 'text-white/65' : ''">
            {{ muted ? '已静音' : '静音' }}
          </span>
        </button>
      </div>

      <!-- 中央：挂断 -->
      <div class="mx-3.5 flex flex-col items-center">
        <button @click="$emit('end-call')">
          <div class="hangup-btn">
            <div class="hangup-ring"></div>
            <i class="ph-fill ph-phone-disconnect text-[22px] text-white relative z-[1]"></i>
          </div>
        </button>
      </div>

      <!-- 右侧：键盘 -->
      <div class="flex-1 flex items-end justify-start">
        <button class="ctrl-btn-wrap" @click="$emit('toggle-text-input')">
          <div
            class="ctrl-btn ctrl-btn-breathe"
            :class="{ 'ctrl-btn-on': showTextInput }"
            style="animation-delay: 1.2s"
          >
            <i class="text-[18px]" :class="showTextInput ? 'ph-fill ph-keyboard' : 'ph ph-keyboard'"></i>
          </div>
          <span class="ctrl-label" :class="showTextInput ? 'text-white/65' : ''">键盘</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  muted: { type: Boolean, default: false },
  showTextInput: { type: Boolean, default: false },
  isVideo: { type: Boolean, default: false },
  videoSubMode: { type: String, default: 'video' },
  showRecognizeButton: { type: Boolean, default: false },
  recognizeDisabled: { type: Boolean, default: false },
  recognizeLabel: { type: String, default: '立即识别' }
})

const emit = defineEmits(['toggle-mute', 'end-call', 'toggle-text-input', 'open-resources', 'toggle-video-mode', 'trigger-recognition'])

const showMore = ref(false)

function handleResources() {
  showMore.value = false
  emit('open-resources')
}

function handleToggleVideoMode() {
  showMore.value = false
  emit('toggle-video-mode')
}
</script>
