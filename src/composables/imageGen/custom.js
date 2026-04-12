import { createFetchControl, isAbortError } from './fetchControl'

function getNestedValue(obj, path) {
  return String(path || '')
    .split(/[.\[\]]/)
    .filter(Boolean)
    .reduce((o, k) => o?.[k], obj)
}

export async function generateCustom(prompt, config = {}, options = {}) {
  const { endpoint, apiKey, requestTemplate, responsePath } = config || {}
  if (!endpoint) throw new Error('自定义 API 地址未设置')

  let bodyStr = requestTemplate || '{"prompt": "{{prompt}}"}'
  bodyStr = bodyStr.replace(/\{\{prompt\}\}/g, String(prompt).replace(/"/g, '\\"'))
  if (options.negativePrompt) {
    bodyStr = bodyStr.replace(/\{\{negative_prompt\}\}/g, String(options.negativePrompt).replace(/"/g, '\\"'))
  }

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey

  const fetchControl = createFetchControl(options.signal, options.timeoutMs)
  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: bodyStr,
      signal: fetchControl.signal
    })
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (fetchControl.isTimedOut()) {
      throw new Error(`自定义 API 请求超时（${fetchControl.timeoutMs}ms）`)
    }
    if (isAbortError(e)) {
      throw new Error('自定义 API 请求已取消')
    }
    throw new Error('自定义 API 请求失败: ' + msg)
  } finally {
    fetchControl.cleanup()
  }

  if (!res.ok) throw new Error('自定义 API 失败: HTTP ' + res.status)
  const data = await res.json()

  const path = responsePath || 'images[0]'
  const imageData = getNestedValue(data, path)
  if (!imageData) throw new Error('无法从响应中提取图片')

  if (typeof imageData === 'string') {
    if (imageData.startsWith('http')) return imageData
    if (imageData.startsWith('data:')) return imageData
    return `data:image/png;base64,${imageData}`
  }

  throw new Error('自定义 API 图片字段不是字符串')
}

