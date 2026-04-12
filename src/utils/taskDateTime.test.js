import { describe, expect, it } from 'vitest'
import {
  extractTaskScheduleFromText,
  formatTaskScheduleLabel,
  mergeTaskScheduleDetections
} from './taskDateTime'

const NOW = new Date('2026-03-13T10:00:00+08:00')

describe('taskDateTime', () => {
  it('extracts relative date and chinese time from task text', () => {
    const result = extractTaskScheduleFromText('明天下午三点半开会', { now: NOW })

    expect(result).toMatchObject({
      matched: true,
      cleanedText: '开会',
      startDate: '2026-03-14',
      startTime: '15:30',
      endTime: '',
      allDay: false
    })
  })

  it('extracts weekday time range and formats label', () => {
    const result = extractTaskScheduleFromText('下周一 9:30-11:00 复盘', { now: NOW })

    expect(result).toMatchObject({
      matched: true,
      cleanedText: '复盘',
      startDate: '2026-03-16',
      startTime: '09:30',
      endTime: '11:00'
    })
    expect(formatTaskScheduleLabel(result)).toBe('3月16日 09:30-11:00')
  })

  it('marks anniversaries and merges date/time from title and description', () => {
    const title = extractTaskScheduleFromText('妈妈生日', { now: NOW })
    const description = extractTaskScheduleFromText('5月20日晚上7点一起庆祝', { now: NOW })
    const merged = mergeTaskScheduleDetections(title, description, { fallbackTitle: '妈妈生日' })

    expect(merged).toMatchObject({
      matched: true,
      cleanedText: '妈妈生日',
      startDate: '2026-05-20',
      startTime: '19:00',
      kind: 'anniversary'
    })
  })
})
