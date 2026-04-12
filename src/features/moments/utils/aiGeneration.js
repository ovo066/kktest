export function stripOuterCodeFence(text) {
  const trimmed = (text || '').trim()
  const match = trimmed.match(/^```(?:\w+)?\s*\n([\s\S]*?)\n```$/)
  return (match ? match[1] : trimmed).trim()
}

export function buildAutoReplyVibeHint(vibe) {
  if (vibe === 'drama') return '氛围：修罗场（有张力、有冲突但不人身攻击）。'
  if (vibe === 'friendly') return '氛围：其乐融融（友好、互相支持）。'
  return '氛围：中立自然，像真实朋友圈评论区。'
}

export function cleanGeneratedComment(text) {
  let result = stripOuterCodeFence(text).trim()
  result = result.replace(/^\s*\[[^\]]+\]\s*[:：]\s*/i, '').trim()
  result = result.replace(/^\s*回复\s*[@＠]?[^\s:：]{1,20}\s*[:：]\s*/i, '').trim()
  return result
}

export function normalizeReplyForCompare(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？!?、,.]/g, '')
}

export function getRecentRepliesText(moment, limit = 6) {
  return (moment?.replies || [])
    .slice(-limit)
    .map(reply => `${reply.authorName}${reply.replyToAuthorName ? ` -> @${reply.replyToAuthorName}` : ''}: ${reply.content}`)
    .join('\n')
}
