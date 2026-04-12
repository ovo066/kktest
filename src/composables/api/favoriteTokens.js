/**
 * AI favorite token parsing.
 * Tokens: (收藏) / (favorite) — favorite AI's own message
 *         (收藏:用户) / (favorite:user) — favorite user's latest message
 */

const FAVORITE_SELF_RE = /\((?:收藏|favorite)\)/gi
const FAVORITE_USER_RE = /\((?:收藏:用户|favorite:user)\)/gi
const ALL_FAVORITE_RE = /\((?:收藏(?::用户)?|favorite(?::user)?)\)/gi

export function hasFavoriteToken(text) {
  if (!text || typeof text !== 'string') return false
  return ALL_FAVORITE_RE.test(text)
}

export function stripFavoriteTokensForDisplay(text) {
  if (!text || typeof text !== 'string') return text
  return text.replace(ALL_FAVORITE_RE, '').trim()
}

export function extractFavoriteTargets(text) {
  if (!text || typeof text !== 'string') return []
  const targets = []
  if (FAVORITE_USER_RE.test(text)) targets.push('user')
  // Reset lastIndex
  FAVORITE_USER_RE.lastIndex = 0
  // Check self after stripping user tokens to avoid double-match
  const withoutUser = text.replace(FAVORITE_USER_RE, '')
  if (FAVORITE_SELF_RE.test(withoutUser)) targets.push('self')
  // Reset lastIndex for globals
  FAVORITE_SELF_RE.lastIndex = 0
  FAVORITE_USER_RE.lastIndex = 0
  ALL_FAVORITE_RE.lastIndex = 0
  return targets
}
