<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="visible" class="fixed inset-0 z-[900] flex flex-col justify-end">
        <div class="theme-backdrop" @click="$emit('close')"></div>
        <div class="theme-sheet">
          <div class="sheet-header">
            <span class="sheet-title">主题美化</span>
            <button class="close-btn" @click="$emit('close')">
              <i class="ph ph-x text-xl"></i>
            </button>
          </div>

          <div class="option-section">
            <div class="option-title">基础主题</div>
            <button
              class="base-theme-card"
              :class="{ active: currentTheme === 'ttk' }"
              @click="$emit('select', 'ttk')"
            >
              <div class="theme-preview"></div>
              <span>默认黑白</span>
            </button>
          </div>

          <div class="option-section">
            <div class="option-title">布局样式</div>
            <div class="option-grid">
              <button
                v-for="layout in layouts"
                :key="layout.id"
                class="option-btn"
                :class="{ active: currentLayout === layout.id }"
                @click="$emit('select-layout', layout.id)"
              >
                <span class="option-name">{{ layout.name }}</span>
                <span class="option-desc">{{ layout.desc }}</span>
              </button>
            </div>
          </div>

          <div class="option-section">
            <div class="option-title">头像位置</div>
            <div class="avatar-mode-row">
              <button
                v-for="mode in avatarModes"
                :key="mode.id"
                class="mode-btn"
                :class="{ active: currentAvatarMode === mode.id }"
                @click="$emit('select-avatar-mode', mode.id)"
              >
                {{ mode.name }}
              </button>
            </div>
          </div>

          <div class="option-section">
            <div class="option-title">Offline 字体（独立）</div>
            <input
              v-model="draft.fontFamily"
              class="text-input"
              placeholder='e.g. "Noto Sans SC", "Microsoft YaHei", sans-serif'
            />
            <input
              v-model="draft.fontImport"
              class="text-input"
              placeholder="Font import URL (Google Fonts stylesheet or .woff2/.ttf file)"
            />
            <div class="option-desc">仅作用于线下模式，不影响全局主题。</div>
          </div>

          <div class="option-section">
            <div class="option-title">自定义 CSS（完整片段）</div>
            <textarea
              v-model="draft.customCss"
              class="css-textarea"
              placeholder=".offline-view.offline-theme-custom .char-bubble { border-style: dashed; }"
            ></textarea>
          </div>

          <details class="selector-help">
            <summary>可用选择器（点击展开）</summary>
            <pre class="selector-code">.offline-view.offline-theme-custom
.offline-view.offline-theme-custom .story-renderer
.offline-view.offline-theme-custom .msg-row.user .bubble
.offline-view.offline-theme-custom .msg-row.assistant .bubble
.offline-view.offline-theme-custom .msg-row.layout-st .bubble
.offline-view.offline-theme-custom .msg-row.layout-floor .msg-body
.offline-view.offline-theme-custom .off-speaker-label
.offline-view.offline-theme-custom .off-action-text
.offline-view.offline-theme-custom .msg-actions .act-btn
.offline-view.offline-theme-custom .offline-header
.offline-view.offline-theme-custom .offline-input</pre>
          </details>

          <div class="action-row">
            <button class="action-btn action-btn-secondary" @click="$emit('reset-theme-config')">恢复默认</button>
            <button class="action-btn action-btn-primary" @click="emitSave">保存并应用</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  currentTheme: { type: String, default: 'ttk' },
  currentLayout: { type: String, default: 'classic' },
  currentAvatarMode: { type: String, default: 'side' },
  currentThemeConfig: {
    type: Object,
    default: () => ({ customCss: '', fontFamily: '', fontImport: '' })
  }
})

const emit = defineEmits([
  'close',
  'select',
  'select-layout',
  'select-avatar-mode',
  'save-theme-config',
  'reset-theme-config'
])

const layouts = [
  { id: 'classic', name: '经典气泡', desc: '当前左右气泡布局' },
  { id: 'st', name: 'SillyTavern', desc: '更接近酒馆的扁平对话样式' },
  { id: 'floor', name: '楼层卡片', desc: '头像与楼层号在上方' }
]

const avatarModes = [
  { id: 'side', name: '侧边头像' },
  { id: 'top', name: '顶部头像' },
  { id: 'hidden', name: '隐藏头像' }
]

const draft = reactive({
  customCss: '',
  fontFamily: '',
  fontImport: ''
})

function cloneConfig(input) {
  const src = input && typeof input === 'object' ? input : {}
  return {
    customCss: String(src.customCss || ''),
    fontFamily: String(src.fontFamily || '').trim(),
    fontImport: String(src.fontImport || '').trim()
  }
}

function syncDraft() {
  const next = cloneConfig(props.currentThemeConfig)
  draft.customCss = next.customCss
  draft.fontFamily = next.fontFamily
  draft.fontImport = next.fontImport
}

function emitSave() {
  emit('save-theme-config', cloneConfig(draft))
}

watch(() => props.visible, (v) => {
  if (v) syncDraft()
}, { immediate: true })

watch(() => props.currentThemeConfig, () => {
  if (props.visible) syncDraft()
}, { deep: true })
</script>

<style scoped>
.theme-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.theme-sheet {
  position: relative;
  background: #fff;
  border-top: var(--off-border-w) solid var(--off-border);
  border-radius: 16px 16px 0 0;
  min-height: 48vh;
  max-height: 84vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  touch-action: pan-y;
  padding: 0 20px 24px 20px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  z-index: 10;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: var(--off-border-w) solid var(--off-border);
  margin-bottom: 16px;
}

.sheet-title {
  font-weight: 800;
  font-size: 17px;
  color: var(--off-text);
}

.close-btn {
  background: none;
  border: none;
  color: var(--off-text-sec);
  cursor: pointer;
}

.option-section {
  margin-top: 14px;
}

.option-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--off-text);
  margin-bottom: 10px;
}

.base-theme-card {
  width: 100%;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 12px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  color: var(--off-text);
  font-weight: 700;
}

.base-theme-card.active {
  border-color: var(--off-accent);
  background: #f7f7f7;
}

.theme-preview {
  width: 56px;
  height: 34px;
  border: 2px solid #111;
  box-shadow: 2px 2px 0 #111;
  border-radius: 8px;
  background: #fff;
}

.option-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.option-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 10px;
  background: #fff;
  color: var(--off-text);
  cursor: pointer;
}

.option-btn.active {
  border-color: var(--off-accent);
  background: #f7f7f7;
}

.option-name {
  font-size: 14px;
  font-weight: 700;
}

.option-desc {
  font-size: 12px;
  color: var(--off-text-sec);
}

.avatar-mode-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.mode-btn {
  padding: 9px 8px;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 10px;
  background: #fff;
  color: var(--off-text);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.mode-btn.active {
  border-color: var(--off-accent);
  background: #f7f7f7;
}

.text-input {
  width: 100%;
  background: #fff;
  color: var(--off-text);
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  outline: none;
}

.text-input + .text-input {
  margin-top: 8px;
}

.css-textarea {
  width: 100%;
  background: #fff;
  color: var(--off-text);
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: 'Courier New', monospace;
  min-height: 132px;
  resize: vertical;
}

.selector-help {
  margin-top: 10px;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 10px;
  padding: 8px 10px;
  background: #fff;
}

.selector-help summary {
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  color: var(--off-text-sec);
}

.selector-code {
  margin-top: 8px;
  background: #f7f7f7;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: #333;
}

.action-row {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.action-btn {
  padding: 10px 12px;
  border: var(--off-border-w) solid var(--off-border);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
}

.action-btn-primary {
  background: var(--off-text);
  color: var(--off-surface);
}

.action-btn-secondary {
  background: #fff;
  color: var(--off-text);
}

/* slide-up transition */
.slide-up-enter-active, .slide-up-leave-active {
  transition: opacity 0.3s ease;
}
.slide-up-enter-active .theme-sheet, .slide-up-leave-active .theme-sheet {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from { opacity: 0; }
.slide-up-enter-from .theme-sheet { transform: translateY(100%); }
.slide-up-leave-to { opacity: 0; }
.slide-up-leave-to .theme-sheet { transform: translateY(100%); }
</style>
