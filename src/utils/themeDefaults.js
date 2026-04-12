import { DESKTOP_APP_KEYS } from '../data/homeApps'

const THEME_COLOR_KEYS = [
  'primaryColor',
  'backgroundColor',
  'cardBackground',
  'textPrimary',
  'textSecondary',
  'borderColor',
  'darkBackgroundColor',
  'darkCardBackground',
  'darkTextPrimary',
  'darkTextSecondary',
  'darkBorderColor'
]

const THEME_BUBBLE_KEYS = [
  'bubbleUserBg',
  'bubbleUserText',
  'bubbleAiBg',
  'bubbleAiText',
  'bubbleRadius',
  'bubbleShadow',
  'bubbleBorder'
]

const THEME_LAYOUT_KEYS = [
  'navbarBg',
  'navbarBlur',
  'navbarBorder',
  'inputBg',
  'inputBorder',
  'inputRadius',
  'buttonRadius',
  'fontFamily',
  'fontImport',
  'fontSize',
  'globalRadius',
  'customCSS'
]

const THEME_CHAT_UI_KEYS = [
  'inputPlaceholder',
  'inputLayout',
  'sendButtonStyle',
  'sendButtonText',
  'emojiButtonPosition',
  'plusButtonPosition',
  'mockImagePlaceholder',
  'headerStyle',
  'headerAvatarPosition',
  'lockScreenUnlockMode',
  'bubbleTailStyle',
  'timestampPosition'
]

export const THEME_STRING_KEYS = [
  ...THEME_COLOR_KEYS,
  ...THEME_BUBBLE_KEYS,
  ...THEME_LAYOUT_KEYS,
  ...THEME_CHAT_UI_KEYS
]

export const THEME_ARRAY_DEFAULTS = {
  headerActions: []
}

export const THEME_BOOLEAN_DEFAULTS = {
  showEmojiButton: false,
  showCameraButton: false,
  showImageButton: false,
  showMicButton: false,
  bubbleShowAvatar: false,
  showPhoneStatusBar: true
}

export function createDefaultThemeAppIcons() {
  return Object.fromEntries(DESKTOP_APP_KEYS.map((key) => [key, null]))
}

export function createDefaultThemeState() {
  const theme = Object.fromEntries(THEME_STRING_KEYS.map((key) => [key, '']))

  Object.entries(THEME_ARRAY_DEFAULTS).forEach(([key, fallback]) => {
    theme[key] = [...fallback]
  })

  Object.entries(THEME_BOOLEAN_DEFAULTS).forEach(([key, fallback]) => {
    theme[key] = fallback
  })

  theme.appIcons = createDefaultThemeAppIcons()
  return theme
}

// Keys that represent user preferences rather than visual theme properties.
// When applying a preset/theme that omits these, the existing value is preserved.
const THEME_PRESERVE_KEYS = new Set(['lockScreenUnlockMode'])

export function applyThemeFieldDefaults(target, data = {}) {
  const source = data && typeof data === 'object' ? data : {}

  THEME_STRING_KEYS.forEach((key) => {
    if (source[key] !== undefined) {
      target[key] = source[key]
    } else if (THEME_PRESERVE_KEYS.has(key) && target[key]) {
      // preserve existing user preference
    } else {
      target[key] = ''
    }
  })

  Object.entries(THEME_ARRAY_DEFAULTS).forEach(([key, fallback]) => {
    target[key] = Array.isArray(source[key]) ? [...source[key]] : [...fallback]
  })

  Object.entries(THEME_BOOLEAN_DEFAULTS).forEach(([key, fallback]) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      target[key] = !!source[key]
      return
    }
    target[key] = fallback
  })
}
