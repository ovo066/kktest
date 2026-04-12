/**
 * useReaderQuickAction: handles quick AI actions (explain / summarize / translate)
 * on selected text within the reader.
 */
import { useContactsStore } from '../../../stores/contacts'
import { useConfigsStore } from '../../../stores/configs'
import { useReaderStore } from '../../../stores/reader'
import { consumeChatCompletionsStream } from '../../../composables/api/stream'

const TRANSLATE_TARGETS = {
  auto: '请将以下文字翻译为中文（如已是中文则翻译为英文），保持原文风格。',
  zh: '请将以下文字翻译为中文，保持原文风格。',
  en: '请将以下文字翻译为英文，保持原文风格。',
  ja: '请将以下文字翻译为日文，保持原文风格。'
}

function getActionPrompts(translateTarget) {
  return {
    explain: '请简洁解释以下文字的含义。如有生僻词或典故请一并说明。',
    summarize: '请用1-2句话概括以下内容的核心要点。',
    translate: TRANSLATE_TARGETS[translateTarget] || TRANSLATE_TARGETS.auto
  }
}

const ACTION_LABELS = {
  explain: '解释',
  summarize: '总结',
  translate: '翻译'
}

function resolveConfig(configsStore, configId) {
  const byId = Array.isArray(configsStore.configs)
    ? configsStore.configs.find(c => c.id === configId)
    : null
  if (byId) return byId
  if (configsStore.getConfig && typeof configsStore.getConfig === 'object' && 'value' in configsStore.getConfig) {
    return configsStore.getConfig.value
  }
  return configsStore.getConfig || null
}

export { ACTION_LABELS }

export function useReaderQuickAction() {
  const contactsStore = useContactsStore()
  const configsStore = useConfigsStore()
  const readerStore = useReaderStore()
  const qa = readerStore.quickAction

  let abortController = null

  async function executeAction(action, selectedText, contextText) {
    const aiSettings = readerStore.readerAISettings
    const actionPrompts = getActionPrompts(aiSettings.translateTarget || 'auto')
    const prompt = actionPrompts[action]
    if (!prompt || !selectedText) return

    const contact = contactsStore.activeChat
    // Prefer quickActionConfigId if set, else fall back to contact/default
    const configId = aiSettings.quickActionConfigId || contact?.configId || configsStore.activeConfigId
    const config = resolveConfig(configsStore, configId)
    if (!config?.url || !config?.key) {
      qa.result = '（未配置 API，请先在设置中添加 API 配置）'
      qa.loading = false
      return
    }

    qa.visible = true
    qa.action = action
    qa.selectedText = selectedText
    qa.result = ''
    qa.loading = true

    abortController = new AbortController()

    const userContent = contextText
      ? `${selectedText}\n\n上下文：\n${contextText.slice(0, 800)}`
      : selectedText

    try {
      const url = config.url.replace(/\/+$/, '') + '/chat/completions'
      const body = {
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userContent }
        ],
        stream: true
      }
      if (config.temperature != null) body.temperature = config.temperature

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify(body),
        signal: abortController.signal
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText)
        qa.result = `（API 错误: ${response.status} ${String(errText).slice(0, 120)}）`
        return
      }

      await consumeChatCompletionsStream(response, (delta) => {
        qa.result += delta
      })
    } catch (err) {
      if (err?.name !== 'AbortError') {
        qa.result = `（请求失败: ${err?.message || 'unknown error'}）`
      }
    } finally {
      qa.loading = false
      abortController = null
    }
  }

  function cancel() {
    abortController?.abort()
    qa.loading = false
  }

  function close() {
    cancel()
    qa.visible = false
    qa.action = ''
    qa.selectedText = ''
    qa.result = ''
  }

  return {
    quickAction: qa,
    executeAction,
    cancel,
    close
  }
}

