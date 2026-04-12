const completeTokenRe = /(?:\(|（|\[|【)\s*(?:image|img|pic|photo|生图|画图|发图|配图|图片|图像)\s*[:：]\s*([^)）\]】]+?)\s*(?:\)|）|\]|】)/gi
const incompleteTailTokenRe = /(?:\(|（|\[|【)\s*(?:image|img|pic|photo|生图|画图|发图|配图|图片|图像)\s*[:：][^)\]）】\n\r]*$/gi
const completeTokenTestRe = /(?:\(|（|\[|【)\s*(?:image|img|pic|photo|生图|画图|发图|配图|图片|图像)\s*[:：]\s*([^)）\]】]+?)\s*(?:\)|）|\]|】)/i
const IMAGE_TOKEN_PLACEHOLDER = '[图片生成中]'

export function stripImageTokensForDisplay(text, allowAIImageGeneration) {
  const content = String(text ?? '')
  if (!allowAIImageGeneration) return content
  const stripped = content
    .replace(completeTokenRe, '')
    .replace(incompleteTailTokenRe, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

  if (!stripped.trim() && completeTokenTestRe.test(content)) {
    return IMAGE_TOKEN_PLACEHOLDER
  }

  return stripped
}

export function hasImageToken(text, allowAIImageGeneration) {
  if (!allowAIImageGeneration) return false
  const content = String(text ?? '')
  if (!content) return false
  return completeTokenTestRe.test(content)
}

// Compatible with:
// - type=scene, sunset
// - type=scene sunset
// - type = scene
const typePrefixRe = /^\s*type\s*[=＝]\s*([a-z0-9_-]+)\s*(?:[,，;；]\s*)?/i

export function parseImageTokenPayload(rawTags) {
  const text = String(rawTags || '').trim()
  if (!text) return { type: 'character', tags: '' }
  const m = text.match(typePrefixRe)
  if (!m) return { type: 'character', tags: text }
  const type = m[1].toLowerCase()
  const tags = text.slice(m[0].length).trim()
  return { type, tags }
}
