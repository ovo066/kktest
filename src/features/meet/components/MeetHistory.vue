<template>
  <Transition name="panel-fade" appear>
    <div class="meet-panel-overlay" @click.stop>
      <div class="meet-panel-header">
        <h2 class="meet-panel-title">历史回溯</h2>
        <button class="meet-close-btn" @click.stop="emit('close')">
          关闭
        </button>
      </div>

      <div class="meet-history-list">
        <div v-if="history.length === 0" class="meet-empty-state">
          <i class="ph ph-wind"></i>
          <span>暂无记忆记录</span>
        </div>

        <div
          v-for="(h, idx) in history"
          :key="h.timestamp || idx"
          class="meet-history-entry"
        >
          <template v-if="h.type === 'dialog'">
            <div class="entry-name" :style="{ color: h.nameColor }">
              {{ h.vnName }}
            </div>
            <div class="entry-text">{{ h.text }}</div>
          </template>
          <template v-else-if="h.type === 'user'">
            <div class="entry-name user">你</div>
            <div class="entry-text">{{ h.text }}</div>
          </template>
          <template v-else-if="h.type === 'narration'">
            <div class="entry-narration">{{ h.text }}</div>
          </template>
          <template v-else>
            <div class="entry-event-title">{{ formatType(h.type) }}</div>
            <div class="entry-event-text">{{ formatEvent(h) }}</div>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useMeetStore } from '../../../stores/meet'

const emit = defineEmits(['close'])
const meetStore = useMeetStore()

const history = computed(() => {
  const list = meetStore.currentMeeting?.history || []
  return Array.isArray(list) ? list : []
})

function formatType(type) {
  switch (type) {
    case 'bg': return '背景'
    case 'cg': return 'CG'
    case 'bgm': return 'BGM'
    case 'sfx': return '音效'
    case 'sprite': return '角色立绘'
    case 'choices': return '选项'
    case 'location': return '地点'
    case 'time': return '时间'
    case 'mood': return '好感度'
    case 'variable': return '变量'
    default: return type || '事件'
  }
}

function formatEvent(entry) {
  if (!entry || typeof entry !== 'object') return ''
  switch (entry.type) {
    case 'bg':
      return `切换到「${entry.name || '未命名背景'}」`
    case 'cg':
      if (entry.off || !entry.name) return '关闭 CG'
      return `展示 CG「${entry.name}」${entry.isNew ? '（新生成）' : ''}`
    case 'bgm':
      return entry.name ? `播放「${entry.name}」` : '停止播放'
    case 'sfx':
      return entry.name ? `触发「${entry.name}」` : '停止音效'
    case 'location':
      return entry.value || ''
    case 'time':
      return entry.value || ''
    case 'mood': {
      const value = Number(entry.value)
      const delta = Number.isFinite(value) && entry.operation === 'add'
        ? `${value >= 0 ? '+' : ''}${value}`
        : String(entry.value ?? '')
      return `${entry.characterName || '角色'} ${entry.operation === 'add' ? '变化' : '设为'} ${delta}`
    }
    case 'variable': {
      const value = entry.value
      const delta = entry.operation === 'add' && Number.isFinite(Number(value))
        ? `${Number(value) >= 0 ? '+' : ''}${Number(value)}`
        : String(value ?? '')
      return `${entry.key || 'var'} ${entry.operation === 'add' ? '变化' : '设为'} ${delta}`
    }
    case 'sprite':
      if (entry.position === 'none') return `${entry.vnName || entry.characterId || '角色'} 退场`
      return `${entry.vnName || entry.characterId || '角色'} · ${entry.position || 'center'} · ${entry.expression || 'normal'}`
    case 'choices': {
      const options = Array.isArray(entry.options) ? entry.options : []
      if (options.length === 0) return '等待选择'
      return options.map(opt => opt?.text).filter(Boolean).join(' / ')
    }
    default:
      return entry.text || ''
  }
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

.meet-history-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.meet-history-list::-webkit-scrollbar { width: 3px; }
.meet-history-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }

.meet-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 100px;
  color: rgba(255, 255, 255, 0.2);
  gap: 16px;
  letter-spacing: 4px;
}

.meet-empty-state i { font-size: 48px; }

.meet-history-entry {
  padding: 20px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.meet-history-entry:last-child {
  border-bottom: none;
}

.entry-name {
  font-size: 0.82rem;
  font-weight: 700;
  margin-bottom: 8px;
  letter-spacing: 3px;
  color: rgba(255, 255, 255, 0.6);
}

.entry-name.user {
  color: rgba(174, 214, 255, 0.9);
}

.entry-text {
  font-size: 1.05rem;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.85);
  white-space: pre-wrap;
  word-break: break-word;
  letter-spacing: 0.02em;
}

.entry-narration {
  font-size: 1.05rem;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
  padding-left: 20px;
  border-left: 2px solid #555;
  white-space: pre-wrap;
  word-break: break-word;
  letter-spacing: 0.02em;
}

.entry-event-title {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 2px;
  margin-bottom: 6px;
}

.entry-event-text {
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.78);
  white-space: pre-wrap;
  word-break: break-word;
}

.panel-fade-enter-active { transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
.panel-fade-leave-active { transition: all 0.3s ease; }
.panel-fade-enter-from { opacity: 0; transform: scale(1.05); }
.panel-fade-leave-to { opacity: 0; }
</style>
