<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="visible" class="fixed inset-0 z-[900] flex flex-col justify-end">
        <div class="regex-backdrop" @click="$emit('close')"></div>
        <div class="regex-sheet" :class="{ 'has-detail': !!draftRule }">
          <div class="sheet-handle"></div>
          <div class="sheet-header">
            <span class="sheet-title">正则规则</span>
            <button class="close-btn" @click="$emit('close')">
              <i class="ph ph-x text-xl"></i>
            </button>
          </div>

          <div class="sheet-body">
            <section
              v-for="section in sections"
              :key="section.key"
              class="scope-section"
            >
              <div class="scope-header" @click="toggleSection(section.key)">
                <div class="scope-header-main">
                  <div class="scope-title">{{ section.title }}</div>
                  <div class="scope-subtitle">{{ section.subtitle }}</div>
                </div>
                <div class="scope-actions">
                  <span class="scope-count">{{ section.rules.length }}</span>
                  <label class="section-link" :class="{ disabled: section.disabled }" @click.stop>
                    导入
                    <input
                      type="file"
                      accept=".json"
                      class="hidden"
                      :disabled="section.disabled"
                      @click.stop
                      @change="event => handleImportFile(section.key, event)"
                    >
                  </label>
                  <button
                    class="section-link"
                    :disabled="section.disabled"
                    @click.stop="$emit('add', section.key)"
                  >
                    添加
                  </button>
                  <button class="fold-btn" :class="{ open: isSectionOpen(section.key) }" @click.stop="toggleSection(section.key)">
                    <i class="ph ph-caret-down"></i>
                  </button>
                </div>
              </div>

              <div v-if="section.disabled" class="empty-hint">
                <p>{{ section.disabledHint }}</p>
              </div>

              <template v-else-if="isSectionOpen(section.key)">
                <RegexRuleItem
                  v-for="rule in section.rules"
                  :key="rule.id"
                  :rule="rule"
                  @toggle="$emit('toggle', section.key, rule.id)"
                  @edit="$emit('edit', section.key, rule.id)"
                  @delete="$emit('delete', section.key, rule.id)"
                />

                <div v-if="section.rules.length === 0" class="empty-hint">
                  <p>暂无规则</p>
                  <p class="empty-sub">{{ section.emptyHint }}</p>
                </div>
              </template>

              <div v-else class="collapsed-hint">
                点击展开 {{ section.title }}
              </div>
            </section>
          </div>

          <Transition name="slide-detail">
            <div v-if="draftRule" class="editor-overlay">
              <div class="editor-header">
                <div class="edit-title-main">
                  <div class="edit-title">编辑规则</div>
                  <span class="target-badge">{{ scopeName }}</span>
                </div>
                <button class="edit-close-btn" @click="$emit('cancel-edit')">
                  <i class="ph ph-x"></i>
                </button>
              </div>

              <div class="editor-body">
                <div class="edit-field">
                  <label class="edit-label">名称</label>
                  <input v-model="draftRule.name" class="edit-input" placeholder="例如：隐藏旁白标签">
                </div>

                <div class="edit-row">
                  <div class="edit-field flex-1">
                    <label class="edit-label">正则表达式</label>
                    <input v-model="draftRule.pattern" class="edit-input font-mono" placeholder="\\[旁白\\]">
                  </div>
                  <div class="edit-field small-field">
                    <label class="edit-label">标志</label>
                    <input v-model="draftRule.flags" class="edit-input font-mono" placeholder="gi">
                  </div>
                </div>

                <div class="edit-row">
                  <div class="edit-field flex-1">
                    <label class="edit-label">替换为</label>
                    <input v-model="draftRule.replacement" class="edit-input font-mono" placeholder="留空表示删除匹配内容">
                  </div>
                  <div class="edit-field small-field">
                    <label class="edit-label">排序</label>
                    <input v-model.number="draftRule.order" type="number" class="edit-input" step="1" min="-9999" max="9999">
                  </div>
                </div>

                <div class="edit-field">
                  <label class="edit-label">作用域</label>
                  <div class="scope-btns">
                    <button
                      v-for="scope in ['display', 'prompt', 'both']"
                      :key="scope"
                      class="scope-btn"
                      :class="{ active: draftRule.scope === scope }"
                      @click="draftRule.scope = scope"
                    >
                      {{ scopeLabels[scope] }}
                    </button>
                  </div>
                </div>

                <div v-if="previewResult !== null" class="edit-field">
                  <label class="edit-label">预览</label>
                  <div class="preview-box" v-html="previewResult"></div>
                </div>

                <div class="edit-actions">
                  <button class="modal-btn modal-btn-primary" @click="handleSaveEdit">保存</button>
                  <button class="modal-btn modal-btn-secondary" @click="$emit('cancel-edit')">取消</button>
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
import RegexRuleItem from './RegexRuleItem.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  globalRules: { type: Array, default: () => [] },
  presetRules: { type: Array, default: () => [] },
  characterRules: { type: Array, default: () => [] },
  presetName: { type: String, default: '' },
  characterName: { type: String, default: '' },
  editingRule: { type: Object, default: null },
  editingScope: { type: String, default: 'global' }
})

const emit = defineEmits(['close', 'add', 'toggle', 'edit', 'delete', 'save-edit', 'cancel-edit', 'import'])

const scopeLabels = { display: '显示', prompt: '发送', both: '两者' }
const bindingLabels = {
  global: '全局正则',
  preset: '预设正则',
  character: '角色正则'
}

const draftRule = ref(null)
const draftScope = ref('global')
const sectionState = ref({
  global: false,
  preset: false,
  character: false
})

watch(
  () => [props.editingRule, props.editingScope],
  ([rule, scope]) => {
    draftRule.value = rule ? { ...rule } : null
    draftScope.value = scope || 'global'
  },
  { immediate: true }
)

const sections = computed(() => [
  {
    key: 'global',
    title: '全局正则',
    subtitle: '始终参与离线模式显示和发送处理',
    rules: props.globalRules || [],
    disabled: false,
    disabledHint: '',
    emptyHint: '适合放通用替换、隐藏标签、统一格式修正。'
  },
  {
    key: 'preset',
    title: props.presetName ? `预设正则 · ${props.presetName}` : '预设正则',
    subtitle: '只在当前激活预设下生效，适合与导入预设一起绑定',
    rules: props.presetRules || [],
    disabled: !props.presetName,
    disabledHint: '先在预设面板选择一个预设，才能管理预设正则。',
    emptyHint: '可导入与当前预设配套的 SillyTavern 正则脚本。'
  },
  {
    key: 'character',
    title: props.characterName ? `角色正则 · ${props.characterName}` : '角色正则',
    subtitle: '只对当前角色的离线会话生效',
    rules: props.characterRules || [],
    disabled: false,
    disabledHint: '',
    emptyHint: '适合角色口癖修正、角色专属标签清理等规则。'
  }
])

const scopeName = computed(() => bindingLabels[draftScope.value] || bindingLabels.global)

function resetSections() {
  sectionState.value = {
    global: false,
    preset: false,
    character: false
  }
}

function isSectionOpen(key) {
  return !!sectionState.value[key]
}

function toggleSection(key) {
  if (!key) return
  sectionState.value = {
    ...sectionState.value,
    [key]: !sectionState.value[key]
  }
}

const previewResult = computed(() => {
  const rule = draftRule.value
  if (!rule || !rule.pattern) return null
  try {
    const re = new RegExp(rule.pattern, rule.flags || 'g')
    const sample = '这是一段示例文字，包含角色名、动作标签和格式占位。'
    return sample.replace(re, rule.replacement || '')
  } catch {
    return '<span style="color:var(--off-danger)">正则表达式无效</span>'
  }
})

function handleImportFile(scope, event) {
  const file = event.target?.files?.[0]
  if (!file) return
  emit('import', scope, file)
  event.target.value = ''
}

function handleSaveEdit() {
  if (!draftRule.value) return
  emit('save-edit', {
    scope: draftScope.value,
    rule: { ...draftRule.value }
  })
}

watch(() => props.visible, (visible) => {
  if (visible) {
    resetSections()
  }
}, { immediate: true })
</script>

<style scoped>
.regex-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.regex-sheet {
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

.regex-sheet.has-detail {
  overflow: hidden;
}

.regex-sheet::before {
  content: none;
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
  gap: 14px;
}

.scope-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: var(--off-border-w, 2px) solid rgba(17, 17, 17, 0.12);
  border-radius: 16px;
  background: rgba(17, 17, 17, 0.02);
}

.scope-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.scope-header-main {
  min-width: 0;
  flex: 1;
}

.scope-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--off-text, #111);
}

.scope-subtitle {
  margin-top: 2px;
  font-size: 11px;
  color: var(--off-text-sec, #777);
}

.scope-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.scope-count {
  min-width: 26px;
  height: 26px;
  padding: 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 17, 17, 0.06);
  color: var(--off-text-sec, #777);
  font-size: 11px;
  font-weight: 700;
}

.section-link {
  font-size: 13px;
  font-weight: 700;
  color: var(--off-accent, #111);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
}

.section-link.disabled,
.section-link:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.fold-btn {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 10px;
  background: rgba(17, 17, 17, 0.04);
  color: var(--off-text-sec, #888);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.fold-btn.open {
  transform: rotate(180deg);
}

.empty-hint {
  text-align: center;
  padding: 18px 12px;
  color: var(--off-text-sec, #888);
  font-size: 13px;
  border: 1px dashed rgba(17, 17, 17, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
}

.collapsed-hint {
  padding: 12px;
  text-align: center;
  color: var(--off-text-sec, #888);
  font-size: 12px;
  border: 1px dashed rgba(17, 17, 17, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}

.empty-sub {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.75;
}

.editor-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px 14px;
  border-bottom: var(--off-border-w, 2px) solid var(--off-border, #111);
  flex-shrink: 0;
}

.editor-body {
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

.edit-title-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.edit-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--off-text, #111);
}

.target-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  color: var(--off-text-sec, #666);
}

.edit-close-btn {
  width: 32px;
  height: 32px;
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

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.edit-row {
  display: flex;
  gap: 10px;
}

.small-field {
  width: 92px;
  flex-shrink: 0;
}

.edit-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--off-text-sec, #888);
}

.edit-input {
  width: 100%;
  background: #fff;
  color: var(--off-text, #111);
  border: var(--off-border-w, 2px) solid var(--off-border, #111);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.font-mono {
  font-family: 'Courier New', monospace;
}

.scope-btns {
  display: flex;
  gap: 8px;
}

.scope-btn {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  border: var(--off-border-w, 2px) solid var(--off-border, #111);
  background: #fff;
  color: var(--off-text-sec, #888);
  cursor: pointer;
}

.scope-btn.active {
  background: var(--off-text, #111);
  color: var(--off-surface, #fff);
}

.preview-box {
  background: #fff;
  border: var(--off-border-w, 2px) solid var(--off-border, #111);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--off-text, #111);
}

.edit-actions {
  display: flex;
  gap: 8px;
}

.modal-btn {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 14px;
  border: var(--off-border-w, 2px) solid var(--off-border, #111);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
  box-shadow: var(--off-shadow-sm, 2px 2px 0 #111);
}

.modal-btn:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.modal-btn-primary {
  background: var(--off-text, #111);
  color: var(--off-surface, #fff);
}

.modal-btn-secondary {
  background: #fff;
  color: var(--off-text, #111);
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: opacity 0.3s ease;
}

.slide-up-enter-active .regex-sheet, .slide-up-leave-active .regex-sheet {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from { opacity: 0; }
.slide-up-enter-from .regex-sheet { transform: translateY(100%); }
.slide-up-leave-to { opacity: 0; }
.slide-up-leave-to .regex-sheet { transform: translateY(100%); }

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
  .scope-header,
  .edit-row {
    align-items: stretch;
    flex-direction: column;
  }

  .scope-actions,
  .scope-btns {
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .small-field {
    width: 100%;
  }
}
</style>
