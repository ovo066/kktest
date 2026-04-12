import { describe, expect, it } from 'vitest'
import { estimatePromptBreakdownFromMessages, estimateUsageFromMessages, recordUsage } from './usage'

describe('usage', () => {
  it('uses real api usage when provider returns input/output tokens', () => {
    const contact = {}
    recordUsage(
      contact,
      { usage: { input_tokens: 120, output_tokens: 30 } },
      { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      'claude-3-5-sonnet'
    )

    const stats = contact.tokenStats
    expect(stats.totalPromptTokens).toBe(120)
    expect(stats.totalCompletionTokens).toBe(30)
    expect(stats.lastCalls[0].totalTokens).toBe(150)
    expect(stats.lastCalls[0].estimated).toBe(false)
  })

  it('falls back to estimate when api usage shape is missing', () => {
    const contact = {}
    recordUsage(
      contact,
      { usage: { unknown_tokens: 999 } },
      { prompt_tokens: 40, completion_tokens: 10, total_tokens: 50 },
      'claude-3-5-sonnet'
    )

    const stats = contact.tokenStats
    expect(stats.totalPromptTokens).toBe(40)
    expect(stats.totalCompletionTokens).toBe(10)
    expect(stats.lastCalls[0].totalTokens).toBe(50)
    expect(stats.lastCalls[0].estimated).toBe(true)
  })

  it('updates estimate scale when both real and fallback usage exist', () => {
    const contact = {}
    recordUsage(
      contact,
      { usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 } },
      { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      'gpt-4o'
    )

    const scale = contact.tokenStats?.estimateScale
    expect(scale.samples).toBe(1)
    expect(scale.prompt).toBeGreaterThan(1)
    expect(scale.total).toBeGreaterThan(1)
  })

  it('records scaled prompt breakdown aligned with prompt_tokens', () => {
    const contact = {}
    const breakdown = estimatePromptBreakdownFromMessages([
      { role: 'system', content: '<role>你是小助手</role>\n<user_persona>我是用户</user_persona>\n<context_awareness>test</context_awareness>' },
      { role: 'system', content: '<instructions>\n<output_format>按格式输出</output_format>\n<features>\n贴纸：仅在需要时独占一行输出 (sticker:标签名)。\n可用标签（需完全一致）：开心\n引用回复：若要回复某条特定消息，在开头写 [quote:该消息的原文片段]，换行后写正文。不引用则直接写正文。\n以下 token 独占一行，仅在有意图时使用：\n- (call:voice或video:文案) — 发起通话\n</features>\n</instructions>' },
      { role: 'system', content: '<world_book name="设定">内容</world_book>' },
      { role: 'user', content: '你好' }
    ], 'gpt-4o')

    recordUsage(
      contact,
      { usage: { prompt_tokens: 200, completion_tokens: 30, total_tokens: 230 } },
      { prompt_tokens: 120, completion_tokens: 20, total_tokens: 140 },
      'gpt-4o',
      { promptBreakdown: breakdown }
    )

    const latest = contact.tokenStats?.lastCalls?.[0]
    expect(latest?.promptBreakdown).toBeTruthy()
    expect(latest.promptBreakdown.total).toBe(200)
    expect(latest.promptBreakdown.personaParts.total).toBe(latest.promptBreakdown.persona)
    expect(latest.promptBreakdown.systemParts.total).toBe(latest.promptBreakdown.system)
    expect(latest.promptBreakdownEstimated).toBe(false)
  })

  it('estimates usage from messages with model-aware tokenizer', () => {
    const usage = estimateUsageFromMessages(
      [
        { role: 'system', content: '你是助手。' },
        { role: 'user', content: '你好，帮我写一个周计划。' },
        { role: 'user', content: [{ type: 'text', text: '并附上图片说明' }, { type: 'image_url', image_url: { url: 'https://example.com/a.jpg' } }] }
      ],
      '好的，我来安排。',
      'claude-3-5-sonnet'
    )
    expect(usage.prompt_tokens).toBeGreaterThan(0)
    expect(usage.completion_tokens).toBeGreaterThan(0)
    expect(usage.total_tokens).toBe(usage.prompt_tokens + usage.completion_tokens)
  })

  it('splits prompt breakdown by persona/lorebook/history/system', () => {
    const breakdown = estimatePromptBreakdownFromMessages(
      [
        { role: 'system', content: '<role>角色设定</role>\n<user_persona>用户设定</user_persona>\n<context_awareness>规则</context_awareness>' },
        { role: 'system', content: '<instructions>\n<output_format>输出规则</output_format>\n<features>\n贴纸：仅在需要时独占一行输出 (sticker:标签名)。\n可用标签（需完全一致）：笑脸\n你有朋友圈功能。发动态：(动态:内容)。\n</features>\n</instructions>' },
        { role: 'system', content: '<image_generation>\n你可以发送真实图片。\n</image_generation>' },
        { role: 'system', content: '<world_book name="知识">世界书内容</world_book>' },
        { role: 'user', content: '用户发言' }
      ],
      'claude-3-5-sonnet'
    )

    expect(breakdown).toBeTruthy()
    expect(breakdown.persona).toBeGreaterThan(0)
    expect(breakdown.lorebook).toBeGreaterThan(0)
    expect(breakdown.history).toBeGreaterThan(0)
    expect(breakdown.system).toBeGreaterThan(0)
    expect(breakdown.personaParts.characterPersona).toBeGreaterThan(0)
    expect(breakdown.personaParts.userPersona).toBeGreaterThan(0)
    expect(breakdown.systemParts.outputFormat).toBeGreaterThan(0)
    expect(breakdown.systemParts.sticker).toBeGreaterThan(0)
    expect(breakdown.systemParts.presetImageRule).toBeGreaterThan(0)
    expect(breakdown.systemParts.total).toBe(breakdown.system)
    expect(breakdown.total).toBe(
      breakdown.persona + breakdown.lorebook + breakdown.history + breakdown.system
    )
  })
})
