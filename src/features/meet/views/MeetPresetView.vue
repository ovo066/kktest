<template>
  <div class="meet-page">
    <!-- Header -->
    <div class="meet-page-header">
      <button class="meet-back-btn" @click="router.push('/meet')">
        <i class="ph ph-caret-left"></i>
      </button>
      <span class="meet-page-title">预设管理</span>
      <div class="meet-header-actions">
        <button class="meet-action-btn" @click="showImport = true">
          <i class="ph ph-download-simple"></i>
        </button>
        <button class="meet-action-btn primary" @click="onCreate">
          <i class="ph ph-plus"></i>
        </button>
      </div>
    </div>

    <!-- Preset List -->
    <div class="meet-page-body">
      <div v-if="presets.length === 0" class="meet-empty">
        <i class="ph ph-clipboard-text" style="font-size:48px"></i>
        <p>还没有预设</p>
      </div>

      <div v-else class="preset-list">
        <MeetPresetCard
          v-for="p in presets"
          :key="p.id"
          :preset="p"
          @edit="onEdit"
          @delete="onDelete"
          @select="onEdit"
        />
      </div>
    </div>

    <!-- Edit Panel -->
    <Transition name="meet-slide">
      <div v-if="editing" class="meet-edit-panel">
        <div class="edit-panel-header">
          <span class="edit-panel-title">{{ editing.id ? '编辑预设' : '新建预设' }}</span>
          <button class="edit-close-btn" @click="editing = null">
            <i class="ph ph-x"></i>
          </button>
        </div>
        <div class="edit-panel-body">
          <label class="edit-label">名称</label>
          <input v-model="editing.name" class="edit-input" placeholder="预设名称">

          <label class="edit-label">系统提示词</label>
          <textarea v-model="editing.systemPrompt" class="edit-textarea" rows="6" placeholder="System prompt..."></textarea>

          <label class="edit-label">越狱提示词</label>
          <textarea v-model="editing.jailbreakPrompt" class="edit-textarea" rows="4" placeholder="Jailbreak prompt..."></textarea>

          <div class="entry-section">
            <div class="entry-section-header">
              <label class="edit-label">预设条目（Prompt Entries）</label>
              <button class="entry-add-btn" @click="addPromptEntry">
                <i class="ph ph-plus"></i> 添加条目
              </button>
            </div>
            <p class="entry-summary">
              已启用 {{ enabledPromptEntries }}/{{ totalPromptEntries }} 条
            </p>

            <div v-if="totalPromptEntries === 0" class="entry-empty">
              暂无条目，可手动添加或从 SillyTavern 导入。
            </div>

            <div
              v-for="(entry, idx) in editing.promptEntries"
              :key="entry.id || idx"
              class="entry-card"
            >
              <div class="entry-card-top">
                <label class="entry-enabled">
                  <input v-model="entry.enabled" type="checkbox">
                  启用
                </label>
                <input v-model="entry.name" class="edit-input entry-name-input" placeholder="条目名称">
                <button class="entry-remove-btn" @click="removePromptEntry(idx)">
                  <i class="ph ph-trash"></i>
                </button>
              </div>

              <div class="edit-row compact">
                <div class="edit-field">
                  <label class="edit-label">Identifier</label>
                  <input v-model="entry.identifier" class="edit-input" placeholder="main">
                </div>
                <div class="edit-field">
                  <label class="edit-label">Role</label>
                  <select v-model="entry.role" class="edit-input">
                    <option value="system">system</option>
                    <option value="user">user</option>
                    <option value="assistant">assistant</option>
                  </select>
                </div>
                <div class="edit-field">
                  <label class="edit-label">Depth</label>
                  <input v-model.number="entry.injectionDepth" type="number" class="edit-input" step="1" min="-50" max="50">
                </div>
              </div>

              <textarea
                v-model="entry.content"
                class="edit-textarea entry-content"
                rows="4"
                placeholder="条目内容..."
              ></textarea>
            </div>
          </div>

          <div class="edit-row">
            <div class="edit-field">
              <label class="edit-label">Temperature</label>
              <input v-model.number="editing.temperature" type="number" step="0.1" min="0" max="2" class="edit-input">
            </div>
            <div class="edit-field">
              <label class="edit-label">Max Tokens</label>
              <input v-model.number="editing.maxTokens" type="number" step="100" min="1" class="edit-input" placeholder="留空不限制">
            </div>
          </div>

          <div class="edit-row">
            <div class="edit-field">
              <label class="edit-label">Top P</label>
              <input v-model.number="editing.topP" type="number" step="0.05" min="0" max="1" class="edit-input">
            </div>
            <div class="edit-field">
              <label class="edit-label">Freq Penalty</label>
              <input v-model.number="editing.frequencyPenalty" type="number" step="0.1" min="0" max="2" class="edit-input">
            </div>
          </div>

          <button class="edit-save-btn" @click="onSave">保存</button>
        </div>
      </div>
    </Transition>

    <!-- Import Modal -->
    <MeetPresetImport
      :show="showImport"
      @close="showImport = false"
      @imported="onImported"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMeetPresets } from '../composables/useMeetPresets'
import MeetPresetCard from '../components/MeetPresetCard.vue'
import MeetPresetImport from '../components/MeetPresetImport.vue'

const router = useRouter()
const { presets, createPreset, updatePreset, deletePreset, importSTPreset } = useMeetPresets()

const editing = ref(null)
const showImport = ref(false)
const totalPromptEntries = computed(() =>
  Array.isArray(editing.value?.promptEntries) ? editing.value.promptEntries.length : 0
)
const enabledPromptEntries = computed(() =>
  Array.isArray(editing.value?.promptEntries)
    ? editing.value.promptEntries.filter(entry => entry?.enabled !== false).length
    : 0
)

function createPromptEntry(index = 0) {
  const entryId = `entry_${Date.now()}_${index + 1}`
  return {
    id: entryId,
    identifier: entryId,
    name: `条目 ${index + 1}`,
    role: 'system',
    content: '',
    enabled: true,
    injectionDepth: 0,
    injectionPosition: 'in_chat',
    order: index
  }
}

function clonePreset(preset) {
  if (!preset) return null
  const next = JSON.parse(JSON.stringify(preset))
  if (!Array.isArray(next.promptEntries)) next.promptEntries = []
  return next
}

function onCreate() {
  editing.value = {
    id: null,
    name: '',
    systemPrompt: '',
    jailbreakPrompt: '',
    temperature: 0.8,
    maxTokens: null,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    promptEntries: []
  }
}

function onEdit(preset) {
  editing.value = clonePreset(preset)
}

function onDelete(preset) {
  if (confirm(`确定删除预设「${preset.name}」？`)) {
    deletePreset(preset.id)
  }
}

function addPromptEntry() {
  if (!editing.value) return
  if (!Array.isArray(editing.value.promptEntries)) editing.value.promptEntries = []
  editing.value.promptEntries.push(createPromptEntry(editing.value.promptEntries.length))
}

function removePromptEntry(index) {
  if (!editing.value || !Array.isArray(editing.value.promptEntries)) return
  editing.value.promptEntries.splice(index, 1)
}

function onSave() {
  if (!editing.value) return
  const normalizedEntries = Array.isArray(editing.value.promptEntries)
    ? editing.value.promptEntries.map((entry, idx) => ({
      ...entry,
      id: entry.id || `entry_${idx + 1}`,
      identifier: String(entry.identifier || entry.id || entry.name || `entry_${idx + 1}`),
      name: String(entry.name || entry.identifier || `条目 ${idx + 1}`),
      role: ['system', 'user', 'assistant'].includes(String(entry.role || '').toLowerCase())
        ? String(entry.role).toLowerCase()
        : 'system',
      enabled: entry.enabled !== false,
      injectionDepth: Number.isFinite(Number(entry.injectionDepth)) ? Number(entry.injectionDepth) : 0,
      injectionPosition: String(entry.injectionPosition || 'in_chat'),
      order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : idx
    }))
    : []

  const payload = {
    ...editing.value,
    promptEntries: normalizedEntries
  }
  if (editing.value.id) {
    const { id, ...patch } = payload
    updatePreset(id, patch)
  } else {
    createPreset(payload)
  }
  editing.value = null
}

function onImported(jsonData) {
  const imported = importSTPreset(jsonData)
  if (imported.length === 0) return
  if (imported.length === 1) {
    editing.value = clonePreset(imported[0])
  }
  showImport.value = false
}
</script>

<style scoped>
.meet-page {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: #1a1a1a;
  color: rgba(255, 255, 255, 0.92);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.meet-page-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: var(--app-pt, 12px) 20px 14px;
  border-bottom: 2px solid #333;
}

.meet-back-btn {
  background: #000;
  border: 2px solid #444;
  color: #fff;
  padding: 8px 14px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.meet-back-btn:hover { background: #333; }
.meet-back-btn:active { background: #444; }

.meet-page-title {
  flex: 1;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 4px;
}

.meet-header-actions {
  display: flex;
  gap: 10px;
}

.meet-action-btn {
  background: #000;
  border: 2px solid #444;
  color: #fff;
  padding: 8px 14px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.meet-action-btn.primary {
  border-color: #666;
}

.meet-action-btn:hover { background: #333; }
.meet-action-btn:active { background: #444; }

.meet-page-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.meet-page-body::-webkit-scrollbar { display: none; }

.meet-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 80px 0;
  color: rgba(255, 255, 255, 0.2);
  font-weight: 700;
  letter-spacing: 4px;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Edit Panel */
.meet-edit-panel {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.edit-panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--app-pt, 12px) 20px 14px;
  border-bottom: 2px solid #333;
}

.edit-panel-title {
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 4px;
}

.edit-close-btn {
  background: #000;
  border: 2px solid #444;
  color: #fff;
  padding: 8px 14px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-close-btn:hover { background: #333; }
.edit-close-btn:active { background: #444; }

.edit-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 20px 60px;
}

.edit-panel-body::-webkit-scrollbar { display: none; }

.edit-label {
  display: block;
  font-weight: 700;
  font-size: 0.85rem;
  margin-bottom: 8px;
  margin-top: 20px;
  letter-spacing: 3px;
  color: rgba(255, 255, 255, 0.5);
}

.edit-label:first-child { margin-top: 0; }

.edit-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #333;
  background: rgba(0, 0, 0, 0.4);
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.9);
  outline: none;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 1px;
}

.edit-input:focus { border-color: #666; }

.edit-textarea {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #333;
  background: rgba(0, 0, 0, 0.4);
  font-size: 0.85rem;
  font-family: monospace;
  resize: vertical;
  color: rgba(255, 255, 255, 0.9);
  outline: none;
}

.edit-textarea:focus { border-color: #666; }

.entry-section {
  margin-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 16px;
}

.entry-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.entry-section-header .edit-label {
  margin: 0;
}

.entry-summary {
  margin: 8px 0 14px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.35);
}

.entry-add-btn {
  height: 34px;
  border: 1px solid #555;
  background: #000;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.8rem;
  letter-spacing: 1px;
  padding: 0 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.entry-add-btn:hover {
  background: #333;
}

.entry-empty {
  padding: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.82rem;
}

.entry-card {
  margin-top: 10px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
}

.entry-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.entry-enabled {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.78);
  white-space: nowrap;
}

.entry-name-input {
  flex: 1;
  min-width: 0;
}

.entry-remove-btn {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(200, 100, 100, 0.35);
  background: rgba(200, 100, 100, 0.08);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  flex-shrink: 0;
}

.entry-remove-btn:hover {
  background: rgba(200, 100, 100, 0.2);
}

.edit-row {
  display: flex;
  gap: 14px;
  margin-top: 20px;
}

.edit-row.compact {
  margin-top: 12px;
}

.edit-field {
  flex: 1;
}

.edit-field .edit-label { margin-top: 0; }

.entry-content {
  margin-top: 12px;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.edit-save-btn {
  margin-top: 32px;
  width: 100%;
  padding: 16px;
  background: #000;
  color: #fff;
  border: 2px solid #555;
  font-weight: 700;
  font-size: 1rem;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-save-btn:hover { background: #333; border-color: #777; }
.edit-save-btn:active { transform: scale(0.98); }

/* Slide transition */
.meet-slide-enter-active { transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.meet-slide-leave-active { transition: transform 0.25s ease-in; }
.meet-slide-enter-from { transform: translateX(100%); }
.meet-slide-leave-to { transform: translateX(100%); }
</style>
