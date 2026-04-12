<script setup>
import { ref } from 'vue'
import { summarizeSTPresetPayload } from '../../../utils/stPreset'

defineProps({
  show: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'imported'])

const jsonText = ref('')
const error = ref('')
const summary = ref(null)
const parsedPayload = ref(null)

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    jsonText.value = reader.result
    tryParse()
  }
  reader.readAsText(file)
}

function tryParse() {
  error.value = ''
  summary.value = null
  parsedPayload.value = null
  if (!jsonText.value.trim()) return

  try {
    const data = JSON.parse(jsonText.value)
    const nextSummary = summarizeSTPresetPayload(data)
    if (!nextSummary.valid) {
      error.value = '未识别到可导入的 SillyTavern 预设'
      return
    }
    parsedPayload.value = data
    summary.value = nextSummary
  } catch {
    error.value = 'JSON 解析失败'
  }
}

function doImport() {
  if (!summary.value?.valid || !parsedPayload.value) return
  emit('imported', parsedPayload.value)
  jsonText.value = ''
  summary.value = null
  parsedPayload.value = null
}
</script>

<template>
  <Transition name="meet-modal">
    <div v-if="show" class="meet-import-overlay" @click.self="emit('close')">
      <div class="meet-import-box">
        <div class="import-header">
          <span class="import-title">导入 ST 预设提示词</span>
          <button class="import-close" @click="emit('close')">
            <i class="ph ph-x"></i>
          </button>
        </div>

        <div class="import-body">
          <p class="import-hint">
            支持 SillyTavern 单个或批量导出 JSON（含 prompts / prompt_order）。
          </p>

          <label class="import-file-label">
            <i class="ph ph-file-arrow-up"></i> 选择 JSON 文件
            <input type="file" accept=".json" @change="onFileChange" class="import-file-input">
          </label>

          <div class="import-or">或粘贴 JSON</div>

          <textarea
            v-model="jsonText"
            class="import-textarea"
            placeholder='{"name":"...", "system_prompt":"...", ...}'
            rows="6"
            @input="tryParse"
          ></textarea>

          <div v-if="error" class="import-error">{{ error }}</div>

          <div v-if="summary?.valid" class="import-preview">
            <div class="preview-row"><span class="preview-label">可导入预设:</span> {{ summary.presetCount }}</div>
            <div class="preview-row"><span class="preview-label">提示词预设:</span> {{ summary.promptPresetCount }}</div>
            <div class="preview-row"><span class="preview-label">预设条目总数:</span> {{ summary.totalEntries }}</div>
            <div v-if="summary.names.length" class="preview-list">
              <span class="preview-label">预设列表:</span>
              <div class="preview-names">{{ summary.names.join(' / ') }}</div>
            </div>
          </div>
        </div>

        <div class="import-footer">
          <button class="import-btn cancel" @click="emit('close')">取消</button>
          <button class="import-btn confirm" :disabled="!summary?.valid" @click="doImport">一键导入</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.meet-import-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.meet-import-box {
  width: 100%;
  max-width: 460px;
  background: rgba(20, 20, 20, 0.96);
  border: 2px solid #333;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
}

.import-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #333;
}

.import-title {
  font-weight: 700;
  font-size: 1.05rem;
  color: #fff;
  letter-spacing: 3px;
}

.import-close {
  background: #000;
  border: 1px solid #444;
  color: #fff;
  padding: 6px 10px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.import-close:hover { background: #333; }

.import-body {
  padding: 24px;
}

.import-hint {
  margin: 0 0 14px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.8rem;
  line-height: 1.5;
}

.import-file-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border: 2px dashed #444;
  cursor: pointer;
  font-weight: 700;
  text-align: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.95rem;
  letter-spacing: 2px;
  transition: all 0.2s;
}

.import-file-label:hover { border-color: #666; color: rgba(255, 255, 255, 0.7); }

.import-file-input {
  display: none;
}

.import-or {
  text-align: center;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.25);
  margin: 16px 0;
  letter-spacing: 4px;
}

.import-textarea {
  width: 100%;
  border: 2px solid #333;
  background: rgba(0, 0, 0, 0.4);
  padding: 14px;
  font-size: 0.85rem;
  font-family: monospace;
  resize: vertical;
  color: rgba(255, 255, 255, 0.9);
  outline: none;
}

.import-textarea:focus { border-color: #666; }
.import-textarea::placeholder { color: rgba(255, 255, 255, 0.2); }

.import-error {
  color: #cc6666;
  font-weight: 700;
  margin-top: 10px;
  font-size: 0.85rem;
  letter-spacing: 1px;
}

.import-preview {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.3);
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
}

.preview-row {
  margin-bottom: 6px;
}

.preview-row:last-child { margin-bottom: 0; }

.preview-list {
  margin-top: 10px;
}

.preview-names {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.5;
  word-break: break-word;
}

.preview-label {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 1px;
}

.import-footer {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #333;
  justify-content: flex-end;
}

.import-btn {
  padding: 12px 24px;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.95rem;
  font-family: var(--meet-font, 'Noto Serif SC', 'SimSun', serif);
  letter-spacing: 3px;
  transition: all 0.2s;
}

.import-btn.cancel {
  background: transparent;
  border: 1px solid #444;
  color: rgba(255, 255, 255, 0.5);
}

.import-btn.cancel:hover { border-color: #666; color: #fff; }

.import-btn.confirm {
  background: #000;
  border: 2px solid #555;
  color: #fff;
}

.import-btn.confirm:hover { background: #333; border-color: #777; }
.import-btn:active { transform: scale(0.96); }
.import-btn:disabled { opacity: 0.3; cursor: default; }

.meet-modal-enter-active { transition: opacity 0.3s; }
.meet-modal-leave-active { transition: opacity 0.2s; }
.meet-modal-enter-from, .meet-modal-leave-to { opacity: 0; }
</style>
