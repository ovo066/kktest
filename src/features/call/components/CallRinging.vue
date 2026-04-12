<template>
  <div class="absolute inset-0 flex flex-col overflow-hidden">
    <!-- 全屏模糊背景 -->
    <div class="absolute inset-0 z-0">
      <img
        v-if="contact?.avatarType === 'image'"
        :src="contact?.avatar"
        class="w-full h-full object-cover scale-[1.15]"
      >
      <div v-else class="w-full h-full bg-gradient-to-b from-[#111] via-[#0a0a0a] to-[#000]"></div>
      <!-- 液态模糊层 -->
      <div class="absolute inset-0 backdrop-blur-[70px] bg-black/50"></div>
      <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50"></div>
    </div>

    <!-- 顶部区域 -->
    <div class="relative z-10 flex flex-col items-center pt-app-lg mt-20">
      <!-- 头像 + 波纹 -->
      <div class="relative mb-8">
        <!-- 波纹圈 -->
        <div class="absolute -inset-5 rounded-full border border-white/6 call-ring-wave"></div>
        <div class="absolute -inset-5 rounded-full border border-white/4 call-ring-wave-delay"></div>
        <div class="absolute -inset-5 rounded-full border border-white/3 call-ring-wave-delay2"></div>

        <!-- 头像 -->
        <div class="relative w-24 h-24 rounded-full overflow-hidden ring-[1.5px] ring-white/15 shadow-2xl animate-breathing">
          <img
            v-if="contact?.avatarType === 'image'"
            :src="contact?.avatar"
            class="w-full h-full object-cover"
          >
          <div v-else class="w-full h-full bg-gradient-to-br from-[#333] to-[#111] flex items-center justify-center">
            <span class="text-5xl">{{ contact?.avatar || '🤖' }}</span>
          </div>
        </div>
      </div>

      <!-- 名称 -->
      <div class="text-white text-[22px] font-semibold tracking-tight mb-1.5">{{ contact?.name || '未知' }}</div>

      <!-- 状态 -->
      <div class="flex items-center gap-2 text-white/45 text-[13px] font-medium">
        <template v-if="isIncoming">
          <i :class="callMode === 'video' ? 'ph ph-video-camera' : 'ph ph-phone'" class="text-sm text-white/35"></i>
          <span>{{ callMode === 'video' ? '邀请你视频通话' : '邀请你语音通话' }}</span>
        </template>
        <template v-else>
          <div class="flex gap-[3px] items-center mr-1">
            <span class="w-1 h-1 rounded-full bg-white/30 animate-pulse"></span>
            <span class="w-1 h-1 rounded-full bg-white/30 animate-pulse" style="animation-delay: 0.3s"></span>
            <span class="w-1 h-1 rounded-full bg-white/30 animate-pulse" style="animation-delay: 0.6s"></span>
          </div>
          <span>等待对方接听</span>
        </template>
      </div>

      <!-- 来电邀请语 -->
      <div
        v-if="inviteText && isIncoming"
        class="mt-5 px-5 py-2.5 rounded-2xl glass-panel max-w-[min(320px,calc(100vw-56px))]"
      >
        <p class="text-white/50 text-xs text-center leading-relaxed italic break-words whitespace-pre-wrap">"{{ inviteText }}"</p>
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="relative z-10 mt-auto pb-16 pb-app">
      <!-- 来电 -->
      <div v-if="isIncoming" class="flex items-center justify-center gap-20">
        <div class="flex flex-col items-center gap-2.5">
          <button
            class="w-[68px] h-[68px] rounded-full bg-[#FF3B30] flex items-center justify-center shadow-lg shadow-red-900/30 active:scale-90 transition-transform"
            @click="$emit('cancel')"
          >
            <i class="ph-fill ph-phone-disconnect text-[28px] text-white"></i>
          </button>
          <span class="text-[11px] text-white/40 font-medium">拒绝</span>
        </div>

        <div class="flex flex-col items-center gap-2.5">
          <button
            class="w-[68px] h-[68px] rounded-full bg-[#30D158] flex items-center justify-center shadow-lg shadow-green-900/30 active:scale-90 transition-transform call-accept-pulse"
            @click="$emit('accept')"
          >
            <i :class="callMode === 'video' ? 'ph-fill ph-video-camera' : 'ph-fill ph-phone-call'" class="text-[28px] text-white"></i>
          </button>
          <span class="text-[11px] text-white/40 font-medium">接听</span>
        </div>
      </div>

      <!-- 呼出 -->
      <div v-else class="flex flex-col items-center gap-2.5">
        <button
          class="w-[68px] h-[68px] rounded-full bg-[#FF3B30] flex items-center justify-center shadow-lg shadow-red-900/30 active:scale-90 transition-transform"
          @click="$emit('cancel')"
        >
          <i class="ph-fill ph-phone-disconnect text-[28px] text-white"></i>
        </button>
        <span class="text-[11px] text-white/40 font-medium">取消</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  contact: { type: Object, default: null },
  callMode: { type: String, default: 'voice' },
  isIncoming: { type: Boolean, default: false },
  inviteText: { type: String, default: '' }
})

defineEmits(['cancel', 'accept'])
</script>
