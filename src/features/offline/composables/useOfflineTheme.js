import { computed, onUnmounted, ref, watch } from 'vue'

export const DEFAULT_OFFLINE_THEME_CONFIG = Object.freeze({
  customCss: '',
  fontFamily: '',
  fontImport: ''
})

export function cloneThemeConfig(source = DEFAULT_OFFLINE_THEME_CONFIG) {
  const src = source && typeof source === 'object' ? source : DEFAULT_OFFLINE_THEME_CONFIG
  return {
    customCss: String(src.customCss || ''),
    fontFamily: String(src.fontFamily || '').trim(),
    fontImport: String(src.fontImport || '').trim()
  }
}

export function normalizeThemeConfig(source) {
  const base = cloneThemeConfig(DEFAULT_OFFLINE_THEME_CONFIG)
  if (!source || typeof source !== 'object') return base
  base.customCss = String(source.customCss || '')
    .replace(/<\/?style[^>]*>/gi, '')
    .trim()
  base.fontFamily = String(source.fontFamily || '').trim()
  base.fontImport = String(source.fontImport || '').trim()
  return base
}

const OFFLINE_FONT_FILE_RE = /\.(woff2?|ttf|otf|eot)(?:[\?#].*)?$/i

function escapeCssUrl(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function resolveFontFormat(url) {
  const lower = String(url || '').toLowerCase()
  if (/\.woff2(?:[\?#].*)?$/.test(lower)) return 'woff2'
  if (/\.woff(?:[\?#].*)?$/.test(lower)) return 'woff'
  if (/\.ttf(?:[\?#].*)?$/.test(lower)) return 'truetype'
  if (/\.otf(?:[\?#].*)?$/.test(lower)) return 'opentype'
  if (/\.eot(?:[\?#].*)?$/.test(lower)) return 'embedded-opentype'
  return ''
}

function extractImportUrl(input) {
  if (!input) return ''
  const importMatch = String(input).match(/@import\s+(?:url\((['"]?)(.+?)\1\)|(['"])(.+?)\3)\s*;?/i)
  if (importMatch?.[2]) return importMatch[2].trim()
  if (importMatch?.[4]) return importMatch[4].trim()
  const urlFnMatch = String(input).match(/^url\((['"]?)(.+?)\1\)$/i)
  if (urlFnMatch?.[2]) return urlFnMatch[2].trim()
  return ''
}

function extractFontFamilyFromCss(input) {
  const match = String(input || '').match(/font-family\s*:\s*([^;}{]+)/i)
  if (!match?.[1]) return ''
  const family = String(match[1]).trim()
  if (!family) return ''
  if (/^(inherit|initial|unset|revert)\b/i.test(family)) return ''
  return family
}

function inferGoogleFontFamily(url) {
  const value = String(url || '').trim()
  if (!/fonts\.googleapis\.com/i.test(value)) return ''
  const familyMatch = value.match(/[?&]family=([^&]+)/i)
  if (!familyMatch?.[1]) return ''
  try {
    const decoded = decodeURIComponent(familyMatch[1])
    const first = decoded.split('|')[0] || ''
    const familyName = first.split(':')[0].replace(/\+/g, ' ').trim()
    if (!familyName) return ''
    return `"${familyName.replace(/"/g, '\\"')}"`
  } catch {
    return ''
  }
}

function extractImportStatements(input) {
  const imports = []
  const rest = String(input || '').replace(/@import\s+(?:url\((['"]?)(.+?)\1\)|(['"])(.+?)\3)\s*;?/gi, (full) => {
    imports.push(full.trim())
    return '\n'
  })
  return {
    imports,
    rest: rest.trim()
  }
}

export function parseOfflineFontImport(rawValue) {
  const input = String(rawValue || '').trim()
  if (!input) return { linkHref: '', styleCss: '', inferredFamily: '' }

  const explicitUrl = extractImportUrl(input)
  const url = explicitUrl || input
  const isAbsoluteUrl = /^(https?:)?\/\//i.test(url) || /^data:/i.test(url)
  const isFontDataUrl = /^data:font\//i.test(url)
  const isFontFile = isFontDataUrl || OFFLINE_FONT_FILE_RE.test(url)

  if (isFontFile) {
    const format = resolveFontFormat(url)
    const formatFragment = format ? ` format("${format}")` : ''
    return {
      linkHref: '',
      styleCss: `@font-face { font-family: "OfflineCustomFont"; src: url("${escapeCssUrl(url)}")${formatFragment}; font-display: swap; }`,
      inferredFamily: '"OfflineCustomFont"'
    }
  }

  if (isAbsoluteUrl) {
    return {
      linkHref: url,
      styleCss: '',
      inferredFamily: inferGoogleFontFamily(url)
    }
  }

  return {
    linkHref: '',
    styleCss: input,
    inferredFamily: extractFontFamilyFromCss(input)
  }
}

function resolveOfflineFontFamily(fontFamily, inferredFamily) {
  const explicit = String(fontFamily || '').trim()
  if (explicit) return explicit
  if (inferredFamily) return `${inferredFamily}, "Nunito", "Microsoft YaHei", sans-serif`
  return ''
}

export function buildThemeCssSnippet(config) {
  const cfg = normalizeThemeConfig(config)
  const parts = []
  const inferredFamilies = []

  const pushFontImport = (rawValue) => {
    const parsed = parseOfflineFontImport(rawValue)
    if (parsed.linkHref) {
      parts.push(`@import url("${escapeCssUrl(parsed.linkHref)}");`)
    } else if (parsed.styleCss) {
      parts.push(parsed.styleCss)
    }
    if (parsed.inferredFamily) inferredFamilies.push(parsed.inferredFamily)
  }

  pushFontImport(cfg.fontImport)

  const cssInput = String(cfg.customCss || '').replace(/<\/?style[^>]*>/gi, '').trim()
  const { imports: customImports, rest: customCss } = extractImportStatements(cssInput)
  for (const importStmt of customImports) pushFontImport(importStmt)

  const inferredFromCss = extractFontFamilyFromCss(customCss)
  if (inferredFromCss) inferredFamilies.push(inferredFromCss)

  const resolvedFont = resolveOfflineFontFamily(cfg.fontFamily, inferredFamilies.find(Boolean) || '')
  if (resolvedFont) {
    parts.push(`.offline-view.offline-theme-custom { --off-font: ${resolvedFont}; }`)
    parts.push(`.offline-view.offline-theme-custom, .offline-view.offline-theme-custom .story-renderer, .offline-view.offline-theme-custom .msg-row .msg-body, .offline-view.offline-theme-custom .msg-row .bubble, .offline-view.offline-theme-custom .msg-row .bubble * { font-family: var(--off-font) !important; }`)
  }

  if (customCss) {
    if (!/[{}]/.test(customCss) && !/^@/m.test(customCss)) {
      parts.push(`.offline-view.offline-theme-custom { ${customCss} }`)
    } else {
      parts.push(customCss)
    }
  }

  return parts.join('\n')
}

export function useOfflineTheme({ offlineStore, scheduleSave, showToast }) {
  const offlineTheme = computed({
    get: () => offlineStore.theme || 'ttk',
    set: (value) => offlineStore.setTheme(value)
  })
  const offlineLayout = computed({
    get: () => offlineStore.layout || 'classic',
    set: (value) => offlineStore.setLayout(value)
  })
  const offlineAvatarMode = computed({
    get: () => offlineStore.avatarMode || 'side',
    set: (value) => offlineStore.setAvatarMode(value)
  })
  const offlineThemeConfig = computed({
    get: () => cloneThemeConfig(offlineStore.themeConfig),
    set: (value) => offlineStore.setThemeConfig(normalizeThemeConfig(value))
  })
  const offlineThemeExtraCss = computed(() => buildThemeCssSnippet(offlineThemeConfig.value))
  const offlineThemeStyleEl = ref(null)

  function ensureOfflineThemeStyleEl() {
    if (typeof document === 'undefined') return null
    if (offlineThemeStyleEl.value) return offlineThemeStyleEl.value
    const el = document.createElement('style')
    el.setAttribute('data-offline-theme-style', '1')
    document.head.appendChild(el)
    offlineThemeStyleEl.value = el
    return el
  }

  watch(offlineThemeExtraCss, (css) => {
    const el = ensureOfflineThemeStyleEl()
    if (!el) return
    el.textContent = css || ''
  }, { immediate: true })

  onUnmounted(() => {
    if (offlineThemeStyleEl.value?.parentNode) {
      offlineThemeStyleEl.value.parentNode.removeChild(offlineThemeStyleEl.value)
    }
    offlineThemeStyleEl.value = null
  })

  function handleSelectTheme(themeId) {
    offlineStore.setTheme(themeId)
    scheduleSave()
  }

  function handleSelectLayout(layoutId) {
    offlineStore.setLayout(layoutId)
    scheduleSave()
  }

  function handleSelectAvatarMode(modeId) {
    offlineStore.setAvatarMode(modeId)
    scheduleSave()
  }

  function handleSaveThemeConfig(config) {
    const normalized = normalizeThemeConfig(config)
    offlineStore.setThemeConfig(normalized)
    scheduleSave()
    showToast('主题美化已保存')
  }

  function handleResetThemeConfig() {
    offlineStore.setThemeConfig(cloneThemeConfig(DEFAULT_OFFLINE_THEME_CONFIG))
    scheduleSave()
    showToast('已恢复默认主题')
  }

  return {
    offlineTheme,
    offlineLayout,
    offlineAvatarMode,
    offlineThemeConfig,
    handleSelectTheme,
    handleSelectLayout,
    handleSelectAvatarMode,
    handleSaveThemeConfig,
    handleResetThemeConfig
  }
}