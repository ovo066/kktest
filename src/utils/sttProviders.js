export const STT_PROVIDER_OPENAI_COMPAT = 'openai-compatible'
export const STT_PROVIDER_SILICONFLOW = 'siliconflow'
export const STT_PROVIDER_DEEPGRAM = 'deepgram'

export const STT_PROVIDER_OPTIONS = [
  { value: STT_PROVIDER_OPENAI_COMPAT, label: '通用兼容' },
  { value: STT_PROVIDER_SILICONFLOW, label: 'SiliconFlow' },
  { value: STT_PROVIDER_DEEPGRAM, label: 'Deepgram' }
]

const STT_PROVIDER_HELP_TEXT = {
  [STT_PROVIDER_OPENAI_COMPAT]: '兼容 OpenAI /audio/transcriptions 的 multipart 接口，适合 OpenAI 和各类兼容网关。',
  [STT_PROVIDER_SILICONFLOW]: 'SiliconFlow 的转写接口是 OpenAI 兼容格式，建议使用 https://api.siliconflow.cn/v1/audio/transcriptions。',
  [STT_PROVIDER_DEEPGRAM]: 'Deepgram 需要 /v1/listen 和 Token 鉴权。选这个后，应用会自动切换到 Deepgram 的请求格式。'
}

const STT_PROVIDER_PLACEHOLDERS = {
  [STT_PROVIDER_OPENAI_COMPAT]: {
    url: '例如 https://your-api.example.com/v1/audio/transcriptions',
    key: '按服务商要求填写',
    model: '例如 whisper-1'
  },
  [STT_PROVIDER_SILICONFLOW]: {
    url: '例如 https://api.siliconflow.cn/v1/audio/transcriptions',
    key: '填写 SiliconFlow API Key',
    model: '例如 FunAudioLLM/SenseVoiceSmall'
  },
  [STT_PROVIDER_DEEPGRAM]: {
    url: '例如 https://api.deepgram.com/v1/listen',
    key: '填写 Deepgram API Key',
    model: '例如 nova-3'
  }
}

function normalizeUrlHost(url) {
  let raw = String(url || '').trim()
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

export function normalizeSTTProvider(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === STT_PROVIDER_SILICONFLOW) return STT_PROVIDER_SILICONFLOW
  if (normalized === STT_PROVIDER_DEEPGRAM) return STT_PROVIDER_DEEPGRAM
  if (normalized === 'openai' || normalized === STT_PROVIDER_OPENAI_COMPAT) return STT_PROVIDER_OPENAI_COMPAT
  return STT_PROVIDER_OPENAI_COMPAT
}

export function inferSTTProviderFromUrl(url) {
  const host = normalizeUrlHost(url)
  if (!host) return STT_PROVIDER_OPENAI_COMPAT
  if (host.includes('deepgram')) return STT_PROVIDER_DEEPGRAM
  if (host.includes('siliconflow')) return STT_PROVIDER_SILICONFLOW
  return STT_PROVIDER_OPENAI_COMPAT
}

export function getSTTProviderHelpText(provider) {
  const key = normalizeSTTProvider(provider)
  return STT_PROVIDER_HELP_TEXT[key] || STT_PROVIDER_HELP_TEXT[STT_PROVIDER_OPENAI_COMPAT]
}

export function getSTTProviderPlaceholders(provider) {
  const key = normalizeSTTProvider(provider)
  return STT_PROVIDER_PLACEHOLDERS[key] || STT_PROVIDER_PLACEHOLDERS[STT_PROVIDER_OPENAI_COMPAT]
}
