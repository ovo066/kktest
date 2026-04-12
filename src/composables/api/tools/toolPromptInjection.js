/**
 * Build a system prompt fragment that tells the AI character about available tools
 * in a roleplay-compatible way (without breaking immersion).
 *
 * This is only used when native tool calling is active.
 * The AI sees the tools via the `tools` parameter; this prompt provides
 * behavioral guidance on when/how to use them naturally.
 */

/**
 * @param {Array<{type:string, function:object}>} tools - OpenAI-format tools array
 * @returns {string} prompt fragment to inject into <features> block
 */
export function buildToolCallingPrompt(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return ''

  const names = tools.map(t => t.function?.name).filter(Boolean)
  if (names.length === 0) return ''

  return [
    '你拥有以下后台能力，可在需要时静默调用：',
    ...names.map(n => `- ${n}`),
    '',
    '使用规则：',
    '- 这些能力主要用于记忆、日程、日记或内部状态更新。',
    '- 仅在确实需要写入或记录时才调用，正常聊天直接回复即可。',
    '- 不要向用户提及“工具”“函数”“调用过程”等词，也不要暴露参数细节。',
    '- 调用后继续自然对话，把结果融入正常回复。'
  ].join('\n')
}

/**
 * Returns the set of text-token feature names that should be suppressed
 * from the special features prompt when native tool calling is active.
 *
 * @param {Array<{type:string, function:object}>} tools
 * @returns {Set<string>} settings guard names to suppress
 */
export function getToolCallingSuppressedFeatures(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return new Set()
  return new Set()
}
