/**
 * 在线 STT 引擎
 * 支持兼容 OpenAI multipart transcription，以及 Deepgram 预录音接口
 * 使用 MediaRecorder 录音 + Web Audio API VAD
 */
import { ref } from 'vue'
import { useSettingsStore } from '../../../stores/settings'
import { normalizeSTTProvider, STT_PROVIDER_DEEPGRAM, STT_PROVIDER_SILICONFLOW } from '../../../utils/sttProviders'

const isListening = ref(false)
const isSupported = ref(!!(typeof window !== 'undefined' && navigator.mediaDevices?.getUserMedia && window.MediaRecorder))
const transcript = ref('')
const interimTranscript = ref('')
const lastError = ref('')

let mediaStream = null
let mediaRecorder = null
let audioContext = null
let analyserNode = null
let inputGainNode = null
let recordingDestination = null
let vadInterval = null
let audioChunks = []
let onResultCb = null
let isPaused = false
let isActive = false

// VAD 参数
const VAD_CHECK_INTERVAL = 100
const SILENCE_THRESHOLD = 0.008
const ACTIVITY_THRESHOLD = 0.004
const SILENCE_TIMEOUT = 1600
const MIN_RECORD_DURATION = 400
const MIN_RECORD_DURATION_MANUAL = 180
const MIN_RECORD_DURATION_AUTO = 700
const RECORDER_START_MAX_ATTEMPTS = 3
const RECORDER_START_RETRY_DELAY_MS = 140
const DEFAULT_SILICONFLOW_STT_MODEL = 'FunAudioLLM/SenseVoiceSmall'
const MIN_ACTIVITY_FRAMES = 2
const AUTO_SEGMENT_MAX_DURATION = 7000
const AUTO_MIN_ACTIVITY_MS = 260
const AUTO_MIN_STRONG_FRAMES = 2
const ONLINE_STT_INPUT_GAIN = 2

let silenceStart = 0
let recordStart = 0
let isSpeaking = false
let currentLang = ''
let currentTriggerMode = 'auto'
const TRANSCRIPT_KEY_REGEX = /(?:^|_)(text|transcript|sentence|utterance|content|output)(?:$|_)/i
let speechActivityFrames = 0
let hasSpeechActivity = false
let isSendingSegment = false
let speechActivityMs = 0
let speechStrongFrames = 0

function cleanup() {
  if (vadInterval) { clearInterval(vadInterval); vadInterval = null }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop() } catch {}
  }
  mediaRecorder = null
  if (audioContext) {
    try { audioContext.close() } catch {}
    audioContext = null
  }
  analyserNode = null
  inputGainNode = null
  recordingDestination = null
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop())
    mediaStream = null
  }
  audioChunks = []
  isSpeaking = false
  silenceStart = 0
  recordStart = 0
  speechActivityFrames = 0
  hasSpeechActivity = false
  isSendingSegment = false
  speechActivityMs = 0
  speechStrongFrames = 0
}

function getRMS(analyser) {
  const data = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(data)
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
  return Math.sqrt(sum / data.length)
}

function extractTranscript(payload) {
  if (!payload) return ''
  if (typeof payload === 'string') {
    const text = payload.trim()
    if (!text) return ''
    if (/^\s*[<{[]/i.test(text)) return ''
    if (/<\s*html[\s>]/i.test(text)) return ''
    return text
  }

  const choiceContent = payload.choices?.[0]?.message?.content
  let normalizedChoiceContent = ''
  if (typeof choiceContent === 'string') {
    normalizedChoiceContent = choiceContent.trim()
  } else if (Array.isArray(choiceContent)) {
    normalizedChoiceContent = choiceContent
      .map(part => {
        if (typeof part === 'string') return part
        if (typeof part?.text === 'string') return part.text
        return ''
      })
      .join(' ')
      .trim()
  }

  const directCandidates = [
    payload.text,
    payload.result,
    payload.transcript,
    payload.output_text,
    payload.output?.text,
    payload.data?.text,
    payload.data?.result,
    payload.data?.transcript,
    payload.data?.output_text,
    payload.results?.[0]?.text,
    payload.data?.results?.[0]?.text,
    payload.outputs?.[0]?.text,
    payload.response?.text,
    payload.choices?.[0]?.text,
    normalizedChoiceContent
  ]
  const directMatch = directCandidates.find(value => typeof value === 'string' && value.trim())
  if (directMatch) return directMatch.trim()

  const channels = Array.isArray(payload.results?.channels) ? payload.results.channels : []
  if (channels.length > 0) {
    const merged = channels
      .map(channel => String(channel?.alternatives?.[0]?.transcript || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim()
    if (merged) return merged
  }

  const channelAlternatives = Array.isArray(payload.channel?.alternatives) ? payload.channel.alternatives : []
  if (channelAlternatives.length > 0) {
    const merged = channelAlternatives
      .map(item => String(item?.transcript || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim()
    if (merged) return merged
  }

  if (Array.isArray(payload.segments)) {
    const merged = payload.segments
      .map(item => String(item?.text || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim()
    if (merged) return merged
  }

  const deepCandidates = []
  collectTranscriptCandidates(payload, '', 0, deepCandidates)
  if (deepCandidates.length > 0) {
    return mergeTextChunks(deepCandidates)
  }

  return ''
}

function collectTranscriptCandidates(value, keyHint, depth, out) {
  if (!value || depth > 4 || out.length >= 20) return
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return
    if (TRANSCRIPT_KEY_REGEX.test(String(keyHint || ''))) {
      out.push(text)
    }
    return
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length && i < 10; i += 1) {
      collectTranscriptCandidates(value[i], keyHint, depth + 1, out)
    }
    return
  }
  if (typeof value !== 'object') return

  const entries = Object.entries(value)
  for (let i = 0; i < entries.length && i < 30; i += 1) {
    const [key, child] = entries[i]
    collectTranscriptCandidates(child, key, depth + 1, out)
  }
}

function mergeTextChunks(chunks) {
  let merged = ''
  for (const chunk of chunks) {
    const text = String(chunk || '').trim()
    if (!text) continue
    if (!merged) {
      merged = text
      continue
    }
    if (merged.includes(text)) continue
    if (text.includes(merged)) {
      merged = text
      continue
    }
    merged = `${merged} ${text}`.replace(/\s+/g, ' ').trim()
  }
  return merged
}

function normalizeSiliconFlowUrl(rawUrl) {
  let raw = String(rawUrl || '').trim()
  if (!raw) return ''
  if (!/^https?:\/\//i.test(raw) && /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(raw)) {
    raw = 'https://' + raw
  }

  try {
    const url = new URL(raw)
    const host = String(url.hostname || '').toLowerCase()
    if (!host.includes('siliconflow')) return url.toString()

    const normalizedPath = String(url.pathname || '').replace(/\/+$/, '').toLowerCase()
    const shouldNormalizePath = (
      !normalizedPath ||
      normalizedPath === '/' ||
      normalizedPath === '/v1' ||
      normalizedPath === '/chat/completions' ||
      normalizedPath === '/v1/chat/completions' ||
      normalizedPath.endsWith('/chat/completions')
    )
    if (shouldNormalizePath) {
      url.pathname = '/v1/audio/transcriptions'
    }
    return url.toString()
  } catch {
    return raw
  }
}

function parseUrlSafe(rawUrl) {
  let raw = String(rawUrl || '').trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw) && /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(raw)) {
    raw = 'https://' + raw
  }
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function isObviousWrongSiliconFlowEndpoint(rawUrl) {
  const parsed = parseUrlSafe(rawUrl)
  if (!parsed) return false
  const host = String(parsed.hostname || '').toLowerCase()
  const path = String(parsed.pathname || '').toLowerCase()
  if (host.includes('minimax') || host.includes('minimaxi')) return true
  if (path.includes('/t2a_v2')) return true
  return false
}

function resolveSiliconFlowEndpoint(rawUrl) {
  if (isObviousWrongSiliconFlowEndpoint(rawUrl)) {
    return 'https://api.siliconflow.cn/v1/audio/transcriptions'
  }
  return normalizeSiliconFlowUrl(rawUrl)
}

function parseResponsePayloads(rawBody) {
  const raw = String(rawBody || '').trim()
  if (!raw) return []

  try {
    return [JSON.parse(raw)]
  } catch {
    // fall through
  }

  const linePayloads = []
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = String(line || '').trim()
    if (!trimmed) continue
    const dataLine = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
    if (!dataLine || dataLine === '[DONE]') continue
    try {
      linePayloads.push(JSON.parse(dataLine))
    } catch {
      // ignore non-JSON lines
    }
  }
  if (linePayloads.length > 0) return linePayloads

  return [raw]
}

function extractSemanticError(payload) {
  if (!payload || typeof payload !== 'object') return ''

  const baseResp = payload.base_resp && typeof payload.base_resp === 'object'
    ? payload.base_resp
    : null
  const statusRaw = String(payload.status ?? payload.state ?? '').trim().toLowerCase()
  const hasErrorStatus = (
    statusRaw === 'error' ||
    statusRaw === 'failed' ||
    statusRaw === 'fail' ||
    statusRaw === 'invalid' ||
    statusRaw.startsWith('err')
  )
  const successFlag = payload.success
  const codeRaw = payload.code ?? payload.errno ?? payload.error_code ?? payload.status_code ?? baseResp?.status_code
  const codeText = String(codeRaw ?? '').trim().toLowerCase()
  const hasErrorCode = !!codeText && !['0', '200', 'ok', 'success'].includes(codeText)
  const candidates = [
    payload.error?.message,
    payload.error?.msg,
    payload.error_description,
    payload.detail,
    baseResp?.status_msg,
    (hasErrorCode || hasErrorStatus || successFlag === false) ? payload.message : '',
    (hasErrorCode || hasErrorStatus || successFlag === false) ? payload.msg : '',
    payload.data?.error?.message,
    payload.data?.error?.msg,
    payload.data?.message,
    payload.data?.msg
  ]
  const hit = candidates.find(value => typeof value === 'string' && value.trim())
  return hit ? hit.trim().slice(0, 260) : ''
}

function isExplicitEmptyTranscriptPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  if (!Object.prototype.hasOwnProperty.call(payload, 'text')) return false
  if (typeof payload.text !== 'string') return false
  if (payload.text.trim()) return false
  return !extractSemanticError(payload)
}

function buildDeepgramRequestUrl(rawUrl, { model, lang }) {
  try {
    const url = new URL(rawUrl)
    if (model) url.searchParams.set('model', model)
    if (lang) url.searchParams.set('language', lang)
    url.searchParams.set('punctuate', 'true')
    url.searchParams.set('smart_format', 'true')
    return url.toString()
  } catch {
    return ''
  }
}

function resolveRequestConfig(settings, blob) {
  const provider = normalizeSTTProvider(settings.sttProvider)
  const url = String(settings.sttApiUrl || '').trim()
  const key = String(settings.sttApiKey || '').trim()
  const model = String(settings.sttApiModel || '').trim()
  const normalizedUrl = provider === STT_PROVIDER_SILICONFLOW
    ? resolveSiliconFlowEndpoint(url)
    : url

  if (provider === STT_PROVIDER_DEEPGRAM) {
    return {
      url: buildDeepgramRequestUrl(url, { model, lang: currentLang }),
      headers: {
        ...(key ? { Authorization: `Token ${key}` } : {}),
        'Content-Type': blob.type || 'audio/webm'
      },
      body: blob
    }
  }

  const formData = new FormData()
  formData.append('file', blob, 'audio.webm')
  if (model) {
    formData.append('model', model)
  } else if (provider === STT_PROVIDER_SILICONFLOW) {
    formData.append('model', DEFAULT_SILICONFLOW_STT_MODEL)
  }

  return {
    url: normalizedUrl,
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    body: formData
  }
}

async function sendAudioToSTT(blob) {
  const settings = useSettingsStore()
  const provider = normalizeSTTProvider(settings.sttProvider)
  const { url, headers, body } = resolveRequestConfig(settings, blob)
  if (!url) {
    lastError.value = 'no-endpoint'
    return null
  }
  if (provider === STT_PROVIDER_SILICONFLOW && url !== String(settings.sttApiUrl || '').trim()) {
    console.warn('SiliconFlow STT endpoint auto-corrected:', {
      from: String(settings.sttApiUrl || '').trim(),
      to: url
    })
    settings.sttApiUrl = url
  }

  try {
    const resp = await fetch(url, { method: 'POST', headers, body })
    if (!resp.ok) {
      const rawText = await resp.text().catch(() => '')
      const compactError = String(rawText || '').replace(/\s+/g, ' ').trim().slice(0, 260)
      console.warn('Online STT API error:', {
        provider,
        status: resp.status,
        url,
        error: compactError || '(empty)'
      })
      lastError.value = 'api-error'
      return null
    }
    const rawBody = await resp.text().catch(() => '')
    const payloads = parseResponsePayloads(rawBody)
    const transcriptChunks = payloads
      .map(item => extractTranscript(item))
      .filter(Boolean)
    const text = mergeTextChunks(transcriptChunks)
    if (!text) {
      const semanticError = payloads
        .map(item => extractSemanticError(item))
        .find(Boolean)
      if (semanticError) {
        console.warn('Online STT API semantic error:', {
          provider,
          url,
          error: semanticError
        })
        lastError.value = 'api-error'
        return null
      }

      const hasExplicitEmptyTranscript = payloads.some(item => isExplicitEmptyTranscriptPayload(item))
      if (hasExplicitEmptyTranscript) {
        console.info('Online STT empty transcript:', { provider, url })
        lastError.value = 'no-speech'
        return null
      }

      const compactBody = String(rawBody || '').replace(/\s+/g, ' ').trim().slice(0, 260)
      console.warn('Online STT invalid response payload:', {
        provider,
        url,
        body: compactBody || '(empty)'
      })
      if (provider === STT_PROVIDER_SILICONFLOW) {
        console.warn('SiliconFlow STT hint: endpoint should be https://api.siliconflow.cn/v1/audio/transcriptions')
      }
      lastError.value = 'invalid-response'
      return null
    }
    lastError.value = ''
    return text
  } catch (err) {
    console.warn('Online STT fetch error:', err)
    lastError.value = 'network-error'
    return null
  }
}

function startRecording() {
  if (!mediaStream || !mediaRecorder) return false
  if (mediaRecorder.state === 'recording') return true
  audioChunks = []
  recordStart = Date.now()
  isSpeaking = false
  silenceStart = 0
  speechActivityFrames = 0
  hasSpeechActivity = false
  speechActivityMs = 0
  speechStrongFrames = 0

  try {
    mediaRecorder.start()
    return true
  } catch (err) {
    console.warn('Online STT MediaRecorder.start() failed:', err)
    lastError.value = 'invalid-state'
    return false
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function startRecordingWithRetry() {
  for (let attempt = 1; attempt <= RECORDER_START_MAX_ATTEMPTS; attempt++) {
    if (!isActive || isPaused) return false
    const started = startRecording()
    if (started) return true
    if (lastError.value !== 'invalid-state' || attempt >= RECORDER_START_MAX_ATTEMPTS) {
      return false
    }
    await wait(RECORDER_START_RETRY_DELAY_MS)
  }
  return false
}

async function restartRecordingIfActive() {
  if (!isActive || isPaused) return true
  const started = await startRecordingWithRetry()
  if (!started) {
    isListening.value = false
  }
  return started
}

function hasEnoughAutoSpeech(duration) {
  if (currentTriggerMode === 'manual') return true
  if (!hasSpeechActivity) return false
  if (duration < MIN_RECORD_DURATION_AUTO) return false
  if (speechStrongFrames >= AUTO_MIN_STRONG_FRAMES && speechActivityMs >= AUTO_MIN_ACTIVITY_MS) {
    return true
  }
  return speechActivityMs >= 700
}

async function stopAndSend() {
  if (isSendingSegment) return
  const recorder = mediaRecorder
  if (!recorder || recorder.state === 'inactive') return
  isSendingSegment = true
  return new Promise(resolve => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data)
    }
    recorder.onstop = async () => {
      try {
        const duration = Date.now() - recordStart
        const minDuration = currentTriggerMode === 'manual' ? MIN_RECORD_DURATION_MANUAL : MIN_RECORD_DURATION
        if (duration < minDuration || audioChunks.length === 0) {
          if (currentTriggerMode === 'manual') {
            lastError.value = 'no-speech'
          }
          await restartRecordingIfActive()
          resolve()
          return
        }
        if (currentTriggerMode !== 'manual' && !hasEnoughAutoSpeech(duration)) {
          lastError.value = ''
          audioChunks = []
          await restartRecordingIfActive()
          resolve()
          return
        }
        const blob = new Blob(audioChunks, { type: recorder.mimeType || 'audio/webm' })
        audioChunks = []

        interimTranscript.value = '识别中...'
        const text = await sendAudioToSTT(blob)
        interimTranscript.value = ''

        if (text) {
          transcript.value = text
          if (onResultCb) onResultCb(text)
        }

        await restartRecordingIfActive()
        resolve()
      } finally {
        isSendingSegment = false
      }
    }
    try { recorder.stop() } catch {
      isSendingSegment = false
      resolve()
    }
  })
}

function startVAD() {
  if (currentTriggerMode === 'manual') return
  if (!analyserNode) return
  vadInterval = setInterval(() => {
    if (!analyserNode || isPaused || isSendingSegment) return
    const rms = getRMS(analyserNode)
    const now = Date.now()
    const duration = recordStart ? (now - recordStart) : 0

    if (rms > SILENCE_THRESHOLD) {
      if (!isSpeaking) isSpeaking = true
      speechActivityFrames = Math.min(speechActivityFrames + 2, MIN_ACTIVITY_FRAMES + 2)
      hasSpeechActivity = true
      speechActivityMs += VAD_CHECK_INTERVAL
      speechStrongFrames = Math.min(speechStrongFrames + 1, AUTO_MIN_STRONG_FRAMES + 6)
      silenceStart = 0
    } else if (rms > ACTIVITY_THRESHOLD) {
      speechActivityFrames = Math.min(speechActivityFrames + 1, MIN_ACTIVITY_FRAMES + 2)
      if (speechActivityFrames >= MIN_ACTIVITY_FRAMES) {
        hasSpeechActivity = true
        speechActivityMs += VAD_CHECK_INTERVAL
      }
      silenceStart = 0
    } else {
      speechActivityFrames = Math.max(0, speechActivityFrames - 1)
      if (hasSpeechActivity) {
        if (!silenceStart) {
          silenceStart = now
        } else if (now - silenceStart > SILENCE_TIMEOUT && duration >= MIN_RECORD_DURATION) {
          isSpeaking = false
          silenceStart = 0
          void stopAndSend()
          return
        }
      }
    }

    if (hasSpeechActivity && duration >= AUTO_SEGMENT_MAX_DURATION) {
      isSpeaking = false
      silenceStart = 0
      void stopAndSend()
    }
  }, VAD_CHECK_INTERVAL)
}

export function useOnlineSTT() {
  async function start(options = {}) {
    const { onResult, triggerMode } = options
    onResultCb = onResult || null

    stop()
    isPaused = false
    isActive = true
    currentTriggerMode = String(triggerMode || '').trim() === 'manual' ? 'manual' : 'auto'
    currentLang = String(options.lang || '').trim()
    transcript.value = ''
    interimTranscript.value = ''
    lastError.value = ''

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const name = err?.name || ''
      if (name === 'NotAllowedError') lastError.value = 'not-allowed'
      else if (name === 'NotFoundError') lastError.value = 'audio-capture'
      else lastError.value = 'unknown'
      isActive = false
      return false
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const source = audioContext.createMediaStreamSource(mediaStream)
    inputGainNode = audioContext.createGain()
    inputGainNode.gain.value = ONLINE_STT_INPUT_GAIN
    recordingDestination = typeof audioContext.createMediaStreamDestination === 'function'
      ? audioContext.createMediaStreamDestination()
      : null
    analyserNode = audioContext.createAnalyser()
    analyserNode.fftSize = 2048
    source.connect(inputGainNode)
    inputGainNode.connect(analyserNode)
    if (recordingDestination) {
      inputGainNode.connect(recordingDestination)
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
    const recorderStream = recordingDestination?.stream?.getAudioTracks?.().length
      ? recordingDestination.stream
      : mediaStream
    mediaRecorder = new MediaRecorder(recorderStream, mimeType ? { mimeType } : {})

    const started = await startRecordingWithRetry()
    if (!started) {
      isListening.value = false
      isActive = false
      cleanup()
      return false
    }
    isListening.value = true
    startVAD()
    return true
  }

  function stop() {
    isActive = false
    isPaused = false
    isListening.value = false
    interimTranscript.value = ''
    onResultCb = null
    currentTriggerMode = 'auto'
    currentLang = ''
    cleanup()
  }

  function pause() {
    if (!isActive || isPaused) return false
    isPaused = true
    isListening.value = false
    interimTranscript.value = ''
    if (vadInterval) { clearInterval(vadInterval); vadInterval = null }
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try { mediaRecorder.stop() } catch {}
    }
    audioChunks = []
    return true
  }

  async function resume() {
    if (!isActive || !isPaused) return false
    isPaused = false
    lastError.value = ''
    const started = await startRecordingWithRetry()
    if (!started) {
      isListening.value = false
      return false
    }
    isListening.value = true
    startVAD()
    return true
  }

  async function triggerRecognition() {
    if (!isActive || isPaused || !mediaRecorder) return false
    if (mediaRecorder.state !== 'recording') {
      const started = await startRecordingWithRetry()
      if (!started) return false
    }
    await stopAndSend()
    return true
  }

  async function requestMicrophonePermission() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      lastError.value = 'unsupported'
      return { ok: false, error: 'unsupported' }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      lastError.value = ''
      return { ok: true, error: '' }
    } catch (err) {
      const name = err?.name || ''
      const error = name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture'
      lastError.value = error
      return { ok: false, error }
    }
  }

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    lastError,
    start,
    stop,
    pause,
    resume,
    triggerRecognition,
    requestMicrophonePermission
  }
}
