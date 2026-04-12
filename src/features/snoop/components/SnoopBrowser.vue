<template>
  <div class="snoop-tab-content">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div v-for="i in 8" :key="i" class="snoop-skeleton-item">
        <div class="snoop-skeleton-icon"></div>
        <div class="snoop-skeleton-lines">
          <div class="snoop-skeleton-line" :style="{ width: 60 + Math.random() * 30 + '%' }"></div>
          <div class="snoop-skeleton-line snoop-skeleton-line--short" :style="{ width: 30 + Math.random() * 20 + '%' }"></div>
        </div>
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
      <i class="ph ph-globe-simple text-[32px] text-gray-300"></i>
      <div class="text-[13px] text-gray-400 mt-2">暂无记录</div>
    </div>

    <!-- Content -->
    <template v-else>
      <div
        v-for="(item, idx) in items"
        :key="idx"
        class="snoop-browser-item"
      >
        <div class="snoop-browser-icon">
          <i :class="item.type === 'search' ? 'ph ph-magnifying-glass' : 'ph ph-globe-simple'" class="text-[16px]"></i>
        </div>
        <div class="snoop-browser-info">
          <div class="snoop-browser-title">{{ item.title || item.content || '' }}</div>
          <div class="snoop-browser-url" v-if="item.url">{{ item.url }}</div>
        </div>
        <div class="snoop-browser-time">{{ item.time || '' }}</div>
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

.snoop-browser-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

.dark .snoop-browser-item {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.snoop-browser-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #8e8e93;
}

.dark .snoop-browser-icon {
  background: rgba(255, 255, 255, 0.06);
}

.snoop-browser-info {
  flex: 1;
  min-width: 0;
}

.snoop-browser-title {
  font-size: 14px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snoop-browser-url {
  font-size: 12px;
  color: #8e8e93;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.snoop-browser-time {
  font-size: 11px;
  color: #8e8e93;
  flex-shrink: 0;
  white-space: nowrap;
}

/* Shared styles */
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

/* Skeleton */
.snoop-skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}

.snoop-skeleton-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.06);
  animation: snoop-pulse 1.5s infinite;
}

.dark .snoop-skeleton-icon {
  background: rgba(255, 255, 255, 0.06);
}

.snoop-skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.snoop-skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
  animation: snoop-pulse 1.5s infinite;
}

.snoop-skeleton-line--short {
  height: 10px;
}

.dark .snoop-skeleton-line {
  background: rgba(255, 255, 255, 0.06);
}

@keyframes snoop-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
