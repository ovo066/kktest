<template>
  <Teleport to="body">
    <Transition name="snoop-consent">
      <div v-if="visible" class="snoop-consent-overlay" @click.self="$emit('close')">
        <div class="snoop-consent-card">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
              <img v-if="contact?.avatar" :src="contact.avatar" class="w-full h-full object-cover">
              <div v-else class="w-full h-full flex items-center justify-center text-lg text-gray-400">
                <i class="ph-fill ph-user"></i>
              </div>
            </div>
            <div class="font-medium text-[15px]">{{ contact?.name }}</div>
          </div>

          <div class="text-[13px] text-gray-500 dark:text-gray-400 mb-3">
            先发一句话试探，对方同意后才能打开手机
          </div>

          <div class="snoop-consent-userbox">
            <textarea
              v-model="requestText"
              class="snoop-consent-input"
              rows="2"
              maxlength="120"
              placeholder="比如：我有点好奇，能让我看看你的手机吗？"
              :disabled="loading"
              @keydown.enter.exact.prevent="requestConsent"
            ></textarea>
            <button
              class="snoop-consent-send"
              :disabled="loading || !canSend"
              @click="requestConsent"
            >
              <i class="ph-fill ph-paper-plane-tilt text-[16px]"></i>
            </button>
          </div>

          <div v-if="submitted" class="snoop-consent-request" v-html="renderRichText(requestText)">
          </div>

          <div class="snoop-consent-bubble" :class="{ 'snoop-consent-bubble--error': !!error }">
            <template v-if="loading">
              <div class="typing-dots">
                <span></span><span></span><span></span>
              </div>
            </template>
            <template v-else-if="error">
              <div class="text-red-500 text-[13px]">{{ error }}</div>
            </template>
            <template v-else-if="!submitted">
              <div class="text-[13px] text-[var(--text-secondary)]">输入一句话后点发送</div>
            </template>
            <template v-else>
              <div class="text-[14px] leading-relaxed" v-html="renderRichText(responseMessage)"></div>
            </template>
          </div>

          <div class="flex gap-3 mt-4">
            <button class="snoop-consent-btn snoop-consent-btn--cancel" @click="$emit('close')">
              算了
            </button>
            <button
              v-if="agreed"
              class="snoop-consent-btn snoop-consent-btn--confirm"
              @click="$emit('confirm')"
            >
              打开手机
            </button>
            <button
              v-if="error"
              class="snoop-consent-btn snoop-consent-btn--confirm"
              @click="requestConsent"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { generateSnoopConsentResponse } from '../../../composables/snoopConsent'
import { renderRichText } from '../../../utils/renderRichText'

const props = defineProps({
  visible: Boolean,
  contact: Object
})

defineEmits(['close', 'confirm'])

const loading = ref(false)
const agreed = ref(false)
const responseMessage = ref('')
const error = ref('')
const submitted = ref(false)
const requestText = ref('我能查查你的手机吗？')

const canSend = computed(() => String(requestText.value || '').trim().length > 0)

async function requestConsent() {
  if (!props.contact || !canSend.value || loading.value) return
  loading.value = true
  error.value = ''
  agreed.value = false
  responseMessage.value = ''
  submitted.value = true

  try {
    const result = await generateSnoopConsentResponse(props.contact, requestText.value)
    agreed.value = result.agreed
    responseMessage.value = result.message
  } catch (e) {
    error.value = e?.message || '请求失败'
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (val) => {
  if (!val) return
  loading.value = false
  agreed.value = false
  responseMessage.value = ''
  error.value = ''
  submitted.value = false
  requestText.value = '我能查查你的手机吗？'
})
</script>

<style scoped>
.snoop-consent-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.snoop-consent-card {
  width: 300px;
  max-width: 85vw;
  background: var(--card-bg, #fff);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.dark .snoop-consent-card {
  background: var(--card-bg, #1c1c1e);
}

.snoop-consent-userbox {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 12px;
}

.snoop-consent-input {
  flex: 1;
  min-height: 68px;
  border: none;
  outline: none;
  resize: none;
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--text-primary, #000);
  background: var(--bg-secondary, #f2f2f7);
}

.dark .snoop-consent-input {
  color: var(--text-primary, #fff);
  background: var(--bg-secondary, #2c2c2e);
}

.snoop-consent-send {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--primary-color, #007aff);
  color: #fff;
  cursor: pointer;
}

.snoop-consent-send:disabled {
  opacity: 0.4;
  cursor: default;
}

.snoop-consent-request {
  margin: 0 0 10px auto;
  max-width: 85%;
  padding: 9px 12px;
  border-radius: 14px 14px 6px 14px;
  background: var(--primary-color, #007aff);
  color: #fff;
  font-size: 13px;
  line-height: 1.4;
}

.snoop-consent-bubble {
  background: var(--bubble-assistant-bg, #e9e9eb);
  border-radius: 14px;
  padding: 10px 14px;
  min-height: 40px;
  display: flex;
  align-items: center;
}

.dark .snoop-consent-bubble {
  background: var(--bubble-assistant-bg, #2c2c2e);
}

.snoop-consent-bubble--error {
  align-items: flex-start;
}

.snoop-consent-request :deep(strong),
.snoop-consent-bubble :deep(strong) {
  font-weight: 700;
}

.snoop-consent-request :deep(em),
.snoop-consent-bubble :deep(em) {
  font-style: italic;
}

.snoop-consent-request :deep(code),
.snoop-consent-bubble :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.92em;
  padding: 0.08em 0.34em;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.18);
}

.dark .snoop-consent-bubble :deep(code) {
  background: rgba(255, 255, 255, 0.1);
}

.typing-dots {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 4px 0;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-secondary, #8e8e93);
  animation: snoop-dot-bounce 1.2s infinite;
}

.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes snoop-dot-bounce {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-4px); }
}

.snoop-consent-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}

.snoop-consent-btn:active { opacity: 0.7; }

.snoop-consent-btn--cancel {
  background: var(--bg-secondary, #f2f2f7);
  color: var(--text-primary, #000);
}

.dark .snoop-consent-btn--cancel {
  background: var(--bg-secondary, #2c2c2e);
  color: var(--text-primary, #fff);
}

.snoop-consent-btn--confirm {
  background: var(--primary-color, #007aff);
  color: #fff;
}

.snoop-consent-enter-active,
.snoop-consent-leave-active {
  transition: opacity 0.2s ease;
}

.snoop-consent-enter-active .snoop-consent-card,
.snoop-consent-leave-active .snoop-consent-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.snoop-consent-enter-from,
.snoop-consent-leave-to {
  opacity: 0;
}

.snoop-consent-enter-from .snoop-consent-card {
  transform: scale(0.95);
}

.snoop-consent-leave-to .snoop-consent-card {
  transform: scale(0.95);
}
</style>
