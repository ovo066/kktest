<template>
  <Teleport to="body">
    <transition name="viewer-fade">
      <div v-if="photo" class="album-viewer" @click.self="$emit('close')">
        <!-- Blurred background -->
        <div class="viewer-bg" :style="{ backgroundImage: `url(${photo.url})` }"></div>

        <!-- Top bar -->
        <div class="viewer-top">
          <button class="viewer-btn" @click="$emit('close')">
            <i class="ph-bold ph-caret-left"></i>
          </button>
          <div class="viewer-top-center">
            <div class="viewer-name">{{ photo.contactName || '相册' }}</div>
            <div class="viewer-time">{{ timeText }}</div>
          </div>
          <button class="viewer-btn" :class="{ 'is-fav': photo.isFavorite }" @click="$emit('toggleFavorite', photo.id)">
            <i :class="photo.isFavorite ? 'ph-fill ph-heart' : 'ph ph-heart'"></i>
          </button>
        </div>

        <!-- Image -->
        <div
          class="viewer-image-wrap"
          @touchstart="onTouchStart"
          @touchend="onTouchEnd"
        >
          <img :src="photo.url" alt="" class="viewer-image" />
        </div>

        <!-- Bottom bar -->
        <div class="viewer-bottom">
          <button class="viewer-bottom-btn" @click="downloadPhoto">
            <i class="ph ph-download-simple"></i>
            <span>保存</span>
          </button>
          <button class="viewer-bottom-btn" @click="$emit('toggleFavorite', photo.id)">
            <i :class="photo.isFavorite ? 'ph-fill ph-heart' : 'ph ph-heart'"></i>
            <span>{{ photo.isFavorite ? '已收藏' : '收藏' }}</span>
          </button>
          <button class="viewer-bottom-btn viewer-bottom-btn-danger" @click="$emit('delete', photo.id)">
            <i class="ph ph-trash"></i>
            <span>删除</span>
          </button>
        </div>

        <!-- Prompt pill (if exists) -->
        <div v-if="photo.prompt" class="viewer-prompt-pill">
          <i class="ph ph-sparkle"></i>
          {{ photo.prompt }}
        </div>

        <!-- Nav hints -->
        <button v-if="hasPrev" class="viewer-nav viewer-nav-prev" @click="$emit('prev')">
          <i class="ph-bold ph-caret-left"></i>
        </button>
        <button v-if="hasNext" class="viewer-nav viewer-nav-next" @click="$emit('next')">
          <i class="ph-bold ph-caret-right"></i>
        </button>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  photo: { type: Object, default: null },
  hasPrev: { type: Boolean, default: false },
  hasNext: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'toggleFavorite', 'delete', 'prev', 'next'])

const timeText = computed(() => {
  if (!props.photo?.createdAt) return ''
  const d = new Date(props.photo.createdAt)
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${m}月${day}日 ${h}:${min}`
})

function downloadPhoto() {
  if (!props.photo?.url) return
  const a = document.createElement('a')
  a.href = props.photo.url
  a.download = `photo_${props.photo.id}.png`
  a.click()
}

const touchStartX = ref(0)
function onTouchStart(e) {
  if (e.touches.length === 1) touchStartX.value = e.touches[0].clientX
}
function onTouchEnd(e) {
  if (e.changedTouches.length !== 1) return
  const diff = e.changedTouches[0].clientX - touchStartX.value
  if (Math.abs(diff) > 60) {
    if (diff > 0 && props.hasPrev) emit('prev')
    else if (diff < 0 && props.hasNext) emit('next')
  }
}
</script>

<style scoped>
.album-viewer {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  background: #000;
}

.viewer-bg {
  position: absolute;
  inset: -60px;
  background-size: cover;
  background-position: center;
  filter: blur(80px) saturate(1.2);
  transform: scale(1.5);
  opacity: 0.35;
  pointer-events: none;
}

/* Top bar */
.viewer-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  padding-top: max(env(safe-area-inset-top, 8px), 8px);
}

.viewer-top-center {
  flex: 1;
  text-align: center;
  min-width: 0;
}

.viewer-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-time {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  font-variant-numeric: tabular-nums;
}

/* Bottom bar */
.viewer-bottom {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 10px 16px;
  padding-bottom: max(env(safe-area-inset-bottom, 10px), 10px);
}

.viewer-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.1);
  color: #fff;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.viewer-btn:active {
  background: rgba(255,255,255,0.2);
}

.viewer-btn.is-fav {
  color: #ff4d6a;
}

.viewer-bottom-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.8);
  font-size: 20px;
  cursor: pointer;
  padding: 6px 16px;
  border-radius: 10px;
  transition: background 120ms;
}

.viewer-bottom-btn span {
  font-size: 10px;
  font-weight: 500;
}

.viewer-bottom-btn:active {
  background: rgba(255,255,255,0.1);
}

.viewer-bottom-btn-danger {
  color: rgba(255,80,80,0.85);
}

/* Prompt pill */
.viewer-prompt-pill {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  max-width: 80%;
  padding: 5px 12px;
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Image area */
.viewer-image-wrap {
  flex: 1;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  overflow: hidden;
}

.viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

/* Nav */
.viewer-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  width: 32px;
  height: 54px;
  border: none;
  border-radius: 6px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.5);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.viewer-nav:active {
  background: rgba(255,255,255,0.15);
}

.viewer-nav-prev { left: 4px; }
.viewer-nav-next { right: 4px; }

/* Transition */
.viewer-fade-enter-active,
.viewer-fade-leave-active {
  transition: opacity 200ms ease;
}
.viewer-fade-enter-from,
.viewer-fade-leave-to {
  opacity: 0;
}
</style>
