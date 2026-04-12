/**
 * Moment (朋友圈动态) prompt + block stripping helpers.
 * Replaces the old forum block system with a lightweight inline format.
 *
 * New format:
 *   (动态:内容) or (动态:内容:心情emoji)
 *   (动态评论:momentId:内容)
 *   (动态评论:内容) // defaults to latest moment
 *   (动态评论:momentId:replyId:内容)
 *
 * Old forum block format is still stripped for backward compatibility.
 */

import { useMomentsStore } from '../../stores/moments'

/**
 * Build the Layer 0 always-on hint (~25 tokens).
 * Injected into <features> block of post-history instructions.
 */
export function buildMomentsHintPrompt(store) {
  if (!store?.syncForumToAI) return ''
  return '你有朋友圈功能。发动态：(动态:内容) 或 (动态:内容:表情)。评论动态：(动态评论:momentId:内容)；若不确定ID可用 latest/最新/最近，或简写为(动态评论:内容)默认评论最近一条。回复评论可用：(动态评论:momentId:replyId:内容)。仅在自然有感而发时使用。'
}

/**
 * Parse AI output for moment / moment-comment tokens.
 * Delegates to momentsStore.parseMomentContent().
 * Returns counts + metadata (latest moment/reply ids and previews).
 */
export function parseMomentContent(text, author) {
  const momentsStore = useMomentsStore()
  return momentsStore.parseMomentContent(text, author)
}

/**
 * Strip moment/forum blocks from text for chat display.
 * Handles both new (动态:...) and old [论坛:...] formats.
 */
export function stripMomentBlocks(text) {
  if (!text || typeof text !== 'string') return ''
  let result = text
  let changed = false

  const replaceAndFlag = (regex) => {
    const next = result.replace(regex, '')
    if (next !== result) {
      changed = true
      result = next
    }
  }

  // New format: (动态:内容) / (动态:内容:心情)
  replaceAndFlag(/[(\uff08]\s*(?:动态|moment)\s*[:\uff1a]\s*[^)\uff09]+?\s*[)\uff09]/gi)

  // New format: (动态评论:id:内容)
  replaceAndFlag(/[(\uff08]\s*(?:动态评论|moment-comment)\s*[:\uff1a]\s*[^)\uff09]+?\s*[)\uff09]/gi)

  // Old block format: [论坛:发帖]...[/论坛:发帖]
  replaceAndFlag(/\[\u8bba\u575b\s*(?:[:\uff1a\s]*)?\u53d1\u5e16\][\s\S]*?(?:\[\/\u8bba\u575b\s*(?:[:\uff1a\s]*)?\u53d1\u5e16\]|\[\/\u8bba\u575b\]|$)/g)
  // Old block format: [论坛:回复]...[/论坛:回复]
  replaceAndFlag(/\[\u8bba\u575b\s*(?:[:\uff1a\s]*)?\u56de\u590d\][\s\S]*?(?:\[\/\u8bba\u575b\s*(?:[:\uff1a\s]*)?\u56de\u590d\]|\[\/\u8bba\u575b\]|$)/g)
  // Old inline format: [论坛:发帖:标题:内容]
  replaceAndFlag(/\[\u8bba\u575b\s*[:\uff1a]\s*\u53d1\u5e16\s*[:\uff1a][^\]]+\]/g)
  // Old inline format: [论坛:回复:id:内容]
  replaceAndFlag(/\[\u8bba\u575b\s*[:\uff1a]\s*\u56de\u590d\s*[:\uff1a][^\]]+\]/g)

  if (!changed) return text
  return result.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Legacy compatibility: re-export under old name.
 */
export const stripForumBlocks = stripMomentBlocks

/**
 * Legacy compatibility: build old-style forum system prompt.
 * Now returns the new lightweight hint instead.
 */
export function buildForumSystemPrompt(store) {
  return buildMomentsHintPrompt(store)
}
