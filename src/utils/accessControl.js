function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function formatAccessIdentity(session = null) {
  if (normalizeText(session?.provider) === 'admin') {
    return normalizeText(session?.globalName) || '管理员'
  }

  const globalName = normalizeText(session?.globalName)
  const username = normalizeText(session?.username)

  if (globalName && username && globalName.toLowerCase() !== username.toLowerCase()) {
    return `${globalName} (@${username})`
  }
  if (globalName) return globalName
  if (username) return `@${username}`
  return '未验证'
}

export function formatAccessTimestamp(value) {
  const ts = Number(value || 0)
  if (!Number.isFinite(ts) || ts <= 0) return ''

  const date = new Date(ts)
  const pad = (part) => String(part).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join(':')
}

export function buildAccessRequirementLabel(options = {}) {
  const provider = normalizeText(options.provider || 'discord')
  const guildId = normalizeText(options.guildId)
  const ruleCount = Math.max(0, Number(options.ruleCount || 0) || 0)
  const hasRoleRules = !!options.hasRoleRules

  if (provider === 'discord' && hasRoleRules) {
    return ruleCount > 1
      ? '仅允许命中指定社区与身份组规则的 Discord 账号通过验证'
      : '仅允许命中指定身份组的 Discord 账号通过验证'
  }
  if (provider === 'discord' && (guildId || ruleCount > 1)) {
    return '仅允许指定 Discord 社区成员通过验证'
  }
  if (provider === 'discord') {
    return '需要先通过 Discord 账号验证'
  }
  return '需要先通过账号验证'
}

const ACCESS_ERROR_MESSAGES = {
  oauth_denied: '你取消了 Discord 授权',
  oauth_failed: 'Discord 授权失败，请重试',
  not_in_guild: '当前 Discord 账号不在授权社区内',
  missing_required_role: '当前 Discord 账号已在社区内，但不在允许的身份组里',
  invalid_admin_code: '管理员验证码不正确',
  device_limit_reached: '这个账号的设备席位已满，请先弹出一台已登录设备再继续',
  device_binding_unavailable: '设备绑定服务暂不可用，请稍后重试',
  unauthorized_device: '当前设备还没有通过授权，请重新验证',
  state_mismatch: '本次验证已失效，请重新发起',
  service_unavailable: '访问验证服务暂不可用',
  service_misconfigured: '访问验证已开启，但服务端配置还不完整'
}

export function mapAccessErrorCode(code) {
  const normalized = normalizeText(code)
  return ACCESS_ERROR_MESSAGES[normalized] || '访问验证失败，请重试'
}

export function consumeAccessErrorFromUrl(currentUrl = '') {
  const source = normalizeText(currentUrl)
    || (typeof window !== 'undefined' ? String(window.location.href || '') : '')
  if (!source) return ''

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://example.com'
    const url = new URL(source, base)
    const code = normalizeText(url.searchParams.get('access_error'))
    if (!code) return ''

    url.searchParams.delete('access_error')
    if (typeof window !== 'undefined') {
      const nextLocation = `${url.pathname}${url.search}${url.hash}`
      window.history.replaceState({}, '', nextLocation)
    }
    return code
  } catch {
    return ''
  }
}
