import { describe, expect, it } from 'vitest'
import { readAccessAnnouncement } from './accessGuardStorage'

describe('readAccessAnnouncement', () => {
  it('returns the configured announcement when ACCESS_GUARD_ANNOUNCEMENT_JSON is present', async () => {
    const announcement = await readAccessAnnouncement({
      requestedEnabled: true,
      ACCESS_GUARD_ANNOUNCEMENT_JSON: JSON.stringify({
        id: 'custom-announcement',
        title: '自定义公告',
        body: '这是线上公告',
        publishedAt: '2026-04-03'
      })
    })

    expect(announcement).toMatchObject({
      id: 'custom-announcement',
      title: '自定义公告',
      body: '这是线上公告',
      publishedAt: '2026-04-03'
    })
  })

  it('falls back to the built-in notice when access guard is enabled without a configured announcement', async () => {
    const announcement = await readAccessAnnouncement({
      requestedEnabled: true
    })

    expect(announcement).toMatchObject({
      id: '2026-04-02-kaka-chat-notice',
      title: '关于kaka chat的公告',
      publishedAt: '2026-04-02'
    })
    expect(announcement.body).toContain('Kaka小手机完全免费')
    expect(announcement.body).toContain('闲鱼、淘宝等平台的付费售卖均为盗版倒卖')
  })

  it('returns null when access guard is disabled and no announcement is configured', async () => {
    const announcement = await readAccessAnnouncement({})
    expect(announcement).toBeNull()
  })
})
