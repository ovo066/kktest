<template>
  <Transition name="menu-sheet">
    <div v-if="visible" class="meet-menu-backdrop" @click.stop="emit('close')">
      <div class="meet-menu-container" @click.stop>
        <div class="menu-handle"></div>
        <div class="menu-grid">
          <button class="menu-action" @click.stop="emit('open-save')">
            <i class="ph ph-archive"></i> 存档读档
          </button>
          <button class="menu-action" @click.stop="emit('open-history')">
            <i class="ph ph-clock-counter-clockwise"></i> 历史回溯
          </button>
          <button class="menu-action" @click.stop="emit('toggle-auto-play')">
            <i :class="isAutoPlay ? 'ph-fill ph-pause' : 'ph-fill ph-play'"></i>
            {{ isAutoPlay ? '停止播放' : '自动播放' }}
          </button>
          <button class="menu-action" @click.stop="emit('toggle-tts')">
            <i :class="isTtsEnabled ? 'ph-fill ph-speaker-high' : 'ph ph-speaker-slash'"></i>
            {{ isTtsEnabled ? '关闭朗读' : '开启朗读' }}
          </button>
          <button class="menu-action" @click.stop="emit('restart')">
            <i class="ph ph-arrow-counter-clockwise"></i> 重新开始
          </button>
          <button class="menu-action" @click.stop="emit('show-mood-details')">
            <i class="ph ph-heart"></i> 好感度
          </button>
          <button class="menu-action danger" @click.stop="emit('leave')">
            <i class="ph ph-door-open"></i> 离开约会
          </button>
        </div>
        <button class="menu-close-btn" @click.stop="emit('close')">返回约会</button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  isAutoPlay: { type: Boolean, default: false },
  isTtsEnabled: { type: Boolean, default: false }
})

const emit = defineEmits([
  'close',
  'leave',
  'open-history',
  'open-save',
  'restart',
  'show-mood-details',
  'toggle-auto-play',
  'toggle-tts'
])
</script>

<style scoped>
.meet-menu-backdrop {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.meet-menu-container {
  width: 100%;
  max-width: 500px;
  background: rgba(20, 20, 20, 0.95);
  border: 2px solid #333;
  border-bottom: none;
  padding: 12px 24px 40px;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
}

.menu-handle {
  width: 40px;
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 auto 24px;
}

.menu-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.menu-action {
  height: 80px;
  background: #000;
  border: 2px solid #333;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.menu-action i {
  font-size: 22px;
  opacity: 0.7;
}

.menu-action:hover {
  background: #222;
}

.menu-action:active {
  background: #333;
  transform: scale(0.96);
}

.menu-action.danger {
  color: #ccc;
  border-color: #555;
}

.menu-close-btn {
  width: 100%;
  height: 50px;
  background: transparent;
  border: 2px solid #444;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 700;
  font-size: 0.95rem;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.menu-close-btn:hover {
  border-color: #666;
  color: #fff;
}

.menu-close-btn:active {
  transform: scale(0.98);
}

.menu-sheet-enter-active {
  transition: opacity 0.3s;
}

.menu-sheet-leave-active {
  transition: opacity 0.2s;
}

.menu-sheet-enter-from,
.menu-sheet-leave-to {
  opacity: 0;
}

.menu-sheet-enter-active .meet-menu-container {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.menu-sheet-leave-active .meet-menu-container {
  transition: transform 0.3s ease-in;
}

.menu-sheet-enter-from .meet-menu-container,
.menu-sheet-leave-to .meet-menu-container {
  transform: translateY(100%);
}
</style>
