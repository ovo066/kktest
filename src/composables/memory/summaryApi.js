import { resolveOptionalMaxTokens } from '../api/chatCompletions'
import { clampNumber, getSummaryConfig, shortErrorText, wait } from './shared'

// 调用API生成总结/提取（静默，不影响聊天）
export async function callSummaryAPI(store, prompt, messages, contact, options = {}) {
  const cfg = getSummaryConfig(store, contact)
  if (!cfg?.key || !cfg?.url) {
    return { success: false, error: '未配置API' }
  }

  const maxRetries = clampNumber(options.maxRetries, 0, 3, 1)
  let lastError = '请求失败'

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      let url = cfg.url.replace(/\/$/, '')
      if (!url.endsWith('/chat/completions')) url += '/chat/completions'

      const customSysPrompt = String(contact?.memorySettings?.summarySystemPrompt || '').trim()
      const fullPrompt = customSysPrompt ? customSysPrompt + '\n\n' + prompt : prompt

      const apiMessages = [
        { role: 'system', content: fullPrompt },
        { role: 'user', content: messages }
      ]

      const temperature = clampNumber(options.temperature, 0, 2, 0.3)
      const maxTokens = resolveOptionalMaxTokens(cfg?.maxTokens, options.max_tokens)
      const payload = {
        model: cfg.model,
        messages: apiMessages,
        temperature
      }
      if (maxTokens !== null) {
        payload.max_tokens = maxTokens
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.key
        },
        body: JSON.stringify(payload)
      })

      const rawText = await res.text()
      let data = null
      if (rawText) {
        try {
          data = JSON.parse(rawText)
        } catch {
          const fallback = rawText.trim()
          if (res.ok && fallback && !fallback.startsWith('{') && !fallback.startsWith('[')) {
            return { success: true, content: fallback, finishReason: null, truncated: false, attempts: attempt + 1 }
          }
          const err = new Error('API 返回格式错误')
          err.retryable = true
          throw err
        }
      }

      if (!res.ok) {
        const errMsg = data?.error?.message || data?.message || `HTTP ${res.status}`
        const err = new Error(shortErrorText(errMsg, 200) || `HTTP ${res.status}`)
        err.retryable = res.status === 408 || res.status === 429 || res.status >= 500
        throw err
      }

      const finishReason = data?.choices?.[0]?.finish_reason || null
      if (finishReason === 'content_filter') {
        return {
          success: false,
          error: '内容被安全策略拦截，总结生成失败。可尝试在记忆设置中配置"总结系统提示词"或更换总结 API。',
          finishReason,
          attempts: attempt + 1
        }
      }

      const content = String(data?.choices?.[0]?.message?.content || '').trim()
      if (!content) {
        const err = new Error('返回内容为空')
        err.retryable = true
        throw err
      }

      return {
        success: true,
        content,
        finishReason,
        truncated: finishReason === 'length',
        attempts: attempt + 1
      }
    } catch (e) {
      lastError = shortErrorText(e?.message || e || '请求失败', 200) || '请求失败'
      const retryable = !!e?.retryable || /Failed to fetch|NetworkError|fetch failed|timeout|timed out|ECONN|ETIMEDOUT/i.test(String(e?.message || ''))
      if (attempt < maxRetries && retryable) {
        await wait(300 * (attempt + 1))
        continue
      }
      return { success: false, error: lastError, attempts: attempt + 1 }
    }
  }

  return { success: false, error: lastError }
}
