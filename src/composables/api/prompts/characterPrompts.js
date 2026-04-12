export function buildPersonaSystemPrompt(store, contactId) {
  const persona = store.getPersonaForContact(contactId)
  if (!persona) return ''
  const lines = []
  if (persona.name) lines.push('名称：' + persona.name)
  if (persona.description) lines.push('描述：' + persona.description)
  if (lines.length === 0) return ''
  return '用户面具：\n' + lines.join('\n')
}

export function buildGroupSystemPrompt(members) {
  const memberList = members.map(m => {
    let desc = `- ${m.name}`
    if (m.prompt) desc += `：${m.prompt}`
    return desc
  }).join('\n')

  return `你正在模拟一个群聊场景。群里有以下成员：
${memberList}

每个角色发言占一行，格式：[角色名]: 内容（如 [${members[0]?.name || '角色'}]: 你好！）。
根据对话内容自然地选择哪些角色回应，保持各角色性格一致。`
}
