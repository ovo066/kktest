<template>
  <div class="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-sm cursor-pointer active:scale-[0.98] transition-transform" @click="$emit('click')">
    <div class="p-4">
      <!-- Author -->
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white overflow-hidden shrink-0">
          <img v-if="isImageLikeUrl(post.authorAvatar)" :src="post.authorAvatar" class="w-full h-full object-cover">
          <span v-else class="text-lg">{{ post.authorAvatar || post.authorName?.[0] || '?' }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-[15px] dark:text-white truncate">{{ post.authorName }}</div>
          <div class="text-xs text-gray-400">{{ formatTime(post.time) }}</div>
        </div>
        <button class="text-gray-400 p-2" @click.stop="$emit('delete')">
          <i class="ph ph-dots-three text-xl"></i>
        </button>
      </div>

      <!-- Content -->
      <h3 class="font-bold text-[17px] dark:text-white mb-1 line-clamp-2">{{ post.title }}</h3>
      <p class="text-[15px] text-gray-600 dark:text-gray-300 line-clamp-3">{{ post.content }}</p>

      <!-- Actions -->
      <div class="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <button class="flex items-center gap-1.5 transition-colors" :class="post.isLiked ? 'text-red-500' : 'text-gray-400'" @click.stop="$emit('like')">
          <i :class="post.isLiked ? 'ph-fill ph-heart' : 'ph ph-heart'" class="text-xl"></i>
          <span class="text-sm">{{ post.likes || 0 }}</span>
        </button>
        <div class="flex items-center gap-1.5 text-gray-400">
          <i class="ph ph-chat-circle text-xl"></i>
          <span class="text-sm">{{ post.replies?.length || 0 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatRelativeTime } from '../../utils/relativeTime'

defineProps({
  post: { type: Object, required: true }
})

defineEmits(['click', 'like', 'delete'])

function formatTime(ts) {
  return formatRelativeTime(ts, { maxRelativeDays: 0 })
}

function isImageLikeUrl(value) {
  const text = String(value || '').trim()
  return text.startsWith('data:') || text.startsWith('blob:')
}
</script>
