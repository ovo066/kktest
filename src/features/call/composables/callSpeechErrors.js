export const STT_BLOCKING_ERRORS = new Set([
  'not-allowed',
  'service-not-allowed',
  'audio-capture',
  'insecure-context',
  'unsupported',
  'network',
  'language-not-supported',
  'bad-grammar',
  'no-endpoint',
  'api-error',
  'network-error',
  'invalid-response'
])

const STT_ERROR_TOAST_COOLDOWN_MS = 5000

export function formatSTTErrorMessage(error, options = {}) {
  const isManualSTTTriggerMode = Boolean(options.isManualSTTTriggerMode)
  const currentEngineType = String(options.currentEngineType || '').trim()

  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风权限被拒绝，请在浏览器设置里允许麦克风后重试'
    case 'audio-capture':
      return '未检测到可用麦克风，请检查设备或系统麦克风权限'
    case 'insecure-context':
      return '浏览器语音识别仅支持 HTTPS 或 localhost，请改用 localhost/https'
    case 'unsupported':
      return '当前浏览器不支持此语音识别模式，请改用 Chrome/Edge 或文本输入'
    case 'invalid-state':
      return '语音识别引擎启动冲突，已自动重试；若仍失败请重开通话'
    case 'network':
      return '浏览器语音识别服务网络异常，请检查网络后重试'
    case 'no-speech':
      return isManualSTTTriggerMode
        ? '未检测到可识别语音，请先点开始识别并完整说一句后再发送'
        : '这段语音里没有识别到清晰内容，请靠近麦克风并完整说一句'
    case 'language-not-supported':
      return '当前浏览器不支持所选识别语言，请尝试切换系统语言或浏览器'
    case 'bad-grammar':
      return '浏览器语音识别内部错误，请重试或改用其他 STT 引擎'
    case 'no-endpoint':
      return '在线 STT 接口地址为空，请先在设置里填写接口地址'
    case 'api-error':
      return '在线 STT 返回错误，请检查服务商、接口地址、模型名和密钥（SiliconFlow 建议使用 https://api.siliconflow.cn/v1/audio/transcriptions）'
    case 'wrong-endpoint':
      return '当前填写的是错误接口。SiliconFlow STT 请使用 https://api.siliconflow.cn/v1/audio/transcriptions，不要填 MiniMax 的 t2a_v2'
    case 'network-error':
      return '在线 STT 请求失败（Failed to fetch），请检查网络、代理和跨域'
    case 'invalid-response':
      return '在线 STT 返回了无法识别的格式。若使用 SiliconFlow，请确认接口是 https://api.siliconflow.cn/v1/audio/transcriptions，且不是聊天接口'
    default:
      return currentEngineType === 'online'
        ? '在线 STT 启动失败，请检查接口配置后重试'
        : '语音识别启动失败，请改用文本输入或更换 STT 引擎'
  }
}

export function createSTTErrorNotifier(options = {}) {
  const showToast = typeof options.showToast === 'function' ? options.showToast : () => {}
  const getCurrentEngineType = typeof options.getCurrentEngineType === 'function'
    ? options.getCurrentEngineType
    : () => ''
  const isManualSTTTriggerMode = typeof options.isManualSTTTriggerMode === 'function'
    ? options.isManualSTTTriggerMode
    : () => false

  let lastSTTToastKey = ''
  let lastSTTToastAt = 0

  return function notifySTTError(error) {
    const key = String(error || '').trim()
    if (!key) return

    const now = Date.now()
    if (key === lastSTTToastKey && now - lastSTTToastAt < STT_ERROR_TOAST_COOLDOWN_MS) return

    lastSTTToastKey = key
    lastSTTToastAt = now

    showToast(formatSTTErrorMessage(key, {
      currentEngineType: getCurrentEngineType(),
      isManualSTTTriggerMode: isManualSTTTriggerMode()
    }), 3600)
  }
}
