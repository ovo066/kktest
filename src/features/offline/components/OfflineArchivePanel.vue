<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="visible" class="fixed inset-0 z-[900] flex flex-col justify-end">
        <div class="archive-backdrop" @click="$emit('close')"></div>
        <div class="archive-sheet">
          <div class="sheet-header">
            <span class="sheet-title">存档读档</span>
            <div class="sheet-header-actions">
              <button class="header-link" @click="createSnapshot">保存当前</button>
              <button class="header-link" @click="createEmptyBranch">新开分支</button>
              <button class="close-btn" @click="$emit('close')">
                <i class="ph ph-x text-xl"></i>
              </button>
            </div>
          </div>

          <div class="sheet-body">
            <div
              v-for="snapshot in snapshots"
              :key="snapshot.id"
              class="archive-card"
            >
              <div class="archive-row">
                <div class="archive-main">
                  <div class="archive-name">{{ snapshot.name || '未命名存档' }}</div>
                  <div class="archive-meta">
                    <span>{{ formatTime(snapshot.savedAt) }}</span>
                    <span>消息 {{ Number(snapshot.messageCount) || 0 }}</span>
                    <span>会话 {{ Number(snapshot.sessionCount) || 0 }}</span>
                  </div>
                </div>
                <div class="archive-actions">
                  <button class="mini-btn" @click="$emit('load', snapshot.id)">读档</button>
                  <button class="mini-btn" @click="renameSnapshot(snapshot)">重命名</button>
                  <button class="mini-btn danger" @click="$emit('delete', snapshot.id)">删除</button>
                </div>
              </div>
            </div>

            <div v-if="snapshots.length === 0" class="empty-hint">
              <p>暂无存档</p>
              <p class="empty-sub">可先“保存当前”，也可直接“新开分支”</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { formatBeijingLocale } from '../../../utils/beijingTime'

defineProps({
  visible: { type: Boolean, default: false },
  snapshots: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'save', 'new-branch', 'load', 'delete', 'rename'])

function formatTime(ts) {
  const t = Number(ts)
  if (!Number.isFinite(t) || t <= 0) return '未知时间'
  try {
    return formatBeijingLocale(new Date(t), {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '未知时间'
  }
}

function renameSnapshot(snapshot) {
  if (!snapshot) return
  const current = String(snapshot.name || '').trim()
  const nextName = window.prompt('重命名存档', current || '线下分支')
  if (typeof nextName !== 'string') return
  const trimmed = nextName.trim()
  if (!trimmed || trimmed === current) return
  emit('rename', snapshot.id, trimmed)
}

function buildDefaultName() {
  const now = new Date()
  const stamp = formatBeijingLocale(now, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  return `线下分支 ${stamp}`
}

function createSnapshot() {
  const defaultName = buildDefaultName()
  const input = window.prompt('保存当前到存档', defaultName)
  if (typeof input !== 'string') return
  const name = input.trim() || defaultName
  emit('save', name)
}

function createEmptyBranch() {
  const defaultName = buildDefaultName().replace('线下分支', '新分支')
  const input = window.prompt('新开分支名称', defaultName)
  if (typeof input !== 'string') return
  const name = input.trim() || defaultName
  emit('new-branch', name)
}
</script>

<style scoped>
.archive-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.archive-sheet {
  position: relative;
  background: #fff;
  border-top: var(--off-border-w, 2px) solid var(--off-border, #111);
  border-radius: 16px 16px 0 0;
  min-height: 45vh;
  max-height: 76vh;
  display: flex;
  flex-direction: column;
  z-index: 10;
  overflow: hidden;
  min-height: 0;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: var(--off-border-w, 2px) solid var(--off-border, #111);
}

.sheet-title {
  font-weight: 800;
  font-size: 17px;
  color: var(--off-text, #111);
}

.sheet-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-link {
  font-size: 14px;
  font-weight: 700;
  color: var(--off-accent, #111);
  background: none;
  border: none;
  cursor: pointer;
}

.close-btn {
  background: none;
  border: none;
  color: var(--off-text-sec, #888);
  cursor: pointer;
}

.sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  touch-action: pan-y;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.archive-card {
  border: var(--off-border-w, 2px) solid var(--off-border, #111);
  border-radius: var(--off-radius, 14px);
  box-shadow: var(--off-shadow-sm, 2px 2px 0 #111);
  background: #fff;
}

.archive-row {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.archive-main {
  min-width: 0;
  flex: 1;
}

.archive-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--off-text, #111);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archive-meta {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--off-text-sec, #888);
}

.archive-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.mini-btn {
  padding: 6px 10px;
  border: var(--off-border-w, 2px) solid var(--off-border, #111);
  border-radius: 8px;
  background: #fff;
  color: var(--off-text, #111);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.mini-btn.danger {
  color: var(--off-danger, #d32f2f);
  border-color: var(--off-danger, #d32f2f);
}

.empty-hint {
  text-align: center;
  padding: 32px 0;
  color: var(--off-text-sec, #888);
  font-size: 14px;
}

.empty-sub {
  font-size: 12px;
  margin-top: 4px;
  opacity: 0.6;
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: opacity 0.3s ease;
}
.slide-up-enter-active .archive-sheet, .slide-up-leave-active .archive-sheet {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from .archive-sheet, .slide-up-leave-to .archive-sheet {
  transform: translateY(100%);
}
.slide-up-enter-from, .slide-up-leave-to {
  opacity: 0;
}
</style>
