import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './relativeTime'

describe('formatRelativeTime', () => {
  const now = new Date('2026-03-08T12:00:00Z').getTime()

  it('formats long relative labels', () => {
    expect(formatRelativeTime(now - 30 * 1000, { now })).toBe('刚刚')
    expect(formatRelativeTime(now - 5 * 60 * 1000, { now })).toBe('5分钟前')
    expect(formatRelativeTime(now - 2 * 60 * 60 * 1000, { now })).toBe('2小时前')
    expect(formatRelativeTime(now - 3 * 24 * 60 * 60 * 1000, { now })).toBe('3天前')
  })

  it('formats short relative labels', () => {
    expect(formatRelativeTime(now - 30 * 1000, { now, short: true })).toBe('1m')
    expect(formatRelativeTime(now - 5 * 60 * 1000, { now, short: true })).toBe('5m')
    expect(formatRelativeTime(now - 2 * 60 * 60 * 1000, { now, short: true })).toBe('2h')
    expect(formatRelativeTime(now - 3 * 24 * 60 * 60 * 1000, { now, short: true })).toBe('3d')
  })

  it('falls back to locale date when day range is disabled', () => {
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60 * 1000, { now, maxRelativeDays: 0 })).toBe(
      new Date(now - 2 * 24 * 60 * 60 * 1000).toLocaleDateString()
    )
  })

  it('supports custom locale fallback formatting', () => {
    const target = now - 8 * 24 * 60 * 60 * 1000

    expect(formatRelativeTime(target, { now, maxRelativeDays: 6, dateLocale: 'zh-CN' })).toBe(
      new Date(target).toLocaleDateString('zh-CN')
    )
  })
})
