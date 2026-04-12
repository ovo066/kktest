import { getAllGifts } from '../../../data/gifts'

const TOKEN_UNSAFE_GIFT_NAME_REGEX = /[%:：()[\]（）【】\r\n]/
import {
  describeStickerGroups,
  filterStickersByGroupIds,
  normalizeStickerGroups,
  normalizeStickers,
  sanitizeStickerGroupSelection
} from '../../../utils/stickerGroups'

export function buildReplyFormatSystemPrompt() {
  return '引用回复：若要回复某条特定消息，在开头写 [quote:该消息的原文片段]，换行后写正文。不引用则直接写正文。'
}

function listUniqueStickerNames(stickers = []) {
  return Array.from(new Set(
    (Array.isArray(stickers) ? stickers : [])
      .map(sticker => String(sticker?.name ?? '').trim())
      .filter(Boolean)
  ))
}

function resolveRoleStickerGroupIds(role, groups) {
  if (!role || typeof role !== 'object') return []
  return sanitizeStickerGroupSelection(role.stickerGroupIds, groups)
}

function resolveMemberStickerGroupIds(store, member, groups) {
  if (!member || typeof member !== 'object') return []
  const sourceContact = Array.isArray(store.contacts)
    ? store.contacts.find(contact => contact?.id === member.contactId)
    : null
  const preferred = Array.isArray(sourceContact?.stickerGroupIds) && sourceContact.stickerGroupIds.length > 0
    ? sourceContact.stickerGroupIds
    : member.stickerGroupIds
  return sanitizeStickerGroupSelection(preferred, groups)
}

function buildRoleScopedStickerPrompt(stickers, groups, selectedGroupIds, roleName = '') {
  const allowedGroupIds = sanitizeStickerGroupSelection(selectedGroupIds, groups)
  const scopedStickers = allowedGroupIds.length > 0
    ? filterStickersByGroupIds(stickers, allowedGroupIds)
    : stickers
  const names = listUniqueStickerNames(scopedStickers)
  if (names.length === 0) return ''

  const lines = ['贴纸：仅在需要时独占一行输出 (sticker:标签名)。']
  if (allowedGroupIds.length > 0) {
    const subject = String(roleName || '当前角色').trim() || '当前角色'
    const groupNames = describeStickerGroups(allowedGroupIds, groups)
    lines.push(`${subject}仅可使用这些贴纸分组：${groupNames.join('、')}。`)
  }
  lines.push('可用标签（需完全一致）：' + names.join('、'))
  return lines.join('\n')
}

function buildGroupStickerPrompt(store, stickers, groups) {
  const members = Array.isArray(store.activeChat?.members) ? store.activeChat.members : []
  if (members.length === 0) {
    return buildRoleScopedStickerPrompt(stickers, groups, store.activeChat?.stickerGroupIds, store.activeChat?.name)
  }

  const memberRules = members.map((member) => {
    const allowedGroupIds = resolveMemberStickerGroupIds(store, member, groups)
    const scopedStickers = allowedGroupIds.length > 0
      ? filterStickersByGroupIds(stickers, allowedGroupIds)
      : stickers
    return {
      name: String(member?.name || '角色').trim() || '角色',
      restricted: allowedGroupIds.length > 0,
      groupNames: describeStickerGroups(allowedGroupIds, groups),
      names: listUniqueStickerNames(scopedStickers)
    }
  })

  const anyRestricted = memberRules.some(rule => rule.restricted)
  if (!anyRestricted) {
    return buildRoleScopedStickerPrompt(stickers, groups, store.activeChat?.stickerGroupIds, store.activeChat?.name)
  }

  const unionNames = Array.from(new Set(memberRules.flatMap(rule => rule.names)))
  if (unionNames.length === 0) return ''

  const lines = [
    '贴纸：仅在需要时独占一行输出 (sticker:标签名)。',
    '群聊成员贴纸限制：'
  ]

  memberRules.forEach((rule) => {
    if (rule.restricted && rule.names.length === 0) {
      lines.push(`- ${rule.name} 当前未分配可用贴纸，不要为 TA 发贴纸。`)
      return
    }
    if (rule.restricted) {
      lines.push(`- ${rule.name} 仅可使用分组：${rule.groupNames.join('、')}；可用标签：${rule.names.join('、')}`)
      return
    }
    lines.push(`- ${rule.name} 未设置贴纸限制，可使用全部标签。`)
  })

  lines.push('全体可用标签总表（需完全一致）：' + unionNames.join('、'))
  return lines.join('\n')
}

export function buildStickerSystemPrompt(store, options = {}) {
  if (!store.allowAIStickers) return ''

  const groups = normalizeStickerGroups(store.stickerGroups)
  const stickers = normalizeStickers(store.stickers, groups)
  if (stickers.length === 0) return ''

  if (!store.activeChat) {
    return buildRoleScopedStickerPrompt(stickers, groups, [], '')
  }

  if (store.activeChat.type === 'group') {
    const targetMemberId = String(options?.targetMemberId || '').trim()
    if (targetMemberId) {
      const member = (store.activeChat.members || []).find(item => String(item?.id || '') === targetMemberId)
      const allowedGroupIds = resolveMemberStickerGroupIds(store, member, groups)
      return buildRoleScopedStickerPrompt(stickers, groups, allowedGroupIds, member?.name || '当前角色')
    }
    return buildGroupStickerPrompt(store, stickers, groups)
  }

  const allowedGroupIds = resolveRoleStickerGroupIds(store.activeChat, groups)
  return buildRoleScopedStickerPrompt(stickers, groups, allowedGroupIds, store.activeChat?.name || '当前角色')
}

export function buildSpecialFeaturesSystemPrompt(store) {
  const rows = []
  const decisionRows = [
    '(accept:transfer) / (reject:transfer) — 对最近一条待处理的用户转账表态',
    '(accept:gift) / (reject:gift) — 对最近一条待处理的用户礼物表态',
    '(accept:meet) / (reject:meet) — 对最近一条待处理的用户线下邀约表态'
  ]
  if (store.allowAIMockImage) {
    rows.push('(camera:文字内容) — 发送可翻转查看文字的模拟图片')
  }

  if (store.allowAIFavorite) {
    rows.push('(收藏) / (favorite) — 将 {{char}} 刚输出的这一条消息气泡加入收藏')
    rows.push('(收藏:用户) / (favorite:user) — 将 {{user}} 最近一条消息气泡加入收藏')
  }

  const allowCall = store.allowAICall !== false
  if (allowCall) {
    rows.push('(call:voice或video:文案) — 发起通话')
  }

  if (store.allowAITransfer) {
    rows.push('(transfer:金额:备注?) — 转账，备注可省略')
  }

  if (store.allowAIGift) {
    const giftNames = Array.from(new Set(
      getAllGifts()
        .map(g => String(g?.name ?? '').trim())
        .filter(name => !!name && !TOKEN_UNSAFE_GIFT_NAME_REGEX.test(name))
    ))
    let line = '(gift:礼物名:留言?) — 送礼物，留言可省略'
    if (giftNames.length > 0) {
      line += '。可用：' + giftNames.join('、')
    }
    rows.push(line)
  }

  if (store.allowAIMeet) {
    rows.push('(meet:地点:时间?:备注?) — 邀请线下见面，时间和备注可省略')
  }

  if (store.allowAIVoice) {
    let voiceLine = '(voice:要说的话) — 发送语音'
    if (store.allowAIEmotionTag) {
      voiceLine += '，用 [emotion:xxx] 在文本中切换语气，如 (voice:[emotion:excited]真的吗！[emotion:happy]太好了)'
    }
    rows.push(voiceLine)
  }

  if (store.allowAIMusicRecommend) {
    rows.push('(music:歌名:歌手) — 推歌，仅在自然涉及音乐时使用')
  }

  if (store.allowAIImageGeneration) {
    const provider = String(store.vnImageGenConfig?.provider || '').trim().toLowerCase()
    if (provider === 'nanobanana') {
      rows.push('(image:简短自然语言描述) — 发图')
    } else {
      rows.push('(image:danbooru_tag, ...) — 发图')
    }
  }

  if (rows.length === 0) {
    const lines = []
    if (store.allowAIEmotionTag && !store.allowAIVoice) {
      lines.push('语气标签：正文前可加 [emotion:xxx] 让回复更有情绪感。可用：normal/happy/sad/surprised/angry/shy/thinking/laughing/excited/worried/confused/love/sleepy/proud/nervous')
    }
    lines.push('若用户发来待处理互动卡片，你也可以用这些决策 token 表态：')
    decisionRows.forEach(r => lines.push('- ' + r))
    return lines.join('\n')
  }

  const lines = ['以下 token 独占一行，仅在有意图时使用：']
  rows.forEach(r => lines.push('- ' + r))
  if (decisionRows.length > 0) {
    lines.push('若用户发来待处理互动卡片，你也可以用这些决策 token 表态：')
    decisionRows.forEach(r => lines.push('- ' + r))
  }

  return lines.join('\n')
}
