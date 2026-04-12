import { applyTemplateVars } from './api/prompts'
import {
  buildSnoopRolePrompt,
  createSnoopError,
  getResolvedSnoopConfig,
  inferSnoopConsentDecision,
  normalizeSnoopApiError,
  requestSnoopChatCompletion
} from './snoop/shared'

export async function generateSnoopConsentResponse(contact, requestText = '') {
  const cfg = getResolvedSnoopConfig(contact)
  if (!cfg?.url || !cfg?.key) throw new Error('未配置 API：请先在角色配置里填写接口地址和密钥')

  const { vars, systemPrompt } = buildSnoopRolePrompt(contact)
  const normalizedRequest = String(requestText || '').trim() || '我能查查你的手机吗？'
  const userPrompt = applyTemplateVars(
    `下面是{{user}}对你说的原话：
"${normalizedRequest}"

你会同意吗？请以角色身份自然回应1-2句话。
- 如果你愿意让{{user}}看，在回复末尾加上 (agree)
- 如果你不愿意，在回复末尾加上 (refuse)
只需要自然地回应，最后加上标记即可。`,
    vars
  )

  let raw = ''
  try {
    raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt, 200)
  } catch (error) {
    throw normalizeSnoopApiError(error)
  }

  if (!String(raw || '').trim()) {
    throw createSnoopError('AI 返回格式错误', '回复内容为空')
  }

  const decision = inferSnoopConsentDecision(raw)
  if (decision == null) {
    throw createSnoopError('AI 返回格式错误', '无法判断是同意还是拒绝，请让模型明确表达')
  }

  const message = raw
    .replace(/\(\s*agree\s*\)/gi, '')
    .replace(/\(\s*refuse\s*\)/gi, '')
    .trim()

  return { agreed: decision, message: message || '……' }
}
