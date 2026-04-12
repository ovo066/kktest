export function shouldAddReplyFormatPrompt(outputFormatPrompt) {
  return !/\[\s*quote\s*:/i.test(String(outputFormatPrompt || ''))
}

export function createStreamChunkBatcher(streamMsg, onChunk, buildDisplayContent = (content) => content) {
  let pending = ''
  let rafId = 0
  let timeoutId = 0

  const flush = () => {
    if (rafId) rafId = 0
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = 0
    }
    if (!pending) return

    streamMsg.content += pending
    pending = ''
    streamMsg.displayContent = buildDisplayContent(streamMsg.content)
    if (onChunk) {
      onChunk(streamMsg.displayContent != null ? streamMsg.displayContent : streamMsg.content)
    }
  }

  const scheduleFlush = () => {
    if (rafId || timeoutId) return
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      rafId = window.requestAnimationFrame(flush)
      return
    }
    timeoutId = setTimeout(flush, 16)
  }

  return {
    push(delta) {
      if (!delta) return
      pending += delta
      scheduleFlush()
    },
    flushNow() {
      if (rafId && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId)
        rafId = 0
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = 0
      }
      flush()
    }
  }
}

export function applyForumOnlyPlaceholder(msg, parsed, {
  stripForumBlocks,
  trimText,
  placeholder
} = {}) {
  if (!msg || !parsed || !(parsed.moments || parsed.posts || parsed.replies)) return false

  const cleaned = typeof stripForumBlocks === 'function'
    ? stripForumBlocks(msg.content)
    : String(msg.content || '')

  msg.displayContent = cleaned
  if (typeof trimText === 'function' && trimText(cleaned)) return false
  if (typeof trimText !== 'function' && String(cleaned || '').trim()) return false

  msg.displayContent = String(placeholder || '')
  msg.hideInChat = false
  msg.forumOnly = true
  return true
}
