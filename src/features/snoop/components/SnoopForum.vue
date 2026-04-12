<template>
  <div class="snoop-tab-content">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div v-for="i in 4" :key="i" class="snoop-forum-skeleton">
        <div class="snoop-skeleton-line" style="width: 30%"></div>
        <div class="snoop-skeleton-line" style="width: 70%; margin-top: 8px"></div>
        <div class="snoop-skeleton-line" style="width: 90%; margin-top: 6px"></div>
        <div class="snoop-skeleton-line snoop-skeleton-line--short" style="width: 20%; margin-top: 8px"></div>
      </div>
    </template>

    <!-- Error -->
    <div v-else-if="error" class="snoop-empty">
      <i class="ph ph-warning-circle text-[32px] text-gray-300"></i>
      <div class="text-[13px] text-gray-400 mt-2">{{ error }}</div>
      <button class="snoop-retry-btn" @click="$emit('retry')">重试</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!items?.length" class="snoop-empty">
      <i class="ph ph-chats-circle text-[32px] text-gray-300"></i>
      <div class="text-[13px] text-gray-400 mt-2">暂无发言</div>
    </div>

    <!-- Content -->
    <template v-else>
      <div
        v-for="(item, idx) in items"
        :key="idx"
        class="snoop-forum-card"
      >
        <div class="snoop-forum-header">
          <span class="snoop-forum-platform">{{ item.platform || '论坛' }}</span>
          <span class="snoop-forum-type" :class="item.type === 'reply' ? 'snoop-forum-type--reply' : ''">
            {{ item.type === 'reply' ? '回帖' : '发帖' }}
          </span>
        </div>
        <div class="snoop-forum-title" v-if="item.title">{{ item.title }}</div>
        <div class="snoop-forum-content">{{ item.content || '' }}</div>
        <div class="snoop-forum-footer">
          <span class="snoop-forum-likes">
            <i class="ph ph-heart text-[12px]"></i>
            {{ item.likes ?? 0 }}
          </span>
          <span class="snoop-forum-time">{{ item.time || '' }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  contact: Object,
  items: Array,
  loading: Boolean,
  error: String
})
defineEmits(['retry'])
</script>

<style scoped>
.snoop-tab-content {
  padding: 8px 16px;
}

.snoop-forum-card {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
}

.dark .snoop-forum-card {
  background: rgba(255, 255, 255, 0.06);
}

.snoop-forum-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.snoop-forum-platform {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color, #007aff);
  background: rgba(0, 122, 255, 0.08);
  padding: 2px 8px;
  border-radius: 4px;
}

.snoop-forum-type {
  font-size: 11px;
  color: #34c759;
  background: rgba(52, 199, 89, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
}

.snoop-forum-type--reply {
  color: #ff9500;
  background: rgba(255, 149, 0, 0.08);
}

.snoop-forum-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  line-height: 1.3;
}

.snoop-forum-content {
  font-size: 13px;
  color: #636366;
  line-height: 1.5;
  word-break: break-word;
}

.dark .snoop-forum-content {
  color: #aeaeb2;
}

.snoop-forum-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 0.5px solid rgba(0, 0, 0, 0.04);
}

.dark .snoop-forum-footer {
  border-top-color: rgba(255, 255, 255, 0.04);
}

.snoop-forum-likes {
  font-size: 12px;
  color: #8e8e93;
  display: flex;
  align-items: center;
  gap: 4px;
}

.snoop-forum-time {
  font-size: 11px;
  color: #8e8e93;
}

/* Skeleton */
.snoop-forum-skeleton {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 8px;
}

.dark .snoop-forum-skeleton {
  background: rgba(255, 255, 255, 0.06);
}

.snoop-skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
  animation: snoop-pulse 1.5s infinite;
}

.snoop-skeleton-line--short { height: 10px; }

.dark .snoop-skeleton-line {
  background: rgba(255, 255, 255, 0.06);
}

@keyframes snoop-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Shared */
.snoop-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.snoop-retry-btn {
  margin-top: 12px;
  padding: 6px 20px;
  border-radius: 8px;
  font-size: 13px;
  border: none;
  background: var(--primary-color, #007aff);
  color: #fff;
  cursor: pointer;
}

.snoop-retry-btn:active { opacity: 0.7; }
</style>
