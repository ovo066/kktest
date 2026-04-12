import { applyOptionalMaxTokens } from '../api/chatCompletions'

export async function callDecisionAPI(cfg, messages, {
  retries = 1,
  maxTokens = null,
  temperature = 0.8,
  timeoutMs = 12000
} = {}) {
  const url = (cfg.url || '').replace(/\/$/, '') + '/chat/completions'
  const payload = {
    model: cfg.model,
    messages,
    temperature,
    stream: false
  }
  applyOptionalMaxTokens(payload, cfg?.maxTokens, maxTokens)
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timeout = timeoutMs > 0
      ? setTimeout(() => {
        try { controller?.abort('decision_timeout') } catch { /* noop */ }
      }, timeoutMs)
      : null
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.key}`
        },
        body: JSON.stringify(payload),
        signal: controller?.signal
      })
      if (!res.ok) throw new Error(`Decision API ${res.status}`)
      const data = await res.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (e) {
      if (e?.name === 'AbortError') {
        lastErr = new Error('Decision API timeout')
      } else {
        lastErr = e
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1500))
      }
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }
  throw lastErr
}
