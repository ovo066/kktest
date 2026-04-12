<template>
  <Transition name="vn-panel" appear>
    <div class="vn-panel-overlay" @click.stop>
      <div class="vn-panel-bar">
        <h2 class="vn-panel-title">回放</h2>
        <button class="vn-panel-close" @click.stop="emit('close')">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <div class="vn-panel-scroll">
        <div v-if="history.length === 0" class="vn-panel-empty">
          <i class="ph ph-ghost text-4xl mb-3 opacity-30"></i>
          <div>暂无对话记录</div>
        </div>

        <div
          v-for="(h, idx) in history"
          :key="h.timestamp || idx"
          class="vn-history-item"
        >
          <template v-if="h.type === 'dialog'">
            <div class="vn-hist-name" :style="{ color: h.nameColor || 'rgba(255,255,255,0.55)' }">
              {{ h.vnName || '角色' }}
            </div>
            <div class="vn-hist-text">{{ h.text }}</div>
          </template>
          <template v-else-if="h.type === 'narration'">
            <div class="vn-hist-narration">{{ h.text }}</div>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useVNStore } from '../../../stores/vn'

const emit = defineEmits(['close'])
const vnStore = useVNStore()

const history = computed(() => {
  const list = vnStore.currentProject?.history || []
  return Array.isArray(list) ? list : []
})
</script>

<style scoped>
.vn-panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: rgba(8, 8, 20, 0.75);
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
}

.vn-panel-bar {
  padding: var(--app-pt-lg, 52px) 20px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.vn-panel-title {
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 20px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 0.08em;
}

.vn-panel-close {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.vn-panel-close:active {
  background: rgba(255, 255, 255, 0.15);
}

.vn-panel-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px 24px;
}

.vn-panel-scroll::-webkit-scrollbar { display: none; }

.vn-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 14px;
  margin-top: 80px;
}

.vn-history-item {
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.vn-history-item:last-child {
  border-bottom: none;
}

.vn-hist-name {
  font-size: 11px;
  font-weight: 800;
  margin-bottom: 6px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.vn-hist-text {
  font-size: 15px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.85);
  white-space: pre-wrap;
  word-break: break-word;
}

.vn-hist-narration {
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 15px;
  line-height: 1.85;
  color: rgba(255, 255, 255, 0.55);
  font-style: italic;
  white-space: pre-wrap;
  word-break: break-word;
  padding-left: 16px;
  border-left: 2px solid rgba(99, 102, 241, 0.4);
}

/* Panel transition */
.vn-panel-enter-active { transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1); }
.vn-panel-leave-active { transition: all 0.25s ease; }
.vn-panel-enter-from { opacity: 0; transform: translateY(40px); }
.vn-panel-leave-to { opacity: 0; }
</style>
