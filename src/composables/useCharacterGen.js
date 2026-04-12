import { fetchOpenAICompat, readOpenAICompatError } from './api/openaiCompat'
import { applyOptionalMaxTokens } from './api/chatCompletions'
import { useConfigsStore } from '../stores/configs'

export function useCharacterGen() {
  const configsStore = useConfigsStore()

  /**
   * 调用 LLM 生成角色提示词
   */
  async function generateCharacterPrompts(character, worldSetting, _options = {}) {
    const config = configsStore.getConfig
    if (!config?.url || !config?.key) {
      throw new Error('请先配置 LLM API')
    }

    const systemPrompt = `你是一个专业的视觉小说角色设计师。根据提供的角色信息，生成两部分内容：

1. **vnDescription**（中文，200-400字）：
   - 角色的性格特点、说话方式、口头禅
   - 背景故事、与其他角色的关系
   - 在故事中的定位和作用
   - 不要包含聊天格式规则

2. **spritePrompt**（英文，用于 AI 绘图）：
   - 详细的外貌描述：发色、发型、眼睛颜色、肤色
   - 体型特征：身高、体型
   - 服装描述：日常穿着风格
   - 风格标签：anime style, upper body, character sprite, white background

直接输出 JSON 格式，不要有其他内容：
{
  "vnDescription": "中文角色描述...",
  "spritePrompt": "English appearance prompt..."
}`

    const existingDesc = character.vnDescription || character.prompt || ''
    const userPrompt = `角色名称: ${character.vnName || character.name || '未命名'}
角色定位: ${character.role === 'protagonist' ? '主角' : character.role === 'heroine' ? '女主角' : '配角'}
世界观: ${worldSetting || '现代都市'}
${existingDesc ? `现有描述参考: ${existingDesc}` : ''}

请根据以上信息生成角色的详细描述和立绘提示词。`

    const body = {
      model: config.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    }
    applyOptionalMaxTokens(body, config.maxTokens)

    const { response: res } = await fetchOpenAICompat(config.url, {
      apiKey: config.key,
      body
    })

    if (!res.ok) {
      throw new Error(`LLM API 错误: ${res.status} ${await readOpenAICompatError(res)}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''

    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI 返回格式错误，无法解析')
    }

    try {
      const result = JSON.parse(jsonMatch[0])
      return {
        vnDescription: result.vnDescription || '',
        spritePrompt: result.spritePrompt || ''
      }
    } catch (e) {
      throw new Error('JSON 解析失败: ' + e.message)
    }
  }

  /**
   * 批量生成所有角色的提示词
   */
  async function batchGeneratePrompts(characters, worldSetting, onProgress) {
    const results = []

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i]
      onProgress?.(i + 1, characters.length, char.vnName || '角色')

      try {
        const prompts = await generateCharacterPrompts(char, worldSetting)
        results.push({
          contactId: char.contactId,
          ...prompts,
          success: true
        })
      } catch (e) {
        console.warn('生成失败:', char.vnName, e)
        results.push({
          contactId: char.contactId,
          success: false,
          error: e.message
        })
      }

      // 避免请求过快
      if (i < characters.length - 1) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    return results
  }

  /**
   * 分析项目需要的资源（背景、立绘表情）
   */
  async function analyzeResourceNeeds(worldSetting, characters, options = {}) {
    const config = configsStore.getConfig
    if (!config?.url || !config?.key) {
      throw new Error('请先配置 LLM API')
    }

    const { maxBackgrounds = 8, maxExpressions = 6 } = options

    const charList = characters.map(c =>
      `- ${c.vnName}（${c.role === 'protagonist' ? '主角' : c.role === 'heroine' ? '女主角' : '配角'}）`
    ).join('\n')

    const systemPrompt = `你是视觉小说资源规划师。分析项目需要的图像资源。

输出 JSON 格式：
{
  "backgrounds": [
    { "name": "场景名_时间段", "prompt": "英文背景提示词, anime style, detailed background, no characters" }
  ],
  "sprites": [
    { "characterName": "角色名", "expressions": ["normal", "happy", "sad", "angry", "surprised", "shy"] }
  ]
}

要求：
- 背景最多 ${maxBackgrounds} 个，覆盖主要场景和时间变化
- 每个角色最多 ${maxExpressions} 个常用表情
- 背景提示词必须英文，包含 "anime style, detailed background, no characters"
- 表情使用英文单词`

    const userPrompt = `世界观/故事大纲:
${worldSetting || '现代校园恋爱故事'}

角色列表:
${charList || '- 主角\n- 女主角'}

请分析这个项目需要哪些背景和角色表情。`

    const body = {
      model: config.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    }
    applyOptionalMaxTokens(body, config.maxTokens)

    const { response: res } = await fetchOpenAICompat(config.url, {
      apiKey: config.key,
      body
    })

    if (!res.ok) {
      throw new Error(`LLM API 错误: ${res.status} ${await readOpenAICompatError(res)}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI 返回格式错误')
    }

    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      throw new Error('JSON 解析失败')
    }
  }

  return {
    generateCharacterPrompts,
    batchGeneratePrompts,
    analyzeResourceNeeds
  }
}
