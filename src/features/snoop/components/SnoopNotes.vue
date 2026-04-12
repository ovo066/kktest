<template>
  <div class="snoop-tab-content">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div v-for="i in 5" :key="i" class="snoop-note-skeleton">
        <div class="snoop-skeleton-line" style="width: 40%"></div>
        <div class="snoop-skeleton-line" style="width: 80%; margin-top: 8px"></div>
        <div class="snoop-skeleton-line snoop-skeleton-line--short" style="width: 25%; margin-top: 6px"></div>
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
      <i class="ph ph-note-pencil text-[32px] text-gray-300"></i>
      <div class="text-[13px] text-gray-400 mt-2">暂无便签</div>
    </div>

    <!-- Content -->
    <template v-else>
      <div
        v-for="(item, idx) in sortedItems"
        :key="idx"
        class="snoop-note-card"
        @click="toggleExpand(idx)"
      >
        <div class="snoop-note-header">
          <div class="snoop-note-title">
            <i v-if="item.pinned" class="ph-fill ph-push-pin text-[12px] text-orange-400 mr-1"></i>
            {{ item.title || '无标题' }}
          </div>
          <div class="snoop-note-time">{{ item.time || '' }}</div>
        </div>
        <div
          class="snoop-note-content"
          :class="{ 'snoop-note-content--expanded': expandedIdx === idx }"
        >
          {{ item.content || '' }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  contact: Object,
  items: Array,
  loading: Boolean,
  error: String
})
defineEmits(['retry'])

const expandedIdx = ref(null)

const sortedItems = computed(() => {
  if (!props.items) return []
  return [...props.items].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
})

function toggleExpand(idx) {
  expandedIdx.value = expandedIdx.value === idx ? null : idx
}
</script>

<style scoped>
.snoop-tab-content {
  padding: 8px 16px;
}

.snoop-note-card {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.dark .snoop-note-card {
  background: rgba(255, 255, 255, 0.06);
}

.snoop-note-card:active {
  background: rgba(0, 0, 0, 0.04);
}

.dark .snoop-note-card:active {
  background: rgba(255, 255, 255, 0.1);
}

.snoop-note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.snoop-note-title {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
}

.snoop-note-time {
  font-size: 11px;
  color: #8e8e93;
  flex-shrink: 0;
}

.snoop-note-content {
  font-size: 13px;
  color: #8e8e93;
  line-height: 1.5;
  margin-top: 6px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: pre-wrap;
}

.snoop-note-content--expanded {
  -webkit-line-clamp: unset;
}

/* Skeleton */
.snoop-note-skeleton {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 8px;
}

.dark .snoop-note-skeleton {
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
