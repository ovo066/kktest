<template>
  <div v-if="isTyping || isThinking" class="flex mb-2">
    <!-- 阶段1：等待连接 - 跳动圆点 -->
    <div v-if="isTyping" class="bubble bubble-ai bubble-typing ml-2">
      <div class="flex gap-1">
        <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
      </div>
    </div>
    <!-- 阶段2：思考中 - 脉冲动画 -->
    <div v-else class="bubble bubble-ai ml-2 thinking-bubble">
      <div class="flex items-center gap-1.5">
        <i class="ph-fill ph-sparkle text-xs thinking-sparkle"></i>
        <span class="text-xs thinking-text">思考中</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isTyping: { type: Boolean, default: false },
  isThinking: { type: Boolean, default: false }
})
</script>

<style scoped>
.thinking-bubble {
  border-radius: 999px !important;
  opacity: 0.85;
}

.thinking-sparkle {
  animation: thinking-pulse 1.8s ease-in-out infinite;
  color: var(--text-secondary, #8E8E93);
}

.thinking-text {
  animation: thinking-pulse 1.8s ease-in-out infinite;
  animation-delay: 0.15s;
  color: var(--text-secondary, #8E8E93);
  letter-spacing: 0.5px;
}

@keyframes thinking-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
</style>
