<template>
  <Transition name="panel-fade" appear>
    <div class="meet-panel-overlay" @click.stop>
      <div class="meet-panel-header">
        <h2 class="meet-panel-title">时光碎片</h2>
        <button class="meet-close-btn" @click.stop="emit('close')">
          关闭
        </button>
      </div>

      <div class="meet-save-actions-bar">
        <div class="new-save-input">
          <input
            v-model="slotName"
            type="text"
            placeholder="为这段回忆命名..."
            @keydown.enter="saveNow"
          >
          <button @click.stop="saveNow">
            <i class="ph ph-plus-circle"></i>
            保存进度
          </button>
        </div>
      </div>

      <div class="meet-save-grid">
        <div v-if="saves.length === 0" class="meet-empty-state">
          <i class="ph ph-archive-box"></i>
          <span>未发现存档记录</span>
        </div>

        <div v-for="s in saves" :key="s.id" class="save-card">
          <div class="save-info">
            <div class="save-name">{{ s.name || '未命名存档' }}</div>
            <div class="save-meta">{{ formatTime(s.timestamp) }}</div>
          </div>
          <div class="save-buttons">
            <button class="btn-load" @click.stop="loadNow(s.id)">
              <i class="ph-fill ph-play"></i>
            </button>
            <button class="btn-delete" @click.stop="deleteSave(s.id)">
              <i class="ph ph-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useMeetStore } from '../../../stores/meet'
import { useStorage } from '../../../composables/useStorage'
import { formatBeijingLocale } from '../../../utils/beijingTime'

const emit = defineEmits(['close'])
const meetStore = useMeetStore()
const { scheduleSave } = useStorage()
const slotName = ref('')

const saves = computed(() => {
  const list = meetStore.currentMeeting?.saves || []
  return Array.isArray(list) ? [...list].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) : []
})

function saveNow() {
  meetStore.saveGame(slotName.value)
  slotName.value = ''
  scheduleSave()
}

function loadNow(saveId) {
  meetStore.loadGame(saveId)
  scheduleSave()
  emit('close')
}

function deleteSave(saveId) {
  const m = meetStore.currentMeeting
  if (!m || !Array.isArray(m.saves)) return
  const idx = m.saves.findIndex(x => x.id === saveId)
  if (idx !== -1) m.saves.splice(idx, 1)
  scheduleSave()
}

function formatTime(ts) {
  if (!ts) return ''
  return formatBeijingLocale(new Date(ts), {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<style scoped>
.meet-panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: rgba(20, 20, 20, 0.95);
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.meet-panel-header {
  padding: var(--app-pt-lg, 52px) 24px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #333;
}

.meet-panel-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 6px;
}

.meet-close-btn {
  background: #000;
  border: 2px solid #444;
  color: #fff;
  padding: 8px 14px;
  font-size: 13px;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 3px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.meet-close-btn:hover { background: #333; }
.meet-close-btn:active { background: #444; }

.meet-save-actions-bar {
  padding: 16px 24px;
}

.new-save-input {
  display: flex;
  gap: 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid #444;
  padding: 6px 6px 6px 16px;
}

.new-save-input input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 0.95rem;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 1px;
}

.new-save-input input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.new-save-input button {
  padding: 0 18px;
  height: 38px;
  background: #000;
  border: 1px solid #555;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.new-save-input button:hover { background: #333; }
.new-save-input button:active { transform: scale(0.96); }

.meet-save-grid {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meet-save-grid::-webkit-scrollbar { display: none; }

.meet-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 60px;
  color: rgba(255, 255, 255, 0.2);
  gap: 16px;
  letter-spacing: 4px;
}

.meet-empty-state i { font-size: 48px; }

.save-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.save-info {
  min-width: 0;
}

.save-name {
  font-size: 1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 1px;
}

.save-meta {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 1px;
}

.save-buttons {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.save-buttons button {
  width: 40px;
  height: 40px;
  border: 1px solid #444;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #fff;
}

.btn-load {
  border-color: #666;
  font-size: 18px;
}

.btn-delete {
  color: rgba(255, 255, 255, 0.4);
  font-size: 16px;
}

.btn-load:hover, .btn-delete:hover { background: #333; }
.btn-load:active, .btn-delete:active { transform: scale(0.9); }

.panel-fade-enter-active { transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-fade-leave-active { transition: all 0.3s ease; }
.panel-fade-enter-from { opacity: 0; transform: scale(1.05); }
.panel-fade-leave-to { opacity: 0; }
</style>
