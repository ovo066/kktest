<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="visible" class="fixed inset-0 z-[900] flex flex-col justify-end">
        <div class="preset-backdrop" @click="$emit('close')"></div>
        <div class="preset-sheet" :class="{ 'has-detail': !!settingsPreset }">
          <div class="sheet-handle"></div>
          <div class="sheet-header">
            <span class="sheet-title">预设管理</span>
            <div class="sheet-header-actions">
              <label class="header-link">
                导入
                <input type="file" accept=".json" class="hidden" @change="handleImport" />
              </label>
              <button class="header-link" @click="$emit('create')">新建</button>
              <button class="close-btn" @click="$emit('close')">
                <i class="ph ph-x text-xl"></i>
              </button>
            </div>
          </div>

          <div class="sheet-body">
            <div
              v-for="preset in presets"
              :key="preset.id"
              class="preset-card"
              :class="{ active: preset.id === activePresetId }"
            >
              <div
                class="preset-head"
                @click="handleBannerClick(preset.id)"
              >
                <button class="preset-select" @click.stop="handleSelectPreset(preset.id)">
                  <i v-if="preset.id === activePresetId" class="ph-fill ph-check-circle"></i>
                  <i v-else class="ph ph-circle"></i>
                </button>

                <div class="preset-main">
                  <div class="preset-title-row">
                    <span class="preset-name">{{ preset.name || '未命名预设' }}</span>
                    <span v-if="preset.source === 'sillytavern'" class="st-badge">ST</span>
                    <span v-if="(preset.regexRules || []).length" class="regex-badge">
                      正则 {{ (preset.regexRules || []).length }}
                    </span>
                  </div>
                  <div class="preset-meta">
                    <span>{{ (preset.promptEntries || []).length }} 条目</span>
                    <span>Temp {{ formatDecimal(preset.temperature, 0.8) }}</span>
                    <span>MaxTok {{ formatMaxTokens(preset.maxTokens) }}</span>
                    <span>TopP {{ formatDecimal(preset.topP, 1) }}</span>
                  </div>
                  <div class="preset-hint">
                    单击展开条目，双击展开参数编辑
                  </div>
                </div>

                <button class="icon-btn" @click.stop="handleEntryToggleClick(preset.id)">
                  <i class="ph ph-list-bullets"></i>
                </button>
                <button class="icon-btn" @click.stop="toggleSettingsSection(preset.id)">
                  <i class="ph ph-sliders-horizontal"></i>
                </button>
                <button class="icon-btn danger" @click.stop="handleDeletePreset(preset.id)">
                  <i class="ph ph-trash"></i>
                </button>
              </div>

              <Transition name="expand">
                <div v-if="isEntryExpanded(preset.id)" class="preset-expand">
                  <div class="entry-section">
                    <div class="entry-header">
                      <div>
                        <div class="entry-title">Prompt 条目</div>
                        <div class="entry-subtitle">
                          已启用 {{ enabledEntryCount(preset) }}/{{ (preset.promptEntries || []).length }} 条
                        </div>
                      </div>
                      <button class="entry-add-btn" @click="$emit('add-entry', preset.id)">
                        <i class="ph ph-plus"></i>
                        添加条目
                      </button>
                    </div>

                    <div v-if="!(preset.promptEntries || []).length" class="entry-empty">
                      暂无条目，可手动添加或导入 SillyTavern 预设。
                    </div>

                    <div v-else class="entry-list">
                      <PresetEntryItem
                        v-for="(entry, idx) in sortedEntries(preset)"
                        :key="entry.id"
                        :entry="entry"
                        :index="idx"
                        @toggle="$emit('toggle-entry', preset.id, entry.id)"
                        @delete="$emit('delete-entry', preset.id, entry.id)"
                        @update-field="patch => $emit('update-entry', preset.id, entry.id, patch)"
                      />
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <div v-if="presets.length === 0" class="empty-hint">
              <p>暂无预设</p>
              <p class="empty-sub">支持导入 SillyTavern 预设，并自动识别同包正则。</p>
            </div>
          </div>

          <Transition name="slide-detail">
            <div v-if="settingsPreset" class="detail-overlay">
              <div class="detail-header">
                <div class="detail-title-group">
                  <div class="detail-eyebrow">预设参数</div>
                  <div class="detail-title">{{ settingsPreset.name || '未命名预设' }}</div>
                </div>
                <button class="detail-close-btn" @click="closeSettingsSection">
                  <i class="ph ph-x"></i>
                </button>
              </div>

              <div class="detail-body">
                <div class="preset-grid">
                  <div class="preset-field preset-field-wide">
                    <label class="field-label">名称</label>
                    <input
                      :value="settingsPreset.name"
                      class="field-input"
                      placeholder="预设名称"
                      @change="emitPresetUpdate(settingsPreset.id, 'name', $event.target.value)"
                    >
                  </div>

                  <div class="preset-field">
                    <label class="field-label">Temperature</label>
                    <input
                      :value="settingsPreset.temperature ?? 0.8"
                      type="number"
                      class="field-input"
                      step="0.1"
                      min="0"
                      max="2"
                      @change="emitPresetNumberUpdate(settingsPreset.id, 'temperature', $event.target.value, 0.8)"
                    >
                  </div>

                  <div class="preset-field">
                    <label class="field-label">Max Tokens</label>
                    <input
                      :value="settingsPreset.maxTokens ?? ''"
                      type="number"
                      class="field-input"
                      step="1"
                      min="1"
                      max="65535"
                      placeholder="留空使用默认"
                      @change="emitPresetUpdate(settingsPreset.id, 'maxTokens', $event.target.value)"
                    >
                  </div>

                  <div class="preset-field">
                    <label class="field-label">Top P</label>
                    <input
                      :value="settingsPreset.topP ?? 1"
                      type="number"
                      class="field-input"
                      step="0.05"
                      min="0"
                      max="1"
                      @change="emitPresetNumberUpdate(settingsPreset.id, 'topP', $event.target.value, 1)"
                    >
                  </div>

                  <div class="preset-field">
                    <label class="field-label">Freq Penalty</label>
                    <input
                      :value="settingsPreset.frequencyPenalty ?? 0"
                      type="number"
                      class="field-input"
                      step="0.1"
                      min="-2"
                      max="2"
                      @change="emitPresetNumberUpdate(settingsPreset.id, 'frequencyPenalty', $event.target.value, 0)"
                    >
                  </div>

                  <div class="preset-field">
                    <label class="field-label">Presence Penalty</label>
                    <input
                      :value="settingsPreset.presencePenalty ?? 0"
                      type="number"
                      class="field-input"
                      step="0.1"
                      min="-2"
                      max="2"
                      @change="emitPresetNumberUpdate(settingsPreset.id, 'presencePenalty', $event.target.value, 0)"
                    >
                  </div>
                </div>

                <div class="preset-field">
                  <label class="field-label">系统提示词</label>
                  <textarea
                    :value="settingsPreset.systemPrompt"
                    class="field-textarea"
                    rows="5"
                    placeholder="System prompt..."
                    @change="emitPresetUpdate(settingsPreset.id, 'systemPrompt', $event.target.value)"
                  ></textarea>
                </div>

                <div class="preset-field">
                  <label class="field-label">越狱提示词</label>
                  <textarea
                    :value="settingsPreset.jailbreakPrompt"
                    class="field-textarea"
                    rows="4"
                    placeholder="Jailbreak prompt..."
                    @change="emitPresetUpdate(settingsPreset.id, 'jailbreakPrompt', $event.target.value)"
                  ></textarea>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PresetEntryItem from './PresetEntryItem.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  presets: { type: Array, default: () => [] },
  activePresetId: { type: String, default: null }
})

const emit = defineEmits([
  'close',
  'select',
  'create',
  'delete',
  'import',
  'update-preset',
  'add-entry',
  'delete-entry',
  'toggle-entry',
  'update-entry'
])

const expandedEntryPresetId = ref(null)
const expandedSettingsPresetId = ref(null)
let lastBannerPresetId = null
let lastBannerClickAt = 0

const settingsPreset = computed(() => {
  const targetId = expandedSettingsPresetId.value
  if (!targetId) return null
  return (props.presets || []).find(preset => preset.id === targetId) || null
})

function resetBannerClickState() {
  lastBannerPresetId = null
  lastBannerClickAt = 0
}

function normalizeExpandedState() {
  const validIds = new Set((props.presets || []).map(preset => preset.id))
  if (expandedEntryPresetId.value && !validIds.has(expandedEntryPresetId.value)) {
    expandedEntryPresetId.value = null
  }
  if (expandedSettingsPresetId.value && !validIds.has(expandedSettingsPresetId.value)) {
    expandedSettingsPresetId.value = null
  }
  if (props.activePresetId && validIds.has(props.activePresetId) && !expandedEntryPresetId.value) {
    expandedEntryPresetId.value = props.activePresetId
  }
}

function isEntryExpanded(id) {
  return expandedEntryPresetId.value === id
}

function isSettingsExpanded(id) {
  return expandedSettingsPresetId.value === id
}

function toggleEntrySection(id) {
  emit('select', id)
  if (expandedEntryPresetId.value === id) {
    expandedEntryPresetId.value = null
  } else {
    expandedEntryPresetId.value = id
  }
}

function toggleSettingsSection(id) {
  emit('select', id)
  if (expandedSettingsPresetId.value === id) {
    expandedSettingsPresetId.value = null
  } else {
    expandedSettingsPresetId.value = id
  }
}

function expandEntrySection(id) {
  emit('select', id)
  expandedEntryPresetId.value = id
}

function handleBannerClick(id) {
  const now = Date.now()
  const isSamePreset = lastBannerPresetId === id
  const isRapidRepeat = now - lastBannerClickAt <= 280

  lastBannerPresetId = id
  lastBannerClickAt = now

  if (isSamePreset && isRapidRepeat) {
    toggleSettingsSection(id)
    resetBannerClickState()
    return
  }

  expandEntrySection(id)
}

function handleSelectPreset(id) {
  resetBannerClickState()
  emit('select', id)
}

function handleEntryToggleClick(id) {
  resetBannerClickState()
  toggleEntrySection(id)
}

function handleDeletePreset(id) {
  resetBannerClickState()
  emit('delete', id)
}

function closeSettingsSection() {
  resetBannerClickState()
  expandedSettingsPresetId.value = null
}

function sortedEntries(preset) {
  return [...(preset.promptEntries || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
}

function enabledEntryCount(preset) {
  return (preset.promptEntries || []).filter(entry => entry.enabled !== false).length
}

function formatDecimal(value, fallback) {
  const numeric = Number(value)
  const next = Number.isFinite(numeric) ? numeric : fallback
  return Number(next).toFixed(2).replace(/\.00$/, '')
}

function formatMaxTokens(value) {
  return value == null || value === '' ? '默认' : String(value)
}

function emitPresetUpdate(presetId, key, value) {
  emit('update-preset', presetId, { [key]: value })
}

function emitPresetNumberUpdate(presetId, key, value, fallback = 0) {
  const parsed = Number(value)
  emit('update-preset', presetId, {
    [key]: Number.isFinite(parsed) ? parsed : fallback
  })
}

function handleImport(event) {
  const file = event.target?.files?.[0]
  if (!file) return
  emit('import', file)
  event.target.value = ''
}

watch(() => props.visible, (visible) => {
  if (visible) {
    normalizeExpandedState()
  } else {
    resetBannerClickState()
  }
})

watch(() => props.activePresetId, () => {
  normalizeExpandedState()
})

watch(() => props.presets, () => {
  normalizeExpandedState()
}, { deep: true, immediate: true })
</script>

<style scoped>
.preset-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.preset-sheet {
  position: relative;
  background: #fff;
  border-top: var(--off-border-w, 2px) solid var(--off-border, #111);
  border-radius: 16px 16px 0 0;
  min-height: 52vh;
  max-height: 88vh;
  z-index: 10;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  touch-action: pan-y;
  padding: 0 20px calc(24px + env(safe-area-inset-bottom, 0px));
}

.preset-sheet.has-detail {
  overflow: hidden;
}

.sheet-handle {
  width: 42px;
  height: 5px;
  margin: 10px auto 0;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.16);
  flex-shrink: 0;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 5;
  margin: 0 -20px 16px;
  padding: 14px 20px;
  border-bottom: var(--off-border-w, 2px) solid var(--off-border, #111);
  background: #fff;
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
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
}

.close-btn {
  background: none;
  border: none;
  color: var(--off-text-sec, #888);
  cursor: pointer;
}

.hidden { display: none; }

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preset-card {
  border: var(--off-border-w, 2px) solid var(--off-border, #111);
  border-radius: var(--off-radius, 14px);
  box-shadow: var(--off-shadow-sm, 2px 2px 0 #111);
  background: #fff;
  overflow: hidden;
}

.preset-card.active {
  border-color: var(--off-accent, #111);
  background: #f9f9f9;
}

.preset-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  cursor: pointer;
}

.preset-select {
  width: 26px;
  height: 26px;
  border: none;
  background: none;
  color: var(--off-accent, #111);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.preset-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.preset-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.preset-name {
  min-width: 0;
  max-width: 100%;
  font-size: 15px;
  font-weight: 800;
  color: var(--off-text, #111);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--off-text-sec, #777);
}

.preset-hint {
  font-size: 10px;
  color: var(--off-text-sec, #8b8b8b);
}

.st-badge,
.regex-badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 700;
}

.st-badge {
  background: #e8d5f5;
  color: #7c3aed;
}

.regex-badge {
  background: #dcfce7;
  color: #15803d;
}

.icon-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 17, 17, 0.04);
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 10px;
  color: var(--off-text-sec, #888);
  cursor: pointer;
}

.icon-btn.danger {
  color: var(--off-danger, #d32f2f);
}

.preset-expand {
  border-top: 1px solid rgba(17, 17, 17, 0.08);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(17, 17, 17, 0.02);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.preset-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preset-field-wide {
  grid-column: 1 / -1;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--off-text-sec, #888);
}

.field-input,
.field-textarea {
  width: 100%;
  background: #fff;
  color: var(--off-text, #111);
  border: 1px solid rgba(17, 17, 17, 0.16);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  outline: none;
  font-family: inherit;
}

.field-textarea {
  min-height: 100px;
  resize: vertical;
  line-height: 1.6;
}

.entry-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.entry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.entry-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--off-text, #111);
}

.entry-subtitle {
  margin-top: 2px;
  font-size: 11px;
  color: var(--off-text-sec, #777);
}

.entry-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 10px;
  border: 1px solid rgba(17, 17, 17, 0.16);
  background: #fff;
  color: var(--off-text, #111);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entry-empty {
  padding: 14px;
  text-align: center;
  color: var(--off-text-sec, #888);
  font-size: 12px;
  border: 1px dashed rgba(17, 17, 17, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
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
  opacity: 0.7;
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: opacity 0.3s ease;
}

.slide-up-enter-active .preset-sheet, .slide-up-leave-active .preset-sheet {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from { opacity: 0; }
.slide-up-enter-from .preset-sheet { transform: translateY(100%); }
.slide-up-leave-to { opacity: 0; }
.slide-up-leave-to .preset-sheet { transform: translateY(100%); }

.expand-enter-active, .expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from, .expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to, .expand-leave-from {
  max-height: 3000px;
  opacity: 1;
}

.detail-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px 14px;
  border-bottom: var(--off-border-w, 2px) solid var(--off-border, #111);
  flex-shrink: 0;
}

.detail-title-group {
  min-width: 0;
}

.detail-eyebrow {
  font-size: 11px;
  font-weight: 700;
  color: var(--off-text-sec, #777);
}

.detail-title {
  margin-top: 2px;
  font-size: 16px;
  font-weight: 800;
  color: var(--off-text, #111);
}

.detail-close-btn {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 10px;
  background: rgba(17, 17, 17, 0.04);
  color: var(--off-text-sec, #888);
  cursor: pointer;
}

.detail-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  touch-action: pan-y;
  padding: 16px 20px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(17, 17, 17, 0.02);
}

.slide-detail-enter-active,
.slide-detail-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.slide-detail-enter-from,
.slide-detail-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

@media (max-width: 640px) {
  .preset-grid {
    grid-template-columns: 1fr;
  }

  .entry-header {
    align-items: stretch;
    flex-direction: column;
  }

  .entry-add-btn {
    justify-content: center;
  }
}
</style>
