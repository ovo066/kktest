export function normalizeSearchText(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}