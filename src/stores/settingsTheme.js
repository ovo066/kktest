import { defineStore } from 'pinia'
import { ref } from 'vue'
import { presetThemes } from '../data/presetThemes'
import {
  applyThemeFieldDefaults,
  createDefaultThemeAppIcons
} from '../utils/themeDefaults'
import {
  createDefaultThemeLibraryState,
  createDefaultThemeSettings
} from './settingsDefaults'

const THEME_FONT_FALLBACK = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif'
const THEME_FONT_FILE_RE = /\.(woff2?|ttf|otf|eot)(?:[\?#].*)?$/i

function ensureStyleElement(id) {
  let el = document.getElementById(id)
  if (el && el.tagName !== 'STYLE') {
    el.remove()
    el = null
  }
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }
  return el
}

function ensureLinkElement(id) {
  let el = document.getElementById(id)
  if (el && el.tagName !== 'LINK') {
    el.remove()
    el = null
  }
  if (!el) {
    el = document.createElement('link')
    el.id = id
    el.rel = 'stylesheet'
    el.crossOrigin = 'anonymous'
    document.head.appendChild(el)
  }
  return el
}

function cleanupThemeFontElements() {
  const linkEl = document.getElementById('theme-font-import-link')
  if (linkEl) linkEl.remove()
  const styleEl = document.getElementById('theme-font-import')
  if (styleEl) styleEl.remove()
}

function extractImportUrl(input) {
  if (!input) return ''
  const importMatch = input.match(/@import\s+url\((['"]?)(.+?)\1\)\s*;?/i)
  if (importMatch?.[2]) return importMatch[2].trim()
  const urlFnMatch = input.match(/^url\((['"]?)(.+?)\1\)$/i)
  if (urlFnMatch?.[2]) return urlFnMatch[2].trim()
  return ''
}

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

function parseThemeFontImport(rawValue) {
  const input = String(rawValue || '').trim()
  if (!input) {
    return { linkHref: '', styleCss: '', inferredFamily: '' }
  }

  const explicitUrl = extractImportUrl(input)
  const url = explicitUrl || input
  const isAbsoluteUrl = /^(https?:)?\/\//i.test(url) || /^data:/i.test(url)
  const isFontDataUrl = /^data:font\//i.test(url)
  const isFontFile = isFontDataUrl || THEME_FONT_FILE_RE.test(url)

  if (isFontFile) {
    const format = resolveFontFormat(url)
    const formatFragment = format ? ` format("${format}")` : ''
    return {
      linkHref: '',
      styleCss: `@font-face { font-family: "ThemeCustomFont"; src: url("${escapeCssUrl(url)}")${formatFragment}; font-display: swap; }`,
      inferredFamily: '"ThemeCustomFont"'
    }
  }

  if (isAbsoluteUrl) {
    return { linkHref: url, styleCss: '', inferredFamily: '' }
  }

  // 兼容高级输入：允许用户直接填写 @font-face / @import 规则。
  return { linkHref: '', styleCss: input, inferredFamily: '' }
}

function resolveThemeFontFamily(fontFamily, inferredFamily) {
  const explicit = String(fontFamily || '').trim()
  if (explicit) return explicit
  if (inferredFamily) return `${inferredFamily}, ${THEME_FONT_FALLBACK}`
  return ''
}

export const useThemeStore = defineStore('settings-theme', () => {
  const themeSettings = createDefaultThemeSettings()
  const themeLibraryState = createDefaultThemeLibraryState()

  const isDark = ref(themeSettings.isDark)
  const savedThemes = ref(themeLibraryState.savedThemes)
  const activeThemeId = ref(themeLibraryState.activeThemeId)
  const theme = ref(themeLibraryState.theme)

  function updateThemeColorMeta() {
    if (typeof document === 'undefined') return
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return

    const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : ''
    const isAndroid = /Android/i.test(ua)
    const isIOS = /iPad|iPhone|iPod/i.test(ua) ||
      (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const bgColor = isDark.value
      ? (theme.value.darkBackgroundColor || '#000000')
      : (theme.value.backgroundColor || '#F2F2F7')

    if (isAndroid) {
      let barColor = bgColor
      try {
        const styles = getComputedStyle(document.documentElement)
        const navbarBg = styles.getPropertyValue('--navbar-bg').trim()
        const cssBg = styles.getPropertyValue('--bg-color').trim()
        barColor = navbarBg || cssBg || barColor
      } catch {
        // noop
      }
      meta.setAttribute('content', barColor)
      return
    }

    if (isIOS) {
      meta.setAttribute('content', bgColor)
      return
    }

    meta.setAttribute('content', theme.value.primaryColor || '#007AFF')
  }

  function setDarkMode(value) {
    isDark.value = value
    document.documentElement.classList.toggle('dark', value)
    updateThemeColorMeta()
  }

  function applyTheme() {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    const setVar = (name, value) => {
      if (value) root.style.setProperty(name, value)
      else root.style.removeProperty(name)
    }

    const currentTheme = theme.value
    const fontImport = parseThemeFontImport(currentTheme.fontImport)
    if (fontImport.linkHref) {
      const fontLinkEl = ensureLinkElement('theme-font-import-link')
      fontLinkEl.href = fontImport.linkHref
      const oldStyleEl = document.getElementById('theme-font-import')
      if (oldStyleEl) oldStyleEl.remove()
    } else if (fontImport.styleCss) {
      cleanupThemeFontElements()
      const fontStyleEl = ensureStyleElement('theme-font-import')
      fontStyleEl.textContent = fontImport.styleCss
    } else {
      cleanupThemeFontElements()
    }

    const styleEl = ensureStyleElement('custom-theme-css')
    styleEl.textContent = currentTheme.customCSS || ''

    setVar('--primary-color', currentTheme.primaryColor)
    setVar('--bg-color', currentTheme.backgroundColor)
    setVar('--card-bg', currentTheme.cardBackground)
    setVar('--text-primary', currentTheme.textPrimary)
    setVar('--text-secondary', currentTheme.textSecondary)
    setVar('--border-color', currentTheme.borderColor)

    setVar('--dark-bg-color', currentTheme.darkBackgroundColor)
    setVar('--dark-card-bg', currentTheme.darkCardBackground)
    setVar('--dark-text-primary', currentTheme.darkTextPrimary)
    setVar('--dark-text-secondary', currentTheme.darkTextSecondary)
    setVar('--dark-border-color', currentTheme.darkBorderColor)

    setVar('--bubble-user-bg', currentTheme.bubbleUserBg)
    setVar('--bubble-user-text', currentTheme.bubbleUserText)
    setVar('--bubble-ai-bg', currentTheme.bubbleAiBg)
    setVar('--bubble-ai-text', currentTheme.bubbleAiText)
    setVar('--bubble-radius', currentTheme.bubbleRadius)
    setVar('--bubble-shadow', currentTheme.bubbleShadow)
    setVar('--bubble-border', currentTheme.bubbleBorder)

    setVar('--navbar-bg', currentTheme.navbarBg)
    setVar('--navbar-blur', currentTheme.navbarBlur)
    setVar('--navbar-border', currentTheme.navbarBorder)

    setVar('--input-bg', currentTheme.inputBg)
    setVar('--input-border', currentTheme.inputBorder)
    setVar('--input-radius', currentTheme.inputRadius)

    setVar('--button-radius', currentTheme.buttonRadius)

    setVar('--theme-font', resolveThemeFontFamily(currentTheme.fontFamily, fontImport.inferredFamily))
    setVar('--font-size', currentTheme.fontSize)

    setVar('--global-radius', currentTheme.globalRadius)

    updateThemeColorMeta()
  }

  function getThemeData() {
    const { appIcons, appIconRefs, ...data } = theme.value
    return JSON.parse(JSON.stringify(data))
  }

  function applyThemeData(data) {
    applyThemeFieldDefaults(theme.value, data)
  }

  function saveThemeAs(name) {
    const id = 'theme_' + Date.now()
    const themeData = getThemeData()
    savedThemes.value.push({
      id,
      name,
      data: themeData,
      createdAt: Date.now()
    })
    activeThemeId.value = id
    return id
  }

  function updateSavedTheme(id) {
    const idx = savedThemes.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      savedThemes.value[idx].data = getThemeData()
      savedThemes.value[idx].updatedAt = Date.now()
    }
  }

  function loadSavedTheme(id) {
    const saved = savedThemes.value.find(t => t.id === id)
    if (saved) {
      applyThemeData(saved.data)
      activeThemeId.value = id
      applyTheme()
      return true
    }
    return false
  }

  function deleteSavedTheme(id) {
    savedThemes.value = savedThemes.value.filter(t => t.id !== id)
    if (activeThemeId.value === id) {
      activeThemeId.value = ''
    }
  }

  function renameSavedTheme(id, newName) {
    const saved = savedThemes.value.find(t => t.id === id)
    if (saved) {
      saved.name = newName
    }
  }

  function exportTheme() {
    return getThemeData()
  }

  function importTheme(data) {
    applyThemeData(data)
    activeThemeId.value = ''
  }

  function resetTheme() {
    applyThemeFieldDefaults(theme.value)
    activeThemeId.value = ''
  }

  function resetAppIcons() {
    theme.value.appIcons = createDefaultThemeAppIcons()
  }

  function applyPresetTheme(presetId) {
    const preset = presetThemes.find(p => p.id === presetId)
    if (!preset) return false

    if (preset.data === null) {
      resetTheme()
    } else {
      applyThemeData(preset.data)
    }
    activeThemeId.value = `preset_${presetId}`
    applyTheme()
    return true
  }

  return {
    isDark,
    savedThemes,
    activeThemeId,
    theme,
    presetThemes,
    setDarkMode,
    applyTheme,
    getThemeData,
    applyThemeData,
    saveThemeAs,
    updateSavedTheme,
    loadSavedTheme,
    deleteSavedTheme,
    renameSavedTheme,
    exportTheme,
    importTheme,
    resetTheme,
    resetAppIcons,
    applyPresetTheme
  }
})
