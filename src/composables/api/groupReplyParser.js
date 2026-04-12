import { extractQuoteFromText } from '../../utils/messageQuote'

function buildReplyEntry(senderName, rawContent, members) {
  const { quote, cleanText } = extractQuoteFromText(rawContent)
  return {
    senderId: members.find(member => member?.name === senderName)?.id || null,
    senderName,
    content: cleanText,
    replyToText: quote || null
  }
}

export function parseGroupReplyMessages(chatContent, members = []) {
  const text = String(chatContent || '').trim()
  if (!text) return []

  const senderTagRegex = /\[([^\]]+)\][:：]\s*/g
  const markers = []
  let match

  while ((match = senderTagRegex.exec(text)) !== null) {
    markers.push({
      senderName: String(match[1] || '').trim(),
      contentStart: senderTagRegex.lastIndex,
      matchIndex: match.index
    })
  }

  if (markers.length > 0) {
    return markers
      .map((marker, index) => {
        const nextMarker = markers[index + 1]
        const rawContent = text.slice(marker.contentStart, nextMarker?.matchIndex ?? text.length).trim()
        if (!rawContent) return null
        return buildReplyEntry(marker.senderName, rawContent, members)
      })
      .filter(Boolean)
  }

  const firstMember = members[0]
  const senderName = firstMember?.name || 'Unknown'
  return [buildReplyEntry(senderName, text, members.length > 0 ? members : [{ id: null, name: senderName }])]
}
