// @ts-check

import { compactCharacterDescription } from './resourcePrompts'
import { normalizeText } from './utils'

function cleanCharacterPrompt(prompt) {
  if (!prompt) return ''
  return String(prompt)
    .replace(/你正在.*?手机聊天.*?\n?/g, '')
    .replace(/输出规则[：:][^\n]*\n?/g, '')
    .replace(/每一行必须.*?\n?/g, '')
    .replace(/心理描写.*?包裹.*?\n?/g, '')
    .replace(/不要输出说明.*?\n?/g, '')
    .replace(/不要代替.*?发言.*?\n?/g, '')
    .replace(/保持口语化.*?\n?/g, '')
    .replace(/引用回复.*?\n?/g, '')
    .replace(/\[quote.*?\].*?\n?/g, '')
    .trim()
}

function findMeetingCharacter(meeting, characterId, fallbackName) {
  const characters = Array.isArray(meeting?.characters) ? meeting.characters : []
  const cid = normalizeText(characterId)
  if (cid) {
    const exact = characters.find(char => normalizeText(char?.contactId) === cid)
    if (exact) return exact
  }

  const targetName = normalizeText(fallbackName)
  if (!targetName) return null
  return characters.find(char => normalizeText(char?.vnName) === targetName) || null
}

function resolveCharacterMeta(deps, characterId, fallbackName = '') {
  const { contactsStore, meetStore, characterResourcesStore } = deps
  const cid = normalizeText(characterId)
  const meetingCharacter = findMeetingCharacter(meetStore.currentMeeting, cid, fallbackName)
  const contact = cid
    ? (contactsStore.contacts || []).find(item => item?.id === cid) || null
    : null
  const charRes = cid ? characterResourcesStore.getEntry(cid) || {} : {}

  let description = normalizeText(meetingCharacter?.vnDescription || '')
  if (!description) {
    description = compactCharacterDescription(cleanCharacterPrompt(contact?.prompt || ''))
  }
  if (!description) {
    description = compactCharacterDescription(charRes?.basePrompt || '')
  }

  const displayName = normalizeText(
    meetingCharacter?.vnName ||
    fallbackName ||
    contact?.name ||
    cid ||
    '角色'
  )

  return {
    charRes,
    contact,
    description,
    displayName,
    meetingCharacter
  }
}

export {
  cleanCharacterPrompt,
  findMeetingCharacter,
  resolveCharacterMeta
}
