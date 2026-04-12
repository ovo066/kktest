<template>
  <div class="absolute inset-0 flex flex-col bg-[#F2F2F7] dark:bg-black">
    <!-- Header -->
    <div class="glass-panel z-10 flex items-center px-4 pt-app pb-3 shrink-0">
      <button class="text-[#007AFF] text-[17px] flex items-center" @click="goBack">
        <i class="ph ph-caret-left text-2xl"></i>
      </button>
      <span class="flex-1 text-center font-semibold text-[17px] dark:text-white">动态详情</span>
      <div class="w-8"></div>
    </div>

    <div v-if="moment" class="flex-1 overflow-y-auto no-scrollbar">
      <!-- Moment Content -->
      <div class="bg-white dark:bg-[#1C1C1E] m-4 rounded-2xl overflow-hidden">
        <div class="p-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white overflow-hidden">
              <img v-if="isImageLikeUrl(moment.authorAvatar)" :src="moment.authorAvatar" class="w-full h-full object-cover">
              <span v-else class="text-xl">{{ moment.authorAvatar || moment.authorName?.[0] || '?' }}</span>
            </div>
            <div class="flex-1">
              <div class="font-semibold text-[16px] dark:text-white">{{ moment.authorName }}</div>
              <div class="text-xs text-gray-400">
                {{ formatTime(moment.time) }}
                <span v-if="moment.mood" class="ml-1">{{ moment.mood }}</span>
              </div>
            </div>
            <button
              v-if="moment.authorId !== momentsStore.forumUser.id"
              class="px-3 py-1 rounded-full text-sm font-medium"
              :class="momentsStore.isFollowing(moment.authorId) ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : 'bg-[#007AFF] text-white'"
              @click="momentsStore.toggleFollow(moment.authorId); scheduleSave()"
            >
              {{ momentsStore.isFollowing(moment.authorId) ? '已关注' : '关注' }}
            </button>
          </div>

          <p class="text-[16px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{{ moment.content }}</p>

          <!-- Images -->
          <div v-if="moment.images && moment.images.length > 0" class="mt-3">
            <div class="grid gap-2" :class="imageGridClass(moment.images.length)">
              <div v-for="(img, idx) in moment.images" :key="idx" class="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img :src="img" class="w-full h-full object-cover">
              </div>
            </div>
          </div>

          <!-- Tags -->
          <div v-if="moment.tags && moment.tags.length > 0" class="flex gap-2 mt-3 flex-wrap">
            <span v-for="tag in moment.tags" :key="tag" class="px-2.5 py-1 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 text-xs font-medium">#{{ tag }}</span>
          </div>

          <div class="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button class="flex items-center gap-1.5" :class="moment.isLiked ? 'text-red-500' : 'text-gray-400'" @click="momentsStore.likeMoment(moment.id); scheduleSave()">
              <i :class="moment.isLiked ? 'ph-fill ph-heart' : 'ph ph-heart'" class="text-2xl"></i>
              <span>{{ moment.likes || 0 }}</span>
            </button>
            <div class="flex items-center gap-1.5 text-gray-400">
              <i class="ph ph-chat-circle text-2xl"></i>
              <span>{{ moment.replies?.length || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Replies -->
      <div class="px-4 pb-24">
        <div class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">评论 ({{ moment.replies?.length || 0 }})</div>
        <div class="space-y-3">
          <div v-for="reply in moment.replies" :key="reply.id" class="bg-white dark:bg-[#1C1C1E] rounded-xl p-4">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white overflow-hidden shrink-0">
                <img v-if="isImageLikeUrl(reply.authorAvatar)" :src="reply.authorAvatar" class="w-full h-full object-cover">
                <span v-else>{{ reply.authorAvatar || reply.authorName?.[0] || '?' }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-[14px] dark:text-white">{{ reply.authorName }}</span>
                  <span class="text-xs text-gray-400">{{ formatTime(reply.time) }}</span>
                </div>
                <p v-if="reply.replyToAuthorName" class="text-[12px] text-gray-400 mt-1">回复 @{{ reply.replyToAuthorName }}</p>
                <p class="text-[15px] text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{{ reply.content }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex-1 flex items-center justify-center text-gray-400">
      动态不存在
    </div>

    <!-- Reply Input -->
    <div v-if="moment" class="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 p-3 pb-app flex gap-2">
      <input
        v-model="replyContent"
        type="text"
        placeholder="写评论..."
        class="flex-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-full px-4 py-2.5 outline-none dark:text-white"
        @keyup.enter="submitReply"
      >
      <button class="w-10 h-10 bg-[#007AFF] rounded-full flex items-center justify-center text-white shrink-0" @click="submitReply">
        <i class="ph-bold ph-arrow-up"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMomentsStore } from '../../../stores/moments'
import { useChatStore } from '../../../stores/chat'
import { useStorage } from '../../../composables/useStorage'
import { formatRelativeTime } from '../../../utils/relativeTime'

const router = useRouter()
const route = useRoute()
const momentsStore = useMomentsStore()
const chatStore = useChatStore()
const { scheduleSave } = useStorage()

const replyContent = ref('')

const moment = computed(() => momentsStore.getMomentById(route.params.id))

function imageGridClass(count) {
  if (count === 1) return 'grid-cols-1 max-w-[280px]'
  if (count <= 4) return 'grid-cols-2 max-w-[300px]'
  return 'grid-cols-3'
}

function formatTime(ts) {
  return formatRelativeTime(ts, { maxRelativeDays: 0 })
}

function goBack() {
  // 桥接：设置返回标记，让下次 API 调用注入上下文
  if (moment.value) {
    chatStore.returnedFromMomentId = moment.value.id
  }
  router.back()
}

function submitReply() {
  if (!replyContent.value.trim() || !moment.value) return
  momentsStore.addReply(moment.value.id, {
    content: replyContent.value.trim(),
    authorId: momentsStore.forumUser.id,
    authorName: momentsStore.forumUser.name,
    authorAvatar: momentsStore.forumUser.avatar
  })
  replyContent.value = ''
  scheduleSave()
}

function isImageLikeUrl(value) {
  const text = String(value || '').trim()
  return text.startsWith('data:') || text.startsWith('blob:')
}
</script>
