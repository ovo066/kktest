const BLOCKED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'base',
  'form',
  'svg',
  'math'
])
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const OFFLINE_HTML_DOCUMENT_TAG_RE = /<!doctype\s+html|<(?:html|head|body)\b/i
const OFFLINE_HTML_STYLE_FRAGMENT_RE = /<style\b[^>]*>[\s\S]*?<\/style>/i
const URL_ATTR_NAMES = new Set([
  'href',
  'src',
  'poster',
  'action',
  'formaction',
  'cite',
  'data',
  'xlink:href'
])
const BLOCKED_ATTR_NAMES = new Set(['srcdoc'])
const BOOLEAN_ATTRS = new Set(['controls', 'autoplay', 'loop', 'muted', 'reversed'])
const SPEAKER_PREFIX_RE = /(^|\n)(\s*)([A-Za-z0-9_\u4e00-\u9fff·•\-\s]{1,24})([:：])(?=\s*[^\s<\n])/gm

function getOfflineHtmlBaseCss() {
  return [
    ':host { display: block; color: inherit; }',
    '.off-html-document {',
    '  display: block;',
    '  width: 100%;',
    '  min-width: 0;',
    '  padding: 12px 14px;',
    '  color: var(--off-text, inherit);',
    '  font: 400 15px/1.6 var(--off-font, "Nunito", "Microsoft YaHei", sans-serif);',
    '  overflow-wrap: anywhere;',
    '  word-break: break-word;',
    '}',
    '.off-html-document, .off-html-document * { box-sizing: border-box; max-width: 100%; }',
    '.off-html-document p, .off-html-document div { margin: 0.45em 0; }',
    '.off-html-document h1, .off-html-document h2, .off-html-document h3, .off-html-document h4, .off-html-document h5, .off-html-document h6 { margin: 0.65em 0 0.35em; line-height: 1.35; font-weight: 800; }',
    '.off-html-document h1 { font-size: 1.5em; }',
    '.off-html-document h2 { font-size: 1.35em; }',
    '.off-html-document h3 { font-size: 1.2em; }',
    '.off-html-document h4 { font-size: 1.08em; }',
    '.off-html-document h5 { font-size: 1em; }',
    '.off-html-document h6 { font-size: 0.92em; opacity: 0.85; }',
    '.off-html-document ul, .off-html-document ol { margin: 0.45em 0; padding-left: 1.25em; }',
    '.off-html-document li { margin: 0.2em 0; }',
    '.off-html-document blockquote { margin: 0.6em 0; padding: 0.35em 0.75em; border-left: 3px solid rgba(127, 127, 127, 0.26); background: rgba(127, 127, 127, 0.08); border-radius: 6px; }',
    '.off-html-document hr { border: none; border-top: 1px solid rgba(127, 127, 127, 0.26); margin: 0.8em 0; }',
    '.off-html-document img, .off-html-document video, .off-html-document canvas, .off-html-document svg { max-width: 100%; height: auto; }',
    '.off-html-document table { width: 100%; border-collapse: collapse; }',
    '.off-html-document th, .off-html-document td { border: 1px solid rgba(127, 127, 127, 0.26); padding: 6px 8px; text-align: left; vertical-align: top; }',
    '.off-html-document pre { white-space: pre-wrap; word-break: break-word; }',
    '.off-html-document a { color: inherit; }'
  ].join('\n')
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function decodeHtmlAttr(text) {
  return String(text || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function sanitizeAllowedClass(rawClass) {
  const classes = String(rawClass || '')
    .split(/\s+/)
    .map(cls => cls.trim())
    .filter(Boolean)
    .filter(cls => cls.length <= 128 && !/[<>"'`\\]/.test(cls))
  return classes.join(' ')
}

function sanitizeInlineStyle(rawStyle) {
  const pieces = String(rawStyle || '')
    .split(';')
    .map(piece => piece.trim())
    .filter(Boolean)

  const safePieces = []
  for (const piece of pieces) {
    const idx = piece.indexOf(':')
    if (idx <= 0) continue
    const prop = piece.slice(0, idx).trim().toLowerCase()
    const value = piece.slice(idx + 1).trim()
    if (!/^([a-z][a-z0-9-]{0,63}|--[a-z0-9_-]{1,64})$/.test(prop)) continue
    if (prop === 'behavior' || prop === '-moz-binding') continue
    if (!value) continue
    if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) continue
    if (/[<>`]/.test(value)) continue
    safePieces.push(`${prop}: ${value}`)
  }
  return safePieces.join('; ')
}

function sanitizeTagName(rawTag) {
  const tag = String(rawTag || '').trim().toLowerCase()
  if (!/^[a-z][a-z0-9:-]{0,63}$/.test(tag)) return ''
  if (BLOCKED_TAGS.has(tag)) return ''
  return tag
}

function sanitizeGenericAttrValue(rawValue) {
  const value = decodeHtmlAttr(String(rawValue ?? '')).replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  if (!value) return ''
  if (/[<>`]/.test(value)) return ''
  return value
}

function sanitizeUrlAttr(rawValue, { allowDataImage = false } = {}) {
  const value = sanitizeGenericAttrValue(rawValue)
  if (!value) return ''
  const compact = value.replace(/\s+/g, '')
  if (/^(javascript:|vbscript:)/i.test(compact)) return ''
  if (/^data:/i.test(compact)) {
    if (allowDataImage && /^data:image\//i.test(compact)) return value
    return ''
  }
  if (/^(https?:|mailto:|tel:|blob:|\/|\.{1,2}\/|#|\/\/)/i.test(compact)) return value
  return ''
}

function sanitizeHtmlAttributes(tag, rawAttrs) {
  const attrs = decodeHtmlAttr(rawAttrs)
  const safeAttrs = []
  const attrRe = /([^\s=\/"'<>`]+)(?:\s*=\s*(?:"([^"]*?)"|'([^']*?)'|([^\s"'=<>`]+)))?/g

  let match
  while ((match = attrRe.exec(attrs)) !== null) {
    const attrName = String(match[1] || '').toLowerCase()
    if (!attrName || attrName.startsWith('on')) continue
    if (!/^[a-z_:][a-z0-9:._-]{0,127}$/i.test(attrName)) continue
    if (BLOCKED_ATTR_NAMES.has(attrName)) continue
    const rawValue = match[2] ?? match[3] ?? match[4] ?? ''

    let value = ''
    if (attrName === 'class') {
      value = sanitizeAllowedClass(rawValue)
    } else if (attrName === 'style') {
      value = sanitizeInlineStyle(rawValue)
    } else if (attrName === 'srcset') {
      value = sanitizeGenericAttrValue(rawValue)
    } else if (URL_ATTR_NAMES.has(attrName)) {
      value = sanitizeUrlAttr(rawValue, { allowDataImage: attrName === 'src' && tag === 'img' })
    } else {
      value = sanitizeGenericAttrValue(rawValue)
    }

    if (!value && BOOLEAN_ATTRS.has(attrName)) {
      safeAttrs.push(attrName)
      continue
    }
    if (!value) continue
    safeAttrs.push(`${attrName}="${value.replace(/"/g, '&quot;')}"`)
  }

  return safeAttrs.join(' ')
}

function restoreWhitelistedHtml(text) {
  const openTagRe = /&lt;\s*(?!\/)([a-zA-Z][a-zA-Z0-9:-]{0,63})(?:\s+([\s\S]*?))?\s*\/?\s*&gt;/gi
  text = text.replace(openTagRe, (match, rawTag, attrs = '') => {
    const tag = sanitizeTagName(rawTag)
    if (!tag) return match
    const safeAttrs = sanitizeHtmlAttributes(tag, attrs)
    if (VOID_TAGS.has(tag)) {
      return safeAttrs ? `<${tag} ${safeAttrs}>` : `<${tag}>`
    }
    return safeAttrs ? `<${tag} ${safeAttrs}>` : `<${tag}>`
  })

  const closeTagRe = /&lt;\s*\/\s*([a-zA-Z][a-zA-Z0-9:-]{0,63})\s*&gt;/gi
  text = text.replace(closeTagRe, (match, rawTag) => {
    const tag = sanitizeTagName(rawTag)
    if (!tag || VOID_TAGS.has(tag)) return ''
    return `</${tag}>`
  })

  return text
}

function sanitizeHtmlFragment(rawHtml) {
  return restoreWhitelistedHtml(escapeHtml(String(rawHtml || '')))
}

function sanitizeDocumentCss(rawCss) {
  let css = String(rawCss || '')
    .replace(/<\/?style[^>]*>/gi, '')
    .replace(/<!--|-->/g, '')
    .replace(/@import[\s\S]*?;/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/-moz-binding\s*:[^;]+;?/gi, '')
    .replace(/behavior\s*:[^;]+;?/gi, '')
    .replace(/[<>]/g, '')
    .trim()
  return css
}

function extractOfflineStyleTags(rawText) {
  const styleTags = []
  const content = String(rawText || '').replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, css = '') => {
    const safeCss = sanitizeDocumentCss(css)
    if (safeCss) styleTags.push(`<style>${safeCss}</style>`)
    return '\n'
  })

  return {
    styleTags,
    content
  }
}

function extractOfflineHtmlDocumentParts(rawText) {
  const source = String(rawText || '').replace(/\r\n?/g, '\n')
  const { styleTags } = extractOfflineStyleTags(source)

  const htmlAttrsMatch = source.match(/<html\b([^>]*)>/i)
  const bodyMatch = source.match(/<body\b([^>]*)>([\s\S]*?)<\/body>/i)
  const attrsSource = [htmlAttrsMatch?.[1] || '', bodyMatch?.[1] || ''].join(' ')
  const wrapperAttrs = sanitizeHtmlAttributes('div', attrsSource)

  let bodyHtml = bodyMatch?.[2] || source
  bodyHtml = bodyHtml
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?html\b[^>]*>/gi, '')
    .replace(/<\/?body\b[^>]*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .trim()

  return {
    styleTags,
    wrapperAttrs,
    bodyHtml: sanitizeHtmlFragment(bodyHtml)
  }
}

function buildOfflineHtmlDocument(rawText) {
  const { styleTags, wrapperAttrs, bodyHtml } = extractOfflineHtmlDocumentParts(rawText)
  if (!bodyHtml && styleTags.length === 0) return ''

  const attrs = wrapperAttrs ? ` ${wrapperAttrs}` : ''
  const baseCss = getOfflineHtmlBaseCss()

  return [
    `<style>${baseCss}</style>`,
    ...styleTags,
    `<div data-offline-html-root class="off-html-document"${attrs}>${bodyHtml}</div>`
  ].join('\n')
}

function buildOfflineStyledRichTextDocument(rawText) {
  const { styleTags, content } = extractOfflineStyleTags(rawText)
  if (styleTags.length === 0) return ''

  const bodyText = normalizeDisplayWhitespace(String(content || ''))
  const bodyHtml = renderOfflineRichTextPrepared(bodyText)
  const baseCss = getOfflineHtmlBaseCss()

  return [
    `<style>${baseCss}</style>`,
    ...styleTags,
    `<div data-offline-html-root class="off-html-document">${bodyHtml}</div>`
  ].join('\n')
}

export function isOfflineHtmlDocument(rawText) {
  const text = String(rawText || '').trim()
  if (!text) return false
  if (OFFLINE_HTML_DOCUMENT_TAG_RE.test(text)) return true
  return false
}

function applyMarkdown(text) {
  // Bold: **text**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // ST-like action marker: *text*
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<span class="off-action-text">$1</span>')
  // Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, '<s>$1</s>')
  // Inline code: `text`
  text = text.replace(/`([^`]+)`/g, '<code style="background:rgba(128,128,128,0.15);padding:1px 4px;border-radius:3px;font-size:0.9em;">$1</code>')
  // Dialogue: "text" (escaped as &quot;)
  text = text.replace(/&quot;(.+?)&quot;/g, '<span class="off-dialogue">&ldquo;$1&rdquo;</span>')
  // Dialogue: \u201ctext\u201d (curly quotes)
  text = text.replace(/\u201c(.+?)\u201d/g, '<span class="off-dialogue">\u201c$1\u201d</span>')
  // Dialogue: 「text」
  text = text.replace(/「(.+?)」/g, '<span class="off-dialogue">「$1」</span>')
  // Dialogue: 『text』
  text = text.replace(/『(.+?)』/g, '<span class="off-dialogue">『$1』</span>')
  return text
}

function applySpeakerPrefix(text) {
  return text.replace(SPEAKER_PREFIX_RE, (full, lead, indent, rawName, colon) => {
    const name = String(rawName || '').trim()
    if (!name) return full
    // Avoid turning pure numeric timestamps (e.g. 12:30) into speaker labels.
    if (!/[A-Za-z\u4e00-\u9fff]/.test(name)) return full
    return `${lead}${indent}<span class="off-speaker-label">${name}${colon}</span>`
  })
}

function nl2br(text) {
  return text.replace(/\n/g, '<br>')
}

export function applyRegexRules(text, rules) {
  if (!rules || rules.length === 0) return text
  const sorted = [...rules].sort((a, b) => (a.order || 0) - (b.order || 0))
  for (const rule of sorted) {
    if (!rule.enabled) continue
    try {
      const re = new RegExp(rule.pattern, rule.flags || 'g')
      text = text.replace(re, rule.replacement || '')
    } catch {
      // skip invalid regex
    }
  }
  return text
}

function normalizeDisplayWhitespace(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  const compacted = []
  let started = false
  let pendingBlank = false

  for (const rawLine of lines) {
    const line = String(rawLine).replace(/[ \t]+$/g, '')
    const hasContent = line.trim().length > 0

    if (!started) {
      if (!hasContent) continue
      started = true
      compacted.push(line)
      continue
    }

    if (!hasContent) {
      if (!pendingBlank) {
        compacted.push('')
        pendingBlank = true
      }
      continue
    }

    pendingBlank = false
    compacted.push(line)
  }

  while (compacted.length > 0 && compacted[compacted.length - 1] === '') {
    compacted.pop()
  }

  return compacted.join('\n')
}

export function renderOfflineRichText(rawText, regexRules = []) {
  if (!rawText) return ''
  const text = applyDisplayRegexRules(rawText, regexRules)
  return renderOfflineRichTextPrepared(text)
}

function renderOfflineRichTextPrepared(text) {
  text = escapeHtml(text)
  text = restoreWhitelistedHtml(text)
  text = applySpeakerPrefix(text)
  text = applyMarkdown(text)
  text = nl2br(text)
  return text
}

export function renderOfflineContent(rawText, regexRules = []) {
  if (!rawText) {
    return {
      mode: 'rich-text',
      html: '',
      htmlDocument: ''
    }
  }

  const text = applyDisplayRegexRules(rawText, regexRules)
  if (isOfflineHtmlDocument(text)) {
    const htmlDocument = buildOfflineHtmlDocument(text)
    if (htmlDocument) {
      return {
        mode: 'html-document',
        html: '',
        htmlDocument
      }
    }
  }
  if (OFFLINE_HTML_STYLE_FRAGMENT_RE.test(text)) {
    const htmlDocument = buildOfflineStyledRichTextDocument(text)
    if (htmlDocument) {
      return {
        mode: 'html-document',
        html: '',
        htmlDocument
      }
    }
  }

  return {
    mode: 'rich-text',
    html: renderOfflineRichTextPrepared(text),
    htmlDocument: ''
  }
}

function isDisplayHideRule(rule) {
  if (!rule || rule.scope !== 'display') return false
  return String(rule.replacement ?? '') === ''
}

export function applyDisplayRegexRules(text, regexRules = []) {
  const sourceText = String(text ?? '')
  const displayRules = (regexRules || []).filter(r => r.enabled && r.scope !== 'prompt')
  const replaced = applyRegexRules(sourceText, displayRules)
  if (replaced === sourceText) return replaced
  return normalizeDisplayWhitespace(replaced)
}

export function stripHtmlForPreview(text) {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function applyPromptRegexRules(text, regexRules = []) {
  const promptRules = regexRules.filter(r =>
    r.enabled &&
    (r.scope === 'prompt' || r.scope === 'both' || isDisplayHideRule(r))
  )
  return applyRegexRules(text, promptRules)
}
