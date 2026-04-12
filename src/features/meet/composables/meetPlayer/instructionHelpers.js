// @ts-check

/** @typedef {import('../meetInstructionContracts').MeetChoiceOption} MeetChoiceOption */

/** @returns {MeetChoiceOption[]} */
export function defaultChoices() {
  return [
    { text: '继续互动', effect: null },
    { text: '换个话题', effect: null }
  ]
}

/** @param {unknown[]} [options] @returns {MeetChoiceOption[] | null} */
export function normalizeChoices(options) {
  if (!Array.isArray(options)) return null
  const normalized = options
    .map((opt) => {
      const row = (opt && typeof opt === 'object') ? /** @type {Record<string, unknown>} */ (opt) : {}
      return {
        text: String(row.text || '').trim(),
        effect: row.effect ? String(row.effect) : null
      }
    })
    .filter((opt) => !!opt.text)
  return normalized.length > 0 ? normalized : null
}
