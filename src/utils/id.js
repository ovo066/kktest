// Small ID helper used for persisted entities (messages, stickers, etc.).
// We prefer string IDs to avoid Date.now() collisions within the same millisecond.
export function makeId(prefix = 'id') {
  try {
    // Modern browsers (including recent iOS Safari) support crypto.randomUUID().
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`
    }
  } catch {
    // ignore
  }

  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${ts}_${rnd}`
}

