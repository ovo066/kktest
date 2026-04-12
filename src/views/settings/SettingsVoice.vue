<template>
  <div class="space-y-6">
    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
        <div class="flex flex-col">
          <span class="text-[17px] text-[var(--text-primary)]">语音播放模式</span>
          <span class="text-[12px] text-[var(--text-secondary)]">点击语音条播放方式</span>
        </div>
        <select v-model="store.voiceTtsMode" class="text-[var(--primary-color)] bg-transparent outline-none text-right min-w-0" @change="scheduleSave">
          <option value="simulated">模拟</option>
          <option value="browser">浏览器TTS</option>
          <option value="edge">Edge TTS(接口)</option>
          <option value="minimax">MiniMax</option>
        </select>
      </div>
      <template v-if="store.voiceTtsMode === 'edge'">
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">Edge接口</span>
          <input v-model="store.voiceTtsConfig.edgeEndpoint" type="text" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="例如 https://your-tts.example.com/api/tts" @change="scheduleSave">
        </div>
        <div class="flex items-center px-4 py-3">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">默认音色</span>
          <input v-model="store.voiceTtsConfig.edgeVoiceId" type="text" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="例如 zh-CN-XiaoxiaoNeural" @change="scheduleSave">
        </div>
      </template>
      <template v-else-if="store.voiceTtsMode === 'minimax'">
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">MiniMax线路</span>
          <select v-model="minimaxEndpointPreset" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--primary-color)]" @change="handleMiniMaxEndpointPresetChange">
            <option value="global">海外官方 (.io)</option>
            <option value="china">国内官方 (.com)</option>
            <option value="custom">自定义</option>
          </select>
        </div>
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">MiniMax接口</span>
          <input v-model="store.voiceTtsConfig.minimaxEndpoint" type="text" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="例如 https://api.minimax.io/v1/t2a_v2 或 .com" @change="scheduleSave">
        </div>
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">API Key</span>
          <input v-model="store.voiceTtsConfig.minimaxApiKey" type="password" name="minimax-api-key" autocomplete="new-password" data-form-type="other" data-lpignore="true" data-1p-ignore="true" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="留空则无法调用" @change="scheduleSave">
        </div>
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">Group ID</span>
          <input v-model="store.voiceTtsConfig.minimaxGroupId" type="text" name="minimax-group-id" autocomplete="off" data-form-type="other" data-lpignore="true" data-1p-ignore="true" autocapitalize="off" autocorrect="off" spellcheck="false" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="可选：部分旧接口需要" @change="scheduleSave">
        </div>
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">默认音色</span>
          <input v-model="store.voiceTtsConfig.minimaxVoiceId" type="text" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="例如 female-1 / male-1 / 自定义ID" @change="scheduleSave">
        </div>
        <div class="flex items-center px-4 py-3">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">模型</span>
          <input v-model="store.voiceTtsConfig.minimaxModel" type="text" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="例如 speech-02-turbo" @change="scheduleSave">
        </div>
      </template>
    </div>

    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
        <div class="flex flex-col">
          <span class="text-[17px] text-[var(--text-primary)]">通话语音识别</span>
          <span class="text-[12px] text-[var(--text-secondary)]">通话中语音转文字引擎</span>
        </div>
        <select v-model="store.sttEngine" class="text-[var(--primary-color)] bg-transparent outline-none text-right min-w-0" @change="scheduleSave">
          <option value="browser">浏览器原生</option>
          <option value="online">在线 STT</option>
        </select>
      </div>
      <template v-if="store.sttEngine === 'online'">
        <div class="px-4 pt-3 text-[12px] text-[var(--text-secondary)]">
          {{ sttProviderHelpText }}
        </div>
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">识别触发</span>
          <select v-model="store.sttTriggerMode" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--primary-color)]" @change="scheduleSave">
            <option value="auto">自动（静音后识别）</option>
            <option value="manual">手动（点击按钮识别）</option>
          </select>
        </div>
        <div v-if="store.sttTriggerMode === 'manual'" class="px-4 pt-3 text-[12px] text-[var(--text-secondary)]">
          手动模式下，通话页会显示“开始识别/发送识别”按钮：先点开始，再说话，最后再点一次发送。
        </div>
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">服务商</span>
          <select v-model="store.sttProvider" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--primary-color)]" @change="scheduleSave">
            <option v-for="option in sttProviderOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">接口地址</span>
          <input v-model="store.sttApiUrl" type="text" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" :placeholder="sttPlaceholders.url" @change="scheduleSave">
        </div>
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">API Key</span>
          <input v-model="store.sttApiKey" type="password" name="stt-api-key" autocomplete="new-password" data-form-type="other" data-lpignore="true" data-1p-ignore="true" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" :placeholder="sttPlaceholders.key" @change="scheduleSave">
        </div>
        <div class="flex items-center px-4 py-3">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">模型</span>
          <input v-model="store.sttApiModel" type="text" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" :placeholder="sttPlaceholders.model" @change="scheduleSave">
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { useStorage } from '../../composables/useStorage'
import {
  getSTTProviderHelpText,
  getSTTProviderPlaceholders,
  normalizeSTTProvider,
  STT_PROVIDER_DEEPGRAM,
  STT_PROVIDER_OPTIONS,
  STT_PROVIDER_SILICONFLOW
} from '../../utils/sttProviders'
import { sanitizeMiniMaxGroupId } from '../../utils/minimaxConfig'

const store = useSettingsStore()
const { scheduleSave } = useStorage()
const minimaxEndpointPreset = ref('global')
const sttProviderOptions = STT_PROVIDER_OPTIONS

const MINIMAX_ENDPOINTS = {
  global: 'https://api.minimax.io/v1/t2a_v2',
  china: 'https://api.minimaxi.com/v1/t2a_v2'
}
const DEFAULT_SILICONFLOW_STT_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions'
const DEFAULT_SILICONFLOW_STT_MODEL = 'FunAudioLLM/SenseVoiceSmall'
const DEFAULT_DEEPGRAM_STT_URL = 'https://api.deepgram.com/v1/listen'

const currentSttProvider = computed(() => normalizeSTTProvider(store.sttProvider))
const sttProviderHelpText = computed(() => getSTTProviderHelpText(currentSttProvider.value))
const sttPlaceholders = computed(() => getSTTProviderPlaceholders(currentSttProvider.value))

function normalizeEndpointHost(endpoint) {
  let raw = String(endpoint || '').trim()
  if (!raw) return ''
  if (!/^https?:\/\//i.test(raw) && /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(raw)) {
    raw = 'https://' + raw
  }
  try {
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function detectMiniMaxEndpointPreset(endpoint) {
  const host = normalizeEndpointHost(endpoint)
  if (!host) return 'global'
  if (host === 'api.minimax.io' || host === 'api-uw.minimax.io') return 'global'
  if (host === 'api.minimaxi.com' || host === 'api-bj.minimaxi.com') return 'china'
  return 'custom'
}

function shouldResetSiliconFlowSttUrl(url) {
  const host = normalizeEndpointHost(url)
  const path = String(url || '').trim().toLowerCase()
  if (!host) return true
  if (host.includes('siliconflow')) return false
  if (host.includes('minimax') || host.includes('minimaxi')) return true
  if (path.includes('/t2a_v2')) return true
  return false
}

function handleMiniMaxEndpointPresetChange() {
  if (minimaxEndpointPreset.value === 'global') {
    store.voiceTtsConfig.minimaxEndpoint = MINIMAX_ENDPOINTS.global
  } else if (minimaxEndpointPreset.value === 'china') {
    store.voiceTtsConfig.minimaxEndpoint = MINIMAX_ENDPOINTS.china
  }
  scheduleSave()
}

function sanitizeMiniMaxVoiceSettings() {
  const cfg = store.voiceTtsConfig
  if (!cfg) return false

  const nextGroupId = sanitizeMiniMaxGroupId(cfg.minimaxGroupId, cfg.minimaxEndpoint)
  if (nextGroupId === cfg.minimaxGroupId) return false

  cfg.minimaxGroupId = nextGroupId
  return true
}

onMounted(() => {
  if (sanitizeMiniMaxVoiceSettings()) scheduleSave()
})

watch(
  () => store.voiceTtsConfig?.minimaxEndpoint,
  (value) => {
    minimaxEndpointPreset.value = detectMiniMaxEndpointPreset(value)
  },
  { immediate: true }
)

watch(
  () => [store.voiceTtsConfig?.minimaxGroupId, store.voiceTtsConfig?.minimaxEndpoint],
  () => {
    if (sanitizeMiniMaxVoiceSettings()) scheduleSave()
  }
)

watch(
  () => store.sttProvider,
  (value) => {
    const provider = normalizeSTTProvider(value)
    let changed = false

    if (provider === STT_PROVIDER_SILICONFLOW) {
      if (shouldResetSiliconFlowSttUrl(store.sttApiUrl)) {
        store.sttApiUrl = DEFAULT_SILICONFLOW_STT_URL
        changed = true
      }
      if (!String(store.sttApiModel || '').trim()) {
        store.sttApiModel = DEFAULT_SILICONFLOW_STT_MODEL
        changed = true
      }
    } else if (provider === STT_PROVIDER_DEEPGRAM) {
      if (!String(store.sttApiUrl || '').trim()) {
        store.sttApiUrl = DEFAULT_DEEPGRAM_STT_URL
        changed = true
      }
    }

    if (changed) scheduleSave()
  },
  { immediate: true }
)
</script>

