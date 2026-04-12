/**
 * 通话 API 调用
 * 简化版的 prompt 构建 + 流式响应，复用现有 stream 消费器
 */
import { useContactsStore } from '../../../stores/contacts'
import { useConfigsStore } from '../../../stores/configs'
import { useSettingsStore } from '../../../stores/settings'
import { usePromptContext } from '../../../composables/api/promptContext'
import { createApiError, createApiFailureResult } from '../../../composables/api/errors'
import { applyOptionalMaxTokens } from '../../../composables/api/chatCompletions'
import { fetchOpenAICompat, readOpenAICompatError } from '../../../composables/api/openaiCompat'
import { getTemplateVars, applyTemplateVars, buildTimestampSystemPrompt } from '../../../composables/api/prompts'
import { consumeChatCompletionsStream } from '../../../composables/api/stream'
import { useCallState } from './useCallState'
import { makeId } from '../../../utils/id'

const CALL_SYSTEM_TEMPLATE = `你正在和{{user}}进行{{callType}}通话。你的角色是 {{char}}。

{{charPrompt}}

通话规则：
1. 口语化，像真实通话一样自然
2. 每次回复1-3句话，保持通话节奏感
3. 不要写动作描写或旁白
4. 用 [emotion:表情名] 标记当前情绪/表情（放在对话文本前）
5. 不要使用任何格式标记（如引号、括号等），直接说话
6. 如果对方沉默较久，可以主动找话题
7. 当你要主动结束通话时，在末尾附加 [call:end]
8. 当你要明确拒绝接听/继续通话时，在末尾附加 [call:reject:原因]
9. [call:*] 只是控制标签，不算对话正文

可用表情: normal, happy, sad, surprised, angry, shy, thinking, laughing, excited, worried, confused, love, sleepy`

const GREETING_INSTRUCTION = '\n\n这是通话刚接通的第一句话，请自然地打招呼。'
const SOLAR_FESTIVAL_MAP = {
  '1-1': '元旦',
  '2-14': '情人节',
  '3-8': '妇女节',
  '5-1': '劳动节',
  '6-1': '儿童节',
  '10-1': '国庆节',
  '12-24': '平安夜',
  '12-25': '圣诞节',
  '12-31': '跨年夜'
}
const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function buildCallDateHint(nowTs = Date.now()) {
  const now = new Date(nowTs)
  if (Number.isNaN(now.getTime())) return ''

  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekday = WEEKDAY_LABELS[now.getDay()] || ''
  const festival = SOLAR_FESTIVAL_MAP[`${month}-${day}`]
  const lines = []

  if (weekday) {
    lines.push(`今天是${month}月${day}日，${weekday}。`)
  }
  if (festival) {
    lines.push(`今天是${festival}。`)
  }

  return lines.join('\n')
}

export function useCallApi() {
  const contactsStore = useContactsStore()
  const configsStore = useConfigsStore()
  const settingsStore = useSettingsStore()
  const promptStore = usePromptContext()
  const { callMessages, callContactId, callMode } = useCallState()

  function buildFailure(code, message, context = {}, options = {}) {
    return {
      fullText: '',
      ...createApiFailureResult(
        createApiError(code, message, context, options),
        { context }
      )
    }
  }

  function buildCallSystemPrompt(contact, isGreeting = false) {
    const templateVars = getTemplateVars(promptStore, contact.name)
    const charPrompt = String(contact.prompt || '').trim()

    let prompt = CALL_SYSTEM_TEMPLATE
      .replace('{{callType}}', callMode.value === 'video' ? '视频' : '语音')
      .replace('{{charPrompt}}', charPrompt)

    prompt = applyTemplateVars(prompt, templateVars)

    if (isGreeting) {
      prompt += GREETING_INSTRUCTION
    }

    return prompt
  }

  function buildCallMessages(contact, userInput, isGreeting = false) {
    const systemPrompt = buildCallSystemPrompt(contact, isGreeting)
    const messages = [{ role: 'system', content: systemPrompt }]
    if (settingsStore.sendTimestampsToAI) {
      const timeline = [
        ...(Array.isArray(contact.msgs) ? contact.msgs : []),
        ...callMessages.value
      ]
      const timestampPrompt = buildTimestampSystemPrompt(timeline)
      const dateHint = buildCallDateHint()
      const contextLines = [timestampPrompt, dateHint].filter(Boolean)
      if (contextLines.length > 0) {
        messages.push({
          role: 'system',
          content: '<time_context>\n' + contextLines.join('\n') + '\n</time_context>'
        })
      }
    }

    // 添加最近的聊天历史作为上下文（最多10条）
    const recentChat = (contact.msgs || [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({
        role: m.role,
        content: String(m.content || '')
      }))

    if (recentChat.length > 0) {
      messages.push({
        role: 'system',
        content: '<recent_chat_context>\n以下是最近的聊天记录（作为对话背景参考）：\n' +
          recentChat.map(m => `${m.role === 'user' ? '用户' : '角色'}: ${m.content}`).join('\n') +
          '\n</recent_chat_context>'
      })
    }

    // 添加通话内的对话历史
    for (const msg of callMessages.value) {
      messages.push({ role: msg.role, content: msg.content })
    }

    // 添加当前用户输入
    if (userInput) {
      messages.push({ role: 'user', content: userInput })
    }

    return messages
  }

  /**
   * 发送通话消息并获取流式响应
   * @param {string} userInput - 用户输入的文本
   * @param {(delta: string) => void} onDelta - 流式回调
   * @param {Object} options - 选项
   * @returns {Promise<{ success: boolean, fullText: string, error?: string }>}
   */
  async function sendCallMessage(userInput, onDelta, options = {}) {
    const { isGreeting = false } = options
    const contactId = callContactId.value
    const contact = contactsStore.contacts.find(c => c.id === contactId)
    if (!contact) {
      return buildFailure('CALL_CONTACT_NOT_FOUND', '找不到联系人', {
        feature: 'call',
        action: 'sendCallMessage',
        contactId
      })
    }

    const cfg = configsStore.configs.find(c => c.id === contact.configId) || configsStore.getConfig
    if (!cfg?.key) {
      return buildFailure('CONFIG_MISSING', '请先配置 API Key', {
        feature: 'call',
        action: 'sendCallMessage',
        contactId
      })
    }

    // 记录用户消息（非问候时）
    if (userInput && !isGreeting) {
      callMessages.value.push({
        id: makeId('cmsg'),
        role: 'user',
        content: userInput,
        time: Date.now()
      })
    }

    const messages = buildCallMessages(contact, isGreeting ? null : userInput, isGreeting)

    try {
      const payload = {
        model: cfg.model,
        messages,
        stream: true,
        stream_options: { include_usage: true }
      }
      applyOptionalMaxTokens(payload, cfg.maxTokens)

      // 通话模式使用稍高的温度以增加自然感
      const temperature = Number(cfg.temperature)
      payload.temperature = Number.isFinite(temperature) ? temperature : 0.8

      const { response: res } = await fetchOpenAICompat(cfg.url, {
        apiKey: cfg.key,
        body: payload
      })

      if (!res.ok) {
        throw new Error(await readOpenAICompatError(res))
      }

      let fullText = ''
      await consumeChatCompletionsStream(res, (delta) => {
        fullText += delta
        if (onDelta) onDelta(delta)
      })

      if (!fullText.trim()) {
        return buildFailure('EMPTY_REPLY', '没有收到回复', {
          feature: 'call',
          action: 'sendCallMessage',
          contactId
        })
      }

      // 记录 AI 回复
      callMessages.value.push({
        id: makeId('cmsg'),
        role: 'assistant',
        content: fullText,
        time: Date.now()
      })

      return { success: true, fullText }
    } catch (e) {
      return {
        fullText: '',
        ...createApiFailureResult(e, {
          context: {
            feature: 'call',
            action: 'sendCallMessage',
            contactId
          }
        })
      }
    }
  }

  return {
    sendCallMessage
  }
}
