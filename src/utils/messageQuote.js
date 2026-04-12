const QUOTE_REGEX = /\[(?:quote|引用)[:：]\s*([^\]]+)\]/gi
const LINE_BREAK_REGEX = /\r\n?|\u0085|\u2028|\u2029/g

function normalizeLineBreaks(text) {
  return String(text ?? '').replace(LINE_BREAK_REGEX, '\n')
}

export function extractQuoteFromText(text) {
  if (!text || typeof text !== 'string') return { quote: null, cleanText: text }

  const matches = [...text.matchAll(QUOTE_REGEX)]
  if (matches.length === 0) return { quote: null, cleanText: text }

  const quotes = matches.map(match => (match[1] || '').trim()).filter(Boolean)
  if (quotes.length === 0) return { quote: null, cleanText: text }

  const quote = quotes.join('；')
  const cleanText = normalizeLineBreaks(text)
    .replace(QUOTE_REGEX, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[^\S\n]*\n[^\S\n]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { quote, cleanText }
}
