import { describe, expect, it } from 'vitest'
import { renderOfflineContent } from './offlineRichText'

describe('renderOfflineContent', () => {
  it('renders html-like assistant payloads in isolated document mode without dropping custom tags', () => {
    const rendered = renderOfflineContent(`
<style>
  card-shell { display: block; padding: 18px; border-radius: 16px; background: #fff7ed; }
  [data-label="mood"] { color: #c2410c; font-weight: 700; }
</style>
<card-shell tone="warm" data-card="scene">
  <title-row data-label="mood">开心</title-row>
  <bubble-panel>
    <p>你好</p>
    <img src="https://example.com/pic.png" onerror="alert(1)" />
  </bubble-panel>
</card-shell>
    `)

    expect(rendered.mode).toBe('html-document')
    expect(rendered.htmlDocument).toContain('<style>')
    expect(rendered.htmlDocument).toContain('<card-shell tone="warm" data-card="scene">')
    expect(rendered.htmlDocument).toContain('<title-row data-label="mood">开心</title-row>')
    expect(rendered.htmlDocument).toContain('card-shell { display: block;')
    expect(rendered.htmlDocument).not.toContain('onerror=')
  })

  it('keeps plain text on the legacy rich-text path', () => {
    const rendered = renderOfflineContent('小明：**你好**\n*挥手*')

    expect(rendered.mode).toBe('rich-text')
    expect(rendered.html).toContain('off-speaker-label')
    expect(rendered.html).toContain('<strong>你好</strong>')
    expect(rendered.html).toContain('off-action-text')
  })

  it('keeps tagged plain text on the rich-text path so st-style formatting still works', () => {
    const rendered = renderOfflineContent('<status>思考中</status>\n小明：「你好」\n*挥手*')

    expect(rendered.mode).toBe('rich-text')
    expect(rendered.html).toContain('<status>思考中</status>')
    expect(rendered.html).toContain('off-speaker-label')
    expect(rendered.html).toContain('off-dialogue')
    expect(rendered.html).toContain('off-action-text')
  })

  it('keeps st-style formatting when style blocks are mixed with plain text', () => {
    const rendered = renderOfflineContent(`
<style>
  status-box { display: inline-block; color: #c2410c; }
</style>
<status-box>思考中</status-box>
小明：「你好」
*挥手*
    `)

    expect(rendered.mode).toBe('html-document')
    expect(rendered.htmlDocument).toContain('<status-box>思考中</status-box>')
    expect(rendered.htmlDocument).toContain('off-speaker-label')
    expect(rendered.htmlDocument).toContain('off-dialogue')
    expect(rendered.htmlDocument).toContain('off-action-text')
    expect(rendered.htmlDocument).toContain('<br>')
  })
})
