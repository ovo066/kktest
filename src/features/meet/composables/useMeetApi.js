// @ts-check

/** @typedef {import('./meetInstructionContracts').MeetApiResult} MeetApiResult */
/** @typedef {import('./meetInstructionContracts').MeetApiMessage} MeetApiMessage */
/** @typedef {import('./meetInstructionContracts').MeetCharacterRef} MeetCharacterRef */
/** @typedef {import('./meetInstructionContracts').MeetInstruction} MeetInstruction */

import { useConfigsStore } from '../../../stores/configs'
import { useMeetStore } from '../../../stores/meet'
import { useContactsStore } from '../../../stores/contacts'
import { usePersonasStore } from '../../../stores/personas'
import { applyOptionalMaxTokens } from '../../../composables/api/chatCompletions'
import { createApiError, createApiFailureResult } from '../../../composables/api/errors'
import { fetchOpenAICompat, readOpenAICompatError } from '../../../composables/api/openaiCompat'
import { consumeChatCompletionsStream } from '../../../composables/api/stream'
import { useMeetParser } from './useMeetParser'

export function useMeetApi() {
  const configsStore = useConfigsStore()
  const meetStore = useMeetStore()
  const contactsStore = useContactsStore()
  const personasStore = usePersonasStore()
  const { parse } = useMeetParser()

  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [context]
   * @returns {MeetApiResult}
   */
  function buildFailure(code, message, context = {}) {
    return /** @type {MeetApiResult} */ (createApiFailureResult(
      createApiError(code, message, context),
      { context }
    ))
  }

  function escapeAttr(text) {
    return String(text || '').replace(/"/g, '\'')
  }

  function getActivePromptEntries(preset) {
    if (!Array.isArray(preset?.promptEntries)) return []
    return preset.promptEntries
      .map((entry, idx) => ({
        ...entry,
        _idx: idx,
        role: ['system', 'user', 'assistant'].includes(String(entry?.role || '').toLowerCase())
          ? String(entry.role).toLowerCase()
          : 'system',
        content: typeof entry?.content === 'string' ? entry.content.trim() : '',
        order: Number.isFinite(Number(entry?.order)) ? Number(entry.order) : idx,
        injectionDepth: Number.isFinite(Number(entry?.injectionDepth)) ? Number(entry.injectionDepth) : 0
      }))
      .filter(entry => entry.enabled !== false && entry.content)
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order
        if (a.injectionDepth !== b.injectionDepth) return a.injectionDepth - b.injectionDepth
        return a._idx - b._idx
      })
  }

  function cleanPrompt(prompt) {
    if (!prompt) return ''
    return String(prompt)
      .replace(/你正在.*?手机聊天.*?\n?/g, '')
      .replace(/输出规则[：:][\s\S]*?(?=\n\n|$)/g, '')
      .replace(/每一行必须.*?\n?/g, '')
      .replace(/心理描写.*?包裹.*?\n?/g, '')
      .replace(/不要输出说明.*?\n?/g, '')
      .replace(/不要代替.*?发言.*?\n?/g, '')
      .replace(/保持口语化.*?\n?/g, '')
      .replace(/引用回复.*?\n?/g, '')
      .replace(/\[quote.*?\].*?\n?/g, '')
      .trim()
  }

  /**
   * @param {unknown} value
   * @returns {MeetApiMessage | null}
   */
  function normalizeMeetContextMessage(value) {
    if (!value || typeof value !== 'object') return null
    const row = /** @type {Record<string, unknown>} */ (value)
    const roleText = String(row.role || '').toLowerCase()
    const content = typeof row.content === 'string' ? row.content : ''
    if (!content) return null
    if (roleText !== 'system' && roleText !== 'user' && roleText !== 'assistant') return null
    return {
      role: roleText,
      content
    }
  }

  function buildMeetSystemPrompt() {
    const meeting = meetStore.currentMeeting
    if (!meeting) return ''

    const sections = []

    const preset = meeting.presetId
      ? meetStore.presets.find(p => p.id === meeting.presetId)
      : null

    sections.push(`<meet_director>
你是约会模拟器导演，驱动沉浸感的恋爱互动场景。
注重玩家选择和好感度变化，每一轮都让玩家做出有意义的互动决定。
输出 2-5 个互动回合，必须以玩家选择 [choices] 结束。不要替玩家做决定。
</meet_director>`)

    if (preset?.systemPrompt) {
      sections.push(`<preset_system_prompt>
${preset.systemPrompt}
</preset_system_prompt>`)
    }

    const activePromptEntries = getActivePromptEntries(preset)
    if (activePromptEntries.length > 0) {
      const renderedEntries = activePromptEntries.map(entry => {
        const name = entry.name || entry.identifier || `entry_${entry._idx + 1}`
        return `<entry name="${escapeAttr(name)}" role="${entry.role}" depth="${entry.injectionDepth}">
${entry.content}
</entry>`
      }).join('\n\n')
      sections.push(`<preset_prompt_entries>
${renderedEntries}
</preset_prompt_entries>`)
    }

    if (meeting.worldSetting) {
      sections.push(`<world_setting>
${meeting.worldSetting}
</world_setting>`)
    }

    if (meeting.location) {
      sections.push(`<initial_location>${meeting.location}</initial_location>`)
    }

    const charSections = (meeting.characters || []).map(char => {
      const contact = (contactsStore.contacts || []).find(c => c.id === char.contactId)
      const persona = personasStore.getPersonaForContact(char.contactId)

      let description = char.vnDescription || ''
      if (!description && contact?.prompt) description = cleanPrompt(contact.prompt)
      if (!description && persona?.description) description = persona.description

      const expressions = []
      const prefix = char.contactId + '_'
      const sprites = meeting.resources?.sprites || {}
      Object.keys(sprites).forEach(key => {
        if (key.startsWith(prefix)) expressions.push(key.replace(prefix, ''))
      })

      return `### ${char.vnName} (${char.role || 'support'})
${description}
可用表情: ${expressions.length > 0 ? expressions.join(', ') : 'normal'}`
    })

    if (charSections.length > 0) {
      sections.push(`<characters>
${charSections.join('\n\n')}
</characters>`)
    }

    const bgNames = Object.keys(meeting.resources?.backgrounds || {})
    const cgNames = Object.keys(meeting.resources?.cgs || {})
    const bgmNames = Object.keys(meeting.resources?.bgm || {})
    const sfxNames = Object.keys(meeting.resources?.sfx || {})
    sections.push(`<available_resources>
背景: ${bgNames.length > 0 ? bgNames.join(', ') : '(暂无, 请用 [bg:NEW:...] 创建)'}
CG: ${cgNames.length > 0 ? cgNames.join(', ') : '(暂无, 关键节点可用 [cg:NEW:...] 生成)'}
BGM: ${bgmNames.length > 0 ? bgmNames.join(', ') : '(暂无)'}
SFX: ${sfxNames.length > 0 ? sfxNames.join(', ') : '(暂无)'}
</available_resources>`)

    const vars = meeting.variables || {}
    if (Object.keys(vars).length > 0) {
      sections.push(`<story_variables>
${JSON.stringify(vars, null, 2)}
</story_variables>`)
    }

    sections.push(`<output_format>
指令格式（每条占一行）：
[bg:背景名] 或 [bg:NEW:名:英文提示词]
[cg:CG名] 或 [cg:NEW:名:英文提示词] 或 [cg:off]
[sprite:角色:位置:表情] 或 [sprite:角色:位置:NEW:表情:提示词]
[sprite:角色:none:fadeOut]
[location:地点] [time:时段] [mood:角色:+1] [var:名:值] [bgm:名] [sfx:音效名]
[bgm:stop] [sfx:stop]

位置: left | center | right | none
动画: fadeIn | slideLeft | slideRight | slideUp | bounce | shake | jump | nod | fadeOut

对话：[角色名] 对话内容（方括号包角色名，空格后是内容，不要用冒号分隔）
旁白：*星号包裹的描写文字*

选择：
[choices]
- 选项文字 -> 影响
[/choices]

规则：
1. 每轮必须以 [choices] 结束，提供 2-4 个有意义的互动选项
2. 场景变化（地点/时段）要更新 [bg:]；并尽量设置/切换 [bgm:]（若有可用 BGM）
3. 生图提示词用英文，背景加 "no characters, background only"，立绘加 "upper body, character sprite, white background"
4. 适时用 [mood:] 反映好感度变化
5. [cg:] 只能用于关键剧情节点（告白、冲突、反转、高潮），避免频繁使用；使用后应在 1-3 条对话/旁白内用 [cg:off] 回到常规演出
6. CG 显示期间不要继续堆叠新的立绘切换；回到普通对话演出后再继续 [sprite:]
7. 不要输出格式以外的说明文字
</output_format>`)

    if (preset?.jailbreakPrompt) {
      sections.push(`<jailbreak>
${preset.jailbreakPrompt}
</jailbreak>`)
    }

    return sections.join('\n\n')
  }

  /**
   * @param {string} [userInput]
   * @returns {MeetApiMessage[]}
   */
  function buildMeetMessages(userInput) {
    const meeting = meetStore.currentMeeting
    if (!meeting) return []

    const systemPrompt = buildMeetSystemPrompt()
    /** @type {MeetApiMessage[]} */
    const messages = [{ role: 'system', content: systemPrompt }]

    if (Array.isArray(meeting.llmContext)) {
      meeting.llmContext.slice(-20).forEach((entry) => {
        const message = normalizeMeetContextMessage(entry)
        if (message) messages.push(message)
      })
    }

    if (userInput) messages.push({ role: 'user', content: userInput })
    return messages
  }

  /**
   * @param {string} [userInput]
   * @param {{
   *   configId?: string,
   *   onStream?: (fullText: string) => void,
   *   onInstructions?: (instructions: MeetInstruction[]) => void
   * }} [options]
   * @returns {Promise<MeetApiResult>}
   */
  async function callMeetApi(userInput, options = {}) {
    const meeting = meetStore.currentMeeting
    if (!meeting) {
      return buildFailure('MEETING_NOT_FOUND', '没有活动的见面', {
        feature: 'meet',
        action: 'callMeetApi'
      })
    }

    const preset = meeting.presetId
      ? meetStore.presets.find(p => p.id === meeting.presetId)
      : null

    const cfg = options.configId
      ? (configsStore.configs || []).find(c => c.id === options.configId)
      : configsStore.getConfig

    if (!cfg?.key) {
      return buildFailure('CONFIG_MISSING', '请先配置 API Key', {
        feature: 'meet',
        action: 'callMeetApi',
        meetingId: meeting.id || null
      })
    }

    meetStore.player.isGenerating = true

    try {
      const messages = buildMeetMessages(userInput)

      const body = {
        model: cfg.model,
        messages,
        stream: true
      }
      applyOptionalMaxTokens(body, cfg.maxTokens, preset?.maxTokens)
      if (preset?.temperature != null) body.temperature = preset.temperature
      if (preset?.topP != null && preset.topP !== 1) body.top_p = preset.topP
      if (preset?.frequencyPenalty) body.frequency_penalty = preset.frequencyPenalty
      if (preset?.presencePenalty) body.presence_penalty = preset.presencePenalty

      const { response: res } = await fetchOpenAICompat(cfg.url, {
        apiKey: cfg.key,
        body
      })

      if (!res.ok) {
        throw new Error(await readOpenAICompatError(res))
      }

      let fullText = ''
      await consumeChatCompletionsStream(res, (delta) => {
        fullText += delta
        options.onStream?.(fullText)
      })

      if (userInput) meeting.llmContext.push({ role: 'user', content: userInput })
      meeting.llmContext.push({ role: 'assistant', content: fullText })
      if (meeting.llmContext.length > 40) {
        meeting.llmContext.splice(0, meeting.llmContext.length - 30)
      }

      const instructions = parse(fullText, { characters: /** @type {MeetCharacterRef[]} */ (meeting.characters || []) })
      options.onInstructions?.(instructions)
      return { success: true, instructions }
    } catch (e) {
      return /** @type {MeetApiResult} */ (createApiFailureResult(e, {
        context: {
          feature: 'meet',
          action: 'callMeetApi',
          meetingId: meeting.id || null
        }
      }))
    } finally {
      meetStore.player.isGenerating = false
    }
  }

  /**
   * @param {{
   *   resetState?: boolean,
   *   openingPrompt?: string,
   *   configId?: string,
   *   onStream?: (fullText: string) => void,
   *   onInstructions?: (instructions: MeetInstruction[]) => void
   * }} [options]
   * @returns {Promise<MeetApiResult>}
   */
  async function startMeeting(options = {}) {
    const meeting = meetStore.currentMeeting
    if (!meeting) {
      return buildFailure('MEETING_NOT_FOUND', '没有活动的见面', {
        feature: 'meet',
        action: 'startMeeting'
      })
    }

    const shouldResetState = options.resetState !== false
    if (shouldResetState) {
      meeting.llmContext = []
      meeting.history = []
      meeting.variables = {}
    }

    const openingPrompt = options.openingPrompt ||
      `开始约会。地点：${meeting.location || '咖啡厅'}。设置背景，让角色登场，开始第一轮互动。`

    return callMeetApi(openingPrompt, options)
  }

  /**
   * @param {string} choiceText
   * @param {{
   *   configId?: string,
   *   onStream?: (fullText: string) => void,
   *   onInstructions?: (instructions: MeetInstruction[]) => void
   * }} [options]
   * @returns {Promise<MeetApiResult>}
   */
  async function sendChoice(choiceText, options = {}) {
    return callMeetApi(`玩家选择了: "${choiceText}"\n继续约会互动。`, options)
  }

  /**
   * @param {string} text
   * @param {{
   *   configId?: string,
   *   onStream?: (fullText: string) => void,
   *   onInstructions?: (instructions: MeetInstruction[]) => void
   * }} [options]
   * @returns {Promise<MeetApiResult>}
   */
  async function sendInput(text, options = {}) {
    return callMeetApi(text, options)
  }

  return {
    buildMeetSystemPrompt,
    callMeetApi,
    startMeeting,
    sendChoice,
    sendInput
  }
}
