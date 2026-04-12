import { describe, expect, it } from 'vitest'
import {
  buildAccessRequirementLabel,
  consumeAccessErrorFromUrl,
  formatAccessIdentity,
  formatAccessTimestamp,
  mapAccessErrorCode
} from './accessControl'

describe('accessControl client utils', () => {
  it('formats discord identity with global name and username', () => {
    expect(formatAccessIdentity({
      provider: 'discord',
      globalName: 'Diana',
      username: 'diana_77'
    })).toBe('Diana (@diana_77)')
  })

  it('formats admin identity', () => {
    expect(formatAccessIdentity({
      provider: 'admin',
      globalName: '站长'
    })).toBe('站长')
  })

  it('formats timestamps', () => {
    expect(formatAccessTimestamp(new Date(2026, 3, 1, 4, 5).getTime())).toBe('2026-04-01 04:05')
  })

  it('maps access errors to user messages', () => {
    expect(mapAccessErrorCode('not_in_guild')).toBe('当前 Discord 账号不在授权社区内')
    expect(mapAccessErrorCode('missing_required_role')).toBe('当前 Discord 账号已在社区内，但不在允许的身份组里')
    expect(mapAccessErrorCode('invalid_admin_code')).toBe('管理员验证码不正确')
    expect(mapAccessErrorCode('device_limit_reached')).toBe('这个账号的设备席位已满，请先弹出一台已登录设备再继续')
  })

  it('builds requirement labels', () => {
    expect(buildAccessRequirementLabel({ provider: 'discord', guildId: 'guild-1' })).toBe('仅允许指定 Discord 社区成员通过验证')
    expect(buildAccessRequirementLabel({ provider: 'discord', ruleCount: 3, hasRoleRules: true })).toBe('仅允许命中指定社区与身份组规则的 Discord 账号通过验证')
  })

  it('consumes access errors from urls', () => {
    expect(consumeAccessErrorFromUrl('https://example.com/?access_error=oauth_failed#/settings')).toBe('oauth_failed')
  })
})
