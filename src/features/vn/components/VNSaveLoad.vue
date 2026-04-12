<template>
  <Transition name="vn-panel" appear>
    <div class="vn-panel-overlay" @click.stop>
      <div class="vn-panel-bar">
        <h2 class="vn-panel-title">存档管理</h2>
        <button class="vn-panel-close" @click.stop="emit('close')">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <!-- New save -->
      <div class="vn-save-new">
        <div class="vn-save-input-row">
          <input
            v-model="slotName"
            type="text"
            class="vn-save-input"
            placeholder="存档名称（可选）"
            @keydown.enter="saveNow"
          >
          <button class="vn-save-btn" @click.stop="saveNow">
            <i class="ph ph-floppy-disk"></i> 保存
          </button>
        </div>
      </div>

      <div class="vn-panel-scroll">
        <div v-if="saves.length === 0" class="vn-panel-empty">
          <i class="ph ph-archive text-4xl mb-3 opacity-30"></i>
          <div>还没有任何存档</div>
        </div>

        <div v-for="s in saves" :key="s.id" class="vn-save-card">
          <div class="vn-save-info">
            <div class="vn-save-name">{{ s.name }}</div>
            <div class="vn-save-time">{{ formatTime(s.timestamp) }}</div>
          </div>
          <div class="vn-save-actions">
            <button class="vn-save-action load" @click.stop="loadNow(s.id)">
              <i class="ph ph-play-fill"></i>
            </button>
            <button class="vn-save-action delete" @click.stop="deleteSave(s.id)">
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
import { useVNStore } from '../../../stores/vn'
import { useStorage } from '../../../composables/useStorage'
import { formatBeijingLocale } from '../../../utils/beijingTime'

const emit = defineEmits(['close'])
const vnStore = useVNStore()
const { scheduleSave } = useStorage()
const slotName = ref('')

const saves = computed(() => {
  const list = vnStore.currentProject?.saves || []
  return Array.isArray(list) ? [...list].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) : []
})

function saveNow() {
  vnStore.saveGame(slotName.value)
  slotName.value = ''
  scheduleSave()
}

function loadNow(saveId) {
  vnStore.loadGame(saveId)
  scheduleSave()
  emit('close')
}

function deleteSave(saveId) {
  const p = vnStore.currentProject
  if (!p || !Array.isArray(p.saves)) return
  const idx = p.saves.findIndex(x => x.id === saveId)
  if (idx !== -1) p.saves.splice(idx, 1)
  scheduleSave()
}

function formatTime(ts) {
  if (!ts) return ''
  try { return formatBeijingLocale(new Date(ts)) }
  catch { return String(ts) }
}
</script>

<style scoped>
.vn-panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: rgba(8, 8, 20, 0.8);
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
  font-size: 20px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 0.04em;
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

.vn-save-new {
  padding: 12px 20px;
}

.vn-save-input-row {
  display: flex;
  gap: 10px;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 6px 6px 6px 16px;
}

.vn-save-input {
  flex: 1;
  background: transparent;
  outline: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.vn-save-input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.vn-save-btn {
  padding: 10px 18px;
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.8);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: transform 0.15s;
}

.vn-save-btn:active {
  transform: scale(0.96);
}

.vn-panel-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px 24px;
}

.vn-panel-scroll::-webkit-scrollbar { display: none; }

.vn-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 14px;
  margin-top: 60px;
}

.vn-save-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  margin-bottom: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
}

.vn-save-info { min-width: 0; }

.vn-save-name {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vn-save-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  margin-top: 4px;
}

.vn-save-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.vn-save-action {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.vn-save-action:active {
  transform: scale(0.92);
}

.vn-save-action.load {
  background: rgba(99, 102, 241, 0.2);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: rgba(129, 140, 248, 0.9);
}

.vn-save-action.delete {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.15);
  color: rgba(248, 113, 113, 0.7);
}

/* Panel transition */
.vn-panel-enter-active { transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1); }
.vn-panel-leave-active { transition: all 0.25s ease; }
.vn-panel-enter-from { opacity: 0; transform: translateY(40px); }
.vn-panel-leave-to { opacity: 0; }
</style>
