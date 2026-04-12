// @ts-check

import { normalizeExpression, normalizeText } from './utils'

function buildBackgroundPrompt(name, prompt) {
  const base = normalizeText(prompt || name || 'anime date scene')
  if (/background|no characters|no_humans|scenery/i.test(base)) return base
  return `${base}, anime style, detailed environment, scenic background, no characters, no humans, background only`
}

function buildCgPrompt(name, prompt) {
  const base = normalizeText(prompt || name || 'visual novel key scene')
  if (/visual novel cg|cinematic|dramatic lighting|key scene/i.test(base)) return base
  return `${base}, anime visual novel CG, cinematic composition, dramatic lighting, emotional key scene, high detail`
}

function compactCharacterDescription(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
}

function buildSpritePrompt(payload, meta) {
  const expression = normalizeExpression(payload.expression)
  const userPrompt = normalizeText(payload.prompt)
  if (userPrompt) {
    if (/sprite|upper body|portrait|white background/i.test(userPrompt)) return userPrompt
    return `${userPrompt}, upper body portrait, visual novel character sprite, anime style, white background`
  }

  const parts = []
  if (meta.charRes?.artistTags) parts.push(meta.charRes.artistTags)
  if (meta.charRes?.basePrompt) parts.push(meta.charRes.basePrompt)
  parts.push(meta.displayName)
  if (meta.description) parts.push(meta.description)
  parts.push(`${expression} expression`)
  parts.push('upper body portrait')
  parts.push('visual novel character sprite')
  parts.push('anime style')
  parts.push('white background')
  parts.push('clean lineart')
  return parts.join(', ')
}

function buildNanoBananaEditPrompt(displayName, expression) {
  return `Edit this anime character illustration of ${displayName}: change only the facial expression to "${expression}". Keep hairstyle, clothing, body pose, framing, and style unchanged. Keep a plain white background.`
}

export {
  buildBackgroundPrompt,
  buildCgPrompt,
  buildNanoBananaEditPrompt,
  buildSpritePrompt,
  compactCharacterDescription
}
