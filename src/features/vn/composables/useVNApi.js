import { useConfigsStore } from '../../../stores/configs'
import { useVNStore } from '../../../stores/vn'
import { useContactsStore } from '../../../stores/contacts'
import { usePersonasStore } from '../../../stores/personas'
import { applyOptionalMaxTokens } from '../../../composables/api/chatCompletions'
import { createApiError, createApiFailureResult } from '../../../composables/api/errors'
import { fetchOpenAICompat, readOpenAICompatError } from '../../../composables/api/openaiCompat'
import { runOpenAICompatTextStream } from '../../../composables/api/openaiCompatTextStream'
import { useVNParser } from './useVNParser'
import { useImageGen } from '../../../composables/useImageGen'

export function useVNApi() {
  const configsStore = useConfigsStore()
  const vnStore = useVNStore()
  const contactsStore = useContactsStore()
  const personasStore = usePersonasStore()
  const { parse, extractNewResources } = useVNParser()
  const { generateBackground, generateSprite } = useImageGen()

  function buildFailure(code, message, context = {}, options = {}) {
    return createApiFailureResult(
      createApiError(code, message, context, options),
      { context }
    )
  }

  function cleanPromptForVN(prompt) {
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

  function buildVNSystemPrompt() {
    const project = vnStore.currentProject
    if (!project) return ''

    const sections = []

    sections.push(`<vn_director>
你是一个专业的视觉小说/Galgame AI 导演。
你负责根据世界观设定、角色设定和玩家互动，生成沉浸式的剧情场景。
你的输出将被解析为视觉小说引擎指令，请严格遵循输出格式。
</vn_director>`)

    if (project.worldSetting) {
      sections.push(`<world_setting>
${project.worldSetting}
</world_setting>`)
    }

    const charSections = (project.characters || []).map(char => {
      const contact = (contactsStore.contacts || []).find(c => c.id === char.contactId)
      const persona = personasStore.getPersonaForContact(char.contactId)

      let description = char.vnDescription || ''
      if (!description && contact?.prompt) description = cleanPromptForVN(contact.prompt)
      if (!description && persona?.description) description = persona.description

      const expressions = []
      const prefix = char.contactId + '_'
      const sprites = project.resources?.sprites || {}
      Object.keys(sprites).forEach(key => {
        if (key.startsWith(prefix)) expressions.push(key.replace(prefix, ''))
      })

      return `### ${char.vnName} (${char.role || 'support'})
${description}
可用表情: ${expressions.length > 0 ? expressions.join(', ') : 'normal'}`
    })

    sections.push(`<characters>
${charSections.join('\n\n')}
</characters>`)

    const bgNames = Object.keys(project.resources?.backgrounds || {})
    const bgmNames = Object.keys(project.resources?.bgm || {})
    sections.push(`<available_resources>
背景: ${bgNames.length > 0 ? bgNames.join(', ') : '(暂无, 请用 [bg:NEW:...] 创建)'}
BGM: ${bgmNames.length > 0 ? bgmNames.join(', ') : '(暂无)'}
</available_resources>`)

    const vars = project.variables || {}
    if (Object.keys(vars).length > 0) {
      sections.push(`<story_variables>
${JSON.stringify(vars, null, 2)}
</story_variables>`)
    }

    sections.push(`<output_format>
请严格使用以下格式输出，每条指令占一行：

## 背景切换
[bg:背景名]                                    使用已有背景
[bg:NEW:背景名:英文生图提示词]                    需要新背景时

## 角色立绘
[sprite:角色名:位置:表情名]                      使用已有表情
[sprite:角色名:位置:表情名:动画]                  带入场动画
[sprite:角色名:位置:NEW:表情名:英文生图提示词]     需要新表情时
[sprite:角色名:none:fadeOut]                     角色退场

位置: left | center | right | none(退场)
动画: fadeIn | slideLeft | slideRight | slideUp | bounce | shake | jump | nod | fadeOut (可选)

## BGM 背景音乐
[bgm:音乐名]                                    播放已有BGM
[bgm:stop]                                      停止BGM

## 对话
角色名：对话内容

## 旁白/心理描写
*用星号包裹的文字*

## 玩家选择
[choices]
- 选项文本 -> 简短影响描述
- 选项文本 -> 简短影响描述
[/choices]

## 变量更新 (当选项或剧情需要修改数值时)
[var:变量名:值]                                  设置变量
[var:变量名:+1]                                  增加变量

## 重要规则
1. 每次输出 3-8 个对话回合，保持节奏
2. 角色言行必须符合人设
3. 优先使用已有背景和表情，减少 NEW 请求
4. 生图提示词必须用英文，包含 anime style
5. 背景提示词加 "no characters, background only"
6. 立绘提示词加 "upper body, character sprite, white background"
7. 选项应有意义地影响后续剧情
8. 不要输出格式以外的任何说明文字
9. BGM 只在场景氛围变化时使用，不要频繁切换
</output_format>`)

    return sections.join('\n\n')
  }

  function buildVNMessages(userInput) {
    const project = vnStore.currentProject
    if (!project) return []

    const systemPrompt = buildVNSystemPrompt()
    const messages = [{ role: 'system', content: systemPrompt }]

    const context = (project.llmContext || []).slice(-20)
    messages.push(...context)

    if (userInput) messages.push({ role: 'user', content: userInput })
    return messages
  }

  async function callVNApi(userInput, options = {}) {
    const project = vnStore.currentProject
    if (!project) {
      return buildFailure('PROJECT_NOT_FOUND', '没有活动的 VN 项目', {
        feature: 'vn',
        action: 'callVNApi'
      })
    }

    const cfg = options.configId
      ? (configsStore.configs || []).find(c => c.id === options.configId)
      : configsStore.getConfig

    if (!cfg?.key) {
      return buildFailure('CONFIG_MISSING', '请先配置 API Key', {
        feature: 'vn',
        action: 'callVNApi',
        projectId: project.id || null
      })
    }

    vnStore.player.isGenerating = true

    try {
      const messages = buildVNMessages(userInput)
      const body = {
        model: cfg.model,
        messages,
        stream: true
      }
      applyOptionalMaxTokens(body, cfg.maxTokens)

      const { text: fullText } = await runOpenAICompatTextStream({
        cfg,
        body,
        onText(text) {
          options.onStream?.(text)
        }
      })

      if (userInput) project.llmContext.push({ role: 'user', content: userInput })
      project.llmContext.push({ role: 'assistant', content: fullText })
      if (project.llmContext.length > 40) {
        project.llmContext.splice(0, project.llmContext.length - 30)
      }

      const instructions = parse(fullText, { characters: project.characters || [] })
      const newResources = extractNewResources(instructions)

      if ((newResources.backgrounds?.length || 0) > 0 || (newResources.sprites?.length || 0) > 0) {
        handleNewResources(newResources).catch(e => console.warn('资源生成失败:', e))
      }

      options.onInstructions?.(instructions)
      return { success: true, instructions }
    } catch (e) {
      return createApiFailureResult(e, {
        context: {
          feature: 'vn',
          action: 'callVNApi',
          projectId: project.id || null
        }
      })
    } finally {
      vnStore.player.isGenerating = false
    }
  }

  async function handleNewResources(newResources) {
    vnStore.player.isGeneratingImage = true
    try {
      for (const bg of (newResources.backgrounds || [])) {
        try { await generateBackground(bg.name, bg.prompt) } catch (e) { console.warn('背景生成失败:', bg.name, e) }
      }
      for (const sp of (newResources.sprites || [])) {
        const char = vnStore.currentProject?.characters?.find(
          c => c.contactId === sp.characterId || c.vnName === sp.vnName
        )
        if (!char) continue
        try { await generateSprite(char, sp.expression) } catch (e) { console.warn('立绘生成失败:', sp.vnName, sp.expression, e) }
      }
    } finally {
      vnStore.player.isGeneratingImage = false
    }
  }

  async function analyzeResourceNeeds() {
    const project = vnStore.currentProject
    if (!project) return null

    const cfg = configsStore.getConfig
    if (!cfg?.key) return null

    const charDescriptions = (project.characters || []).map(char => {
      const contact = (contactsStore.contacts || []).find(c => c.id === char.contactId)
      return `${char.vnName}: ${char.vnDescription || contact?.prompt || '(无描述)'}`
    }).join('\n')

    const prompt = `根据以下视觉小说项目设定，分析需要预先生成的图像资源。

## 世界观
${project.worldSetting}

## 角色
${charDescriptions}

请输出 JSON 格式（不要用代码块包裹，直接输出纯 JSON）：
{
  "backgrounds": [
    { "name": "场景简称_时间段", "prompt": "英文生图提示词, anime style, detailed background, no characters, high quality" }
  ],
  "sprites": {
    "角色名": {
      "basePrompt": "角色的英文外貌描述, anime style, upper body, character sprite, white background",
      "expressions": ["normal", "happy", "sad", "angry", "surprised", "shy"]
    }
  }
}

要求：
1. 背景 5-10 个，覆盖主要场景和不同时间段
2. 每个角色 6-8 个表情
3. 提示词必须是英文，描述要详细具体
4. 背景提示词加 "anime style, detailed background, no characters"
5. 立绘 basePrompt 要详细描述外貌特征（发型、发色、眼色、服装等）`

    const body = {
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }]
    }
    applyOptionalMaxTokens(body, cfg.maxTokens)

    const { response: res } = await fetchOpenAICompat(cfg.url, {
      apiKey: cfg.key,
      body
    })

    if (!res.ok) throw new Error(`分析失败: ${await readOpenAICompatError(res)}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''

    try {
      const jsonStr = String(text).replace(/^```json?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
      return JSON.parse(jsonStr)
    } catch {
      console.warn('资源分析 JSON 解析失败, 原始文本:', text)
      return null
    }
  }

  async function startStory(options = {}) {
    const project = vnStore.currentProject
    if (!project) {
      return buildFailure('PROJECT_NOT_FOUND', '没有活动的 VN 项目', {
        feature: 'vn',
        action: 'startStory'
      })
    }

    project.llmContext = []
    project.history = []
    project.variables = {}

    const openingPrompt = options.openingPrompt ||
      '请开始剧情。设置初始场景，介绍背景，让第一个角色登场并开始对话。'

    return callVNApi(openingPrompt, options)
  }

  async function sendChoice(choiceText, options = {}) {
    const prompt = `玩家选择了: "${choiceText}"\n请根据玩家的选择继续剧情。`
    return callVNApi(prompt, options)
  }

  async function sendInput(text, options = {}) {
    return callVNApi(text, options)
  }

  return {
    buildVNSystemPrompt,
    callVNApi,
    analyzeResourceNeeds,
    startStory,
    sendChoice,
    sendInput
  }
}
