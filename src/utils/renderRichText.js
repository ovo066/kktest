/**
 * Lightweight markdown-like rendering for chat-style rich text.
 * Supports:
 * - **bold** / __bold__
 * - *italic* / _italic_
 * - `inline code`
 */

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function withCodePlaceholders(text) {
  const placeholders = []
  const content = text.replace(/`([^`\n]+)`/g, (_, code) => {
    const token = `\u0001${placeholders.length}\u0001`
    placeholders.push(`<code>${code}</code>`)
    return token
  })
  return { content, placeholders }
}

function restoreCodePlaceholders(text, placeholders) {
  return text.replace(/\u0001(\d+)\u0001/g, (_, idx) => placeholders[Number(idx)] || '')
}

function applyInlineMarks(text) {
  let out = text
  out = out.replace(/\*\*([^*\n][^*\n]*?)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_\n][^_\n]*?)__/g, '<strong>$1</strong>')
  out = out.replace(/(^|[\s([{"'“‘])\*([^*\n]+?)\*(?=$|[\s).,!?:;"'”’\]}])/g, '$1<em>$2</em>')
  out = out.replace(/(^|[\s([{"'“‘])_([^_\n]+?)_(?=$|[\s).,!?:;"'”’\]}])/g, '$1<em>$2</em>')
  return out
}

export function renderRichText(text) {
  if (!text) return ''
  const escaped = escapeHtml(text)
  const { content, placeholders } = withCodePlaceholders(escaped)
  const marked = applyInlineMarks(content)
  const restored = restoreCodePlaceholders(marked, placeholders)
  return restored.replace(/\r?\n/g, '<br>')
}
