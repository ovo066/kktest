<template>
  <div class="w-full flex justify-center my-2 px-4">
    <button
      class="moment-notif-card"
      @click="goToMoment"
    >
      <div class="moment-notif-avatar">
        <img v-if="block.momentAuthorAvatar && block.momentAvatarType === 'image'" :src="block.momentAuthorAvatar" class="w-full h-full object-cover rounded-full">
        <span v-else class="text-base">{{ block.momentAuthorAvatar || '📝' }}</span>
      </div>
      <div class="moment-notif-body">
        <div class="moment-notif-title">{{ block.momentAuthorName || '好友' }} 发布了动态</div>
        <div class="moment-notif-preview">{{ block.momentPreview }}</div>
      </div>
      <i class="ph ph-caret-right moment-notif-arrow"></i>
    </button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  block: { type: Object, required: true }
})

const router = useRouter()

function goToMoment() {
  if (props.block.momentId) {
    router.push('/moments/' + props.block.momentId)
  }
}
</script>

<style scoped>
.moment-notif-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--card-bg, rgba(0, 0, 0, 0.04));
  border-radius: 14px;
  max-width: 85%;
  width: fit-content;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.moment-notif-card:active {
  transform: scale(0.97);
}

.moment-notif-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--bubble-ai-bg, #E9E9EB);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.moment-notif-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.moment-notif-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #000);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.moment-notif-preview {
  font-size: 12px;
  color: var(--text-secondary, #8E8E93);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.moment-notif-arrow {
  font-size: 16px;
  color: var(--text-secondary, #8E8E93);
  opacity: 0.5;
  flex-shrink: 0;
}
</style>
