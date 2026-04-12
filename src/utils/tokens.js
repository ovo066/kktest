/**
 * Token estimation utilities shared across memory, context window, and history search.
 */

export function estimateTokens(text) {
  // Very rough heuristic: ASCII ~ 4 chars/token, non-ASCII ~ 1 char/token (CJK).
  const s = String(text || '')
  let ascii = 0
  let nonAscii = 0
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 128) ascii++
    else nonAscii++
  }
  return Math.ceil(ascii / 4 + nonAscii)
}

export function trimToMaxTokens(text, maxTokens) {
  const budget = Number(maxTokens)
  if (!Number.isFinite(budget) || budget <= 0) return String(text || '')

  const s = String(text || '')
  if (!s) return ''
  if (estimateTokens(s) <= budget) return s

  // Binary search max prefix length within budget.
  let lo = 0
  let hi = s.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const candidate = s.slice(0, mid)
    if (estimateTokens(candidate) <= budget) lo = mid
    else hi = mid - 1
  }

  const trimmed = s.slice(0, Math.max(0, lo)).trimEnd()
  // Keep the ending deterministic and ASCII-only.
  return trimmed ? (trimmed + '\n...') : ''
}
