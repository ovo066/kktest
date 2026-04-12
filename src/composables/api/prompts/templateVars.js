export function getTemplateVars(store, charName) {
  const contactId = store.activeChat?.id
  const persona = contactId ? store.getPersonaForContact(contactId) : null
  return {
    char: (charName || store.activeChat?.name || '角色').trim(),
    user: (persona?.name || '用户').trim()
  }
}

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ROLE_ALIAS_BOUNDARY = '[\\s\\n\\r\\t,，。！？!?:：;；、()（）\\[\\]"“”\\\'‘’<>《》【】·…\\-]'

function normalizeTemplateVarBraces(text) {
  if (typeof text !== 'string' || !text) return text
  return text.replace(/\{{2,}\s*(char|user)\s*\}{2,}/gi, (_, key) => `{{${key.toLowerCase()}}}`)
}

function replaceStandaloneAlias(text, alias, replacement, flags = 'g') {
  const re = new RegExp(`(^|${ROLE_ALIAS_BOUNDARY})${escapeRegExp(alias)}(?=($|${ROLE_ALIAS_BOUNDARY}))`, flags)
  return text.replace(re, (match, prefix = '', _suffix, offset, source) => {
    const aliasStart = offset + prefix.length
    const aliasEnd = aliasStart + alias.length
    const left = source.slice(Math.max(0, aliasStart - 4), aliasStart)
    const right = source.slice(aliasEnd, aliasEnd + 4)
    const insideTemplateVar = /\{\{\s*$/.test(left) && /^\s*\}\}/.test(right)
    if (insideTemplateVar) return match
    return `${prefix}${replacement}`
  })
}

export function normalizeRoleAliasesToTemplateVars(text) {
  if (typeof text !== 'string' || !text) return text

  let normalized = text
    .replace(/(^|\n)\s*(用户|user)\s*([:：])/gi, '$1{{user}}$3')
    .replace(/(^|\n)\s*(助手|助理|ai|assistant|char|角色)\s*([:：])/gi, '$1{{char}}$3')

  normalized = replaceStandaloneAlias(normalized, '用户', '{{user}}')
  normalized = replaceStandaloneAlias(normalized, 'user', '{{user}}', 'gi')

  normalized = replaceStandaloneAlias(normalized, '助手', '{{char}}')
  normalized = replaceStandaloneAlias(normalized, '助理', '{{char}}')
  normalized = replaceStandaloneAlias(normalized, '角色', '{{char}}')
  normalized = replaceStandaloneAlias(normalized, 'AI', '{{char}}', 'gi')
  normalized = replaceStandaloneAlias(normalized, 'assistant', '{{char}}', 'gi')
  normalized = replaceStandaloneAlias(normalized, 'char', '{{char}}', 'gi')

  return normalizeTemplateVarBraces(normalized)
}

export function applyTemplateVars(text, vars = {}) {
  if (typeof text !== 'string' || !text) return text
  const char = vars.char || '角色'
  const user = vars.user || '用户'
  return normalizeTemplateVarBraces(text).replace(/\{\{\s*(char|user)\s*\}\}/gi, (_, key) => {
    return key.toLowerCase() === 'char' ? char : user
  })
}
