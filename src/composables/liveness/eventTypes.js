/**
 * 活人感引擎 - 事件源类型定义与工具函数
 *
 * 每个事件源模块导出一个 setup 函数，接收 { emit, store, livenessStore }，
 * 返回 { start(), stop() }。
 *
 * 事件格式:
 *   { type: string, contactId: string|null, context: object }
 */

/** 事件类型枚举 */
export const EventType = {
  HEARTBEAT: 'heartbeat',           // 定时心跳
  USER_IDLE: 'user_idle',           // 用户长时间未互动
  USER_RETURN: 'user_return',       // 用户切回标签页
  TIME_TRIGGER: 'time_trigger',     // 时间点触发（早安/晚安等）
  MOMENT_POST: 'moment_post',      // 用户发了新动态
  MOOD_CHANGE: 'mood_change',      // 角色情绪变化达到阈值
  PLANNER_REMINDER: 'planner_reminder', // 日程提醒
  SCHEDULE_BUSY: 'schedule_busy',       // 角色进入忙碌时段
  SCHEDULE_CONFLICT: 'schedule_conflict', // 用户日程冲突（如与其他角色见面）
}

import { getBeijingHour } from '../../utils/beijingTime'

/** 判断当前是否在免打扰时段 */
export function isQuietHours(config) {
  const hour = getBeijingHour()
  const { quietHoursStart = 23, quietHoursEnd = 7 } = config
  if (quietHoursStart > quietHoursEnd) {
    // 跨午夜: 23-7
    return hour >= quietHoursStart || hour < quietHoursEnd
  }
  return hour >= quietHoursStart && hour < quietHoursEnd
}

/** 获取当前时段标签 */
export function getTimePeriod() {
  const hour = getBeijingHour()
  if (hour >= 5 && hour < 9) return 'morning'
  if (hour >= 9 && hour < 12) return 'forenoon'
  if (hour >= 12 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'night'
}

/** 获取时段的中文描述 */
export function getTimePeriodLabel() {
  const map = {
    morning: '清晨',
    forenoon: '上午',
    noon: '中午',
    afternoon: '下午',
    evening: '晚上',
    night: '深夜'
  }
  return map[getTimePeriod()] || '现在'
}
