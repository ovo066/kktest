<template>
  <div class="absolute inset-0 flex flex-col">

    <!-- ==================== 视频模式：模拟视频 ==================== -->
    <template v-if="callMode === 'video' && videoSubMode === 'video'">
      <!-- 主画面：角色自定义图 全屏 -->
      <div class="absolute inset-0 z-0">
        <img
          v-if="characterImage"
          :src="characterImage"
          class="w-full h-full object-cover"
          draggable="false"
        >
        <template v-else>
          <!-- 无角色图：头像占满全屏 -->
          <img
            v-if="contact?.avatarType === 'image'"
            :src="contact?.avatar"
            class="w-full h-full object-cover"
          >
          <div v-else class="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] flex items-center justify-center">
            <span class="text-[120px]">{{ contact?.avatar || '🤖' }}</span>
          </div>
        </template>
      </div>

      <!-- 说话时微小波形指示 -->
      <div
        v-if="aiSpeaking && characterImage"
        class="absolute bottom-[25vh] left-1/2 -translate-x-1/2 z-[2] flex items-end gap-[2px] h-5"
      >
        <div
          v-for="i in 5"
          :key="i"
          class="w-[2.5px] bg-white/50 rounded-full waveform-bar"
          :style="{ animationDelay: (i * 0.1) + 's' }"
        ></div>
      </div>

      <!-- PiP 用户画中画（仅视频模式） -->
      <div
        class="absolute z-[45] pip-entrance"
        :class="pipPositionClass"
        :style="pipDragStyle"
        @touchstart.passive="onPipTouchStart"
        @touchmove.prevent="onPipTouchMove"
        @touchend="onPipTouchEnd"
      >
        <div class="w-[95px] h-[130px] rounded-[18px] overflow-hidden shadow-2xl ring-1 ring-white/15 glass-heavy">
          <img
            v-if="userAvatarUrl"
            :src="userAvatarUrl"
            class="w-full h-full object-cover"
          >
          <div v-else class="w-full h-full bg-gradient-to-br from-[#222] to-[#0a0a0a] flex items-center justify-center">
            <span class="text-3xl">{{ userAvatarEmoji || '👤' }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ==================== 视频模式：Galgame ==================== -->
    <template v-else-if="callMode === 'video' && videoSubMode === 'galgame'">
      <!-- 背景 -->
      <div class="absolute inset-0 z-0">
        <div
          class="absolute inset-0 bg-cover bg-center transition-all duration-1000"
          :style="bgStyle"
        ></div>
      </div>

      <!-- 立绘 -->
      <div class="absolute inset-0 pointer-events-none flex items-end justify-center z-[1]">
        <div
          class="relative w-full h-[82vh] flex items-end justify-center transition-all duration-500"
          :class="[spriteAnimClass, aiSpeaking ? 'sprite-speaking' : '']"
        >
          <img
            v-if="spriteUrl"
            :src="spriteUrl"
            class="h-full w-auto object-contain drop-shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
            draggable="false"
          >
          <div v-else class="absolute inset-0 flex items-center justify-center">
            <div
              class="w-44 h-44 rounded-[2.5rem] overflow-hidden shadow-2xl ring-1 ring-white/8 transition-transform duration-700"
              :class="aiSpeaking ? 'scale-105' : 'scale-100'"
            >
              <img
                v-if="contact?.avatarType === 'image'"
                :src="contact?.avatar"
                class="w-full h-full object-cover"
              >
              <div v-else class="w-full h-full bg-gradient-to-br from-[#2a2a2a] to-[#111] flex items-center justify-center">
                <span class="text-[72px]">{{ contact?.avatar || '🤖' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PiP（Galgame 模式也有） -->
      <div
        class="absolute z-[45] pip-entrance"
        :class="pipPositionClass"
        :style="pipDragStyle"
        @touchstart.passive="onPipTouchStart"
        @touchmove.prevent="onPipTouchMove"
        @touchend="onPipTouchEnd"
      >
        <div class="w-[95px] h-[130px] rounded-[18px] overflow-hidden shadow-2xl ring-1 ring-white/15 glass-heavy">
          <img
            v-if="userAvatarUrl"
            :src="userAvatarUrl"
            class="w-full h-full object-cover"
          >
          <div v-else class="w-full h-full bg-gradient-to-br from-[#222] to-[#0a0a0a] flex items-center justify-center">
            <span class="text-3xl">{{ userAvatarEmoji || '👤' }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ==================== 语音模式（无 PiP） ==================== -->
    <template v-else>
      <!-- 背景 -->
      <div class="absolute inset-0 z-0">
        <img
          v-if="contact?.avatarType === 'image'"
          :src="contact?.avatar"
          class="w-full h-full object-cover scale-125 opacity-25"
        >
        <div class="absolute inset-0 backdrop-blur-[80px] bg-gradient-to-b from-[#0a0a0a]/90 via-[#111]/85 to-black/95"></div>
      </div>

      <!-- 中心内容 -->
      <div class="absolute inset-0 flex flex-col items-center justify-center z-[1] pb-44">
        <!-- 头像 + 环形波纹 -->
        <div class="relative mb-8">
          <!-- 说话时环形扩散 -->
          <div
            v-if="aiSpeaking"
            class="absolute -inset-4 rounded-full border border-white/8 voice-ring"
          ></div>
          <div
            v-if="aiSpeaking"
            class="absolute -inset-4 rounded-full border border-white/6 voice-ring-delay"
          ></div>
          <div
            v-if="aiSpeaking"
            class="absolute -inset-4 rounded-full border border-white/4 voice-ring-delay2"
          ></div>

          <!-- 头像光晕 -->
          <div
            class="absolute -inset-5 rounded-full blur-2xl transition-all duration-700"
            :class="aiSpeaking ? 'bg-white/[0.06] scale-110' : 'bg-white/[0.02] scale-100'"
          ></div>

          <div
            class="relative w-32 h-32 rounded-full overflow-hidden ring-[1.5px] ring-white/12 shadow-2xl transition-all duration-700"
            :class="aiSpeaking ? 'scale-110 ring-white/20' : 'scale-100'"
          >
            <img
              v-if="contact?.avatarType === 'image'"
              :src="contact?.avatar"
              class="w-full h-full object-cover"
            >
            <div v-else class="w-full h-full bg-gradient-to-br from-[#2a2a2a] to-[#111] flex items-center justify-center">
              <span class="text-6xl">{{ contact?.avatar || '🤖' }}</span>
            </div>
          </div>
        </div>

        <!-- 名称 -->
        <div class="text-white/85 text-[17px] font-semibold mb-5">{{ contact?.name }}</div>

        <!-- 波形 -->
        <div class="h-12 flex items-center justify-center gap-[4px] w-full max-w-[160px]">
          <template v-if="aiSpeaking">
            <div
              v-for="i in 7"
              :key="i"
              class="w-[2.5px] bg-white/40 rounded-full waveform-bar"
              :style="{ animationDelay: (i * 0.09) + 's' }"
            ></div>
          </template>
          <div v-else class="flex gap-1.5">
            <div class="w-1 h-1 rounded-full bg-white/20 animate-bounce" style="animation-delay: 0s"></div>
            <div class="w-1 h-1 rounded-full bg-white/20 animate-bounce" style="animation-delay: 0.2s"></div>
            <div class="w-1 h-1 rounded-full bg-white/20 animate-bounce" style="animation-delay: 0.4s"></div>
          </div>
        </div>

        <!-- 表情 -->
        <div
          v-if="emotion !== 'normal'"
          class="mt-4 px-4 py-1.5 rounded-full glass-panel text-white/55 text-[11px] font-medium"
        >
          {{ emotionLabel }}
        </div>
      </div>
    </template>

    <!-- ==================== 通用顶部 UI ==================== -->
    <!-- 时长胶囊 -->
    <div class="relative z-[46] pt-app-lg px-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel">
          <div class="w-[5px] h-[5px] rounded-full bg-[#30D158] shadow-[0_0_6px_rgba(48,209,88,0.5)]"></div>
          <span class="text-white/80 text-[11px] font-mono tabular-nums">{{ duration }}</span>
        </div>
        <!-- 占位 (为 PiP 留空间，仅视频模式) -->
        <div v-if="callMode === 'video'" class="w-[95px]"></div>
      </div>
    </div>

    <!-- 表情标签（视频模式浮动） -->
    <div
      v-if="callMode === 'video' && emotion !== 'normal'"
      class="absolute z-20 left-1/2 -translate-x-1/2"
      :style="{ bottom: videoSubMode === 'galgame' ? '25vh' : '24vh' }"
    >
      <div class="px-3.5 py-1 rounded-full glass-panel text-white/60 text-[11px] font-medium">
        {{ emotionLabel }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  contact: { type: Object, default: null },
  callMode: { type: String, default: 'voice' },
  videoSubMode: { type: String, default: 'video' },
  spriteUrl: { type: String, default: '' },
  bgUrl: { type: String, default: '' },
  characterImage: { type: String, default: '' },
  emotion: { type: String, default: 'normal' },
  aiSpeaking: { type: Boolean, default: false },
  duration: { type: String, default: '0:00' },
  userAvatar: { type: String, default: '' },
  userAvatarType: { type: String, default: '' },
  userAvatarEmoji: { type: String, default: '👤' }
})

const EMOTION_LABELS = {
  normal: '', happy: '开心', sad: '难过', surprised: '惊讶',
  angry: '生气', shy: '害羞', thinking: '思考', laughing: '大笑',
  excited: '兴奋', worried: '担心', confused: '困惑',
  love: '心动', sleepy: '困了', proud: '骄傲', nervous: '紧张'
}

const emotionLabel = computed(() => EMOTION_LABELS[props.emotion] || props.emotion)

const userAvatarUrl = computed(() => {
  if (props.userAvatarType === 'image' && props.userAvatar) return props.userAvatar
  return ''
})

const bgStyle = computed(() => {
  if (props.bgUrl) {
    return { backgroundImage: `url('${props.bgUrl}')` }
  }
  return { backgroundImage: 'linear-gradient(180deg, #111, #0a0a0a)' }
})

// 情绪切换动画
const spriteAnimClass = ref('')
watch(() => props.emotion, (newEm, oldEm) => {
  if (newEm === oldEm) return
  const map = {
    happy: 'call-emotion-bounce', sad: 'call-emotion-shake',
    surprised: 'call-emotion-jump', angry: 'call-emotion-shake',
    shy: 'call-emotion-bounce', laughing: 'call-emotion-bounce',
    excited: 'call-emotion-jump', love: 'call-emotion-bounce'
  }
  spriteAnimClass.value = map[newEm] || 'call-emotion-bounce'
  setTimeout(() => { spriteAnimClass.value = '' }, 450)
})

// PiP 拖拽
const pipCorner = ref('top-right')
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const dragStart = ref({ x: 0, y: 0 })
const dragCurrent = ref({ x: 0, y: 0 })

const pipPositionClass = computed(() => {
  if (isDragging.value) return ''
  const map = {
    'top-right': 'top-[calc(var(--app-pt,44px)+8px)] right-3',
    'top-left': 'top-[calc(var(--app-pt,44px)+8px)] left-3',
    'bottom-right': 'bottom-[200px] right-3',
    'bottom-left': 'bottom-[200px] left-3'
  }
  return map[pipCorner.value]
})

const pipDragStyle = computed(() => {
  if (!isDragging.value) return { transition: 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)' }
  return {
    position: 'fixed',
    left: dragCurrent.value.x - dragOffset.value.x + 'px',
    top: dragCurrent.value.y - dragOffset.value.y + 'px',
    transition: 'none'
  }
})

function onPipTouchStart(e) {
  const touch = e.touches[0]
  const rect = e.currentTarget.getBoundingClientRect()
  dragOffset.value = { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  dragStart.value = { x: touch.clientX, y: touch.clientY }
  dragCurrent.value = { x: touch.clientX, y: touch.clientY }
}

function onPipTouchMove(e) {
  const touch = e.touches[0]
  if (Math.abs(touch.clientX - dragStart.value.x) > 8 || Math.abs(touch.clientY - dragStart.value.y) > 8) {
    isDragging.value = true
  }
  dragCurrent.value = { x: touch.clientX, y: touch.clientY }
}

function onPipTouchEnd() {
  if (isDragging.value) {
    const x = dragCurrent.value.x
    const y = dragCurrent.value.y
    const midX = window.innerWidth / 2
    const midY = window.innerHeight / 2
    pipCorner.value = `${y < midY ? 'top' : 'bottom'}-${x < midX ? 'left' : 'right'}`
  }
  isDragging.value = false
}
</script>
