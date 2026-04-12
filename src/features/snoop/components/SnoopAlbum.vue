<template>
  <div class="snoop-tab-content">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div class="snoop-album-grid">
        <div v-for="i in 9" :key="i" class="snoop-album-skeleton"></div>
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
      <i class="ph ph-images text-[32px] text-gray-300"></i>
      <div class="text-[13px] text-gray-400 mt-2">暂无照片</div>
    </div>

    <!-- Content -->
    <template v-else>
      <div class="snoop-album-grid">
        <div
          v-for="(item, idx) in items"
          :key="idx"
          class="snoop-album-cell"
          @click="selectedIdx = selectedIdx === idx ? null : idx"
        >
          <div class="snoop-album-icon">
            <i :class="tagIcon(item.tag)" class="text-[24px]"></i>
          </div>
          <div class="snoop-album-tag">{{ item.tag || '照片' }}</div>
        </div>
      </div>

      <!-- Detail overlay -->
      <Transition name="snoop-detail">
        <div v-if="selectedIdx !== null && items[selectedIdx]" class="snoop-album-detail" @click="selectedIdx = null">
          <div class="snoop-album-detail-card" @click.stop>
            <div class="snoop-album-detail-icon">
              <i :class="tagIcon(items[selectedIdx].tag)" class="text-[40px]"></i>
            </div>
            <div class="snoop-album-detail-desc">{{ items[selectedIdx].desc }}</div>
            <div class="snoop-album-detail-meta">
              <span>{{ items[selectedIdx].tag }}</span>
              <span>{{ items[selectedIdx].time }}</span>
            </div>
            <button class="snoop-album-close" @click="selectedIdx = null">
              <i class="ph ph-x text-[18px]"></i>
            </button>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  contact: Object,
  items: Array,
  loading: Boolean,
  error: String
})
defineEmits(['retry'])

const selectedIdx = ref(null)

const TAG_ICONS = {
  '自拍': 'ph ph-smiley',
  '风景': 'ph ph-mountains',
  '美食': 'ph ph-fork-knife',
  '截图': 'ph ph-device-mobile',
  '合照': 'ph ph-users-three',
  '其他': 'ph ph-image'
}

function tagIcon(tag) {
  return TAG_ICONS[tag] || 'ph ph-image'
}
</script>

<style scoped>
.snoop-tab-content {
  padding: 8px 12px;
}

.snoop-album-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.snoop-album-cell {
  aspect-ratio: 1;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: background 0.15s;
  color: #8e8e93;
}

.dark .snoop-album-cell {
  background: rgba(255, 255, 255, 0.06);
}

.snoop-album-cell:active {
  background: rgba(0, 0, 0, 0.1);
}

.dark .snoop-album-cell:active {
  background: rgba(255, 255, 255, 0.12);
}

.snoop-album-icon {
  opacity: 0.6;
}

.snoop-album-tag {
  font-size: 10px;
}

/* Detail overlay */
.snoop-album-detail {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.snoop-album-detail-card {
  width: 280px;
  max-width: 85vw;
  background: var(--card-bg, #fff);
  border-radius: 16px;
  padding: 24px 20px;
  position: relative;
  text-align: center;
}

.dark .snoop-album-detail-card {
  background: var(--card-bg, #1c1c1e);
}

.snoop-album-detail-icon {
  color: #8e8e93;
  margin-bottom: 16px;
}

.snoop-album-detail-desc {
  font-size: 14px;
  line-height: 1.6;
  text-align: left;
}

.snoop-album-detail-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8e8e93;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 0.5px solid rgba(0, 0, 0, 0.06);
}

.dark .snoop-album-detail-meta {
  border-top-color: rgba(255, 255, 255, 0.06);
}

.snoop-album-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #8e8e93;
}

.dark .snoop-album-close {
  background: rgba(255, 255, 255, 0.1);
}

/* Skeleton */
.snoop-album-skeleton {
  aspect-ratio: 1;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
  animation: snoop-pulse 1.5s infinite;
}

.dark .snoop-album-skeleton {
  background: rgba(255, 255, 255, 0.06);
}

@keyframes snoop-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Transitions */
.snoop-detail-enter-active,
.snoop-detail-leave-active {
  transition: opacity 0.2s ease;
}

.snoop-detail-enter-from,
.snoop-detail-leave-to {
  opacity: 0;
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
