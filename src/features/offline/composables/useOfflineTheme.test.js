import { describe, expect, it } from 'vitest'
import {
  buildThemeCssSnippet,
  parseOfflineFontImport
} from './useOfflineTheme'

describe('offline theme helpers', () => {
  it('infers google font family from import url', () => {
    expect(parseOfflineFontImport('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap')).toEqual({
      linkHref: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap',
      styleCss: '',
      inferredFamily: '"Noto Sans SC"'
    })
  })

  it('turns direct font file urls into font-face css', () => {
    const parsed = parseOfflineFontImport('https://cdn.example.com/fonts/custom.woff2')

    expect(parsed.linkHref).toBe('')
    expect(parsed.inferredFamily).toBe('"OfflineCustomFont"')
    expect(parsed.styleCss).toContain('@font-face')
    expect(parsed.styleCss).toContain('format("woff2")')
  })

  it('builds css snippet with imported font and inline rules', () => {
    const css = buildThemeCssSnippet({
      fontImport: 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap',
      customCss: 'color: #333;'
    })

    expect(css).toContain('@import url("https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap");')
    expect(css).toContain('--off-font: "ZCOOL KuaiLe", "Nunito", "Microsoft YaHei", sans-serif;')
    expect(css).toContain('.offline-view.offline-theme-custom { color: #333; }')
  })
})
