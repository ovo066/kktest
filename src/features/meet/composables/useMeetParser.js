// @ts-check

/**
 * Meet 输出解析器
 * 支持 [角色名] 内容 新格式 + 角色名：内容 旧格式 fallback
 * 添加 [location:] [time:] [mood:] 指令
 */

/** @typedef {import('./meetInstructionContracts').MeetBackgroundInstruction} MeetBackgroundInstruction */
/** @typedef {import('./meetInstructionContracts').MeetCharacterRef} MeetCharacterRef */
/** @typedef {import('./meetInstructionContracts').MeetCgInstruction} MeetCgInstruction */
/** @typedef {import('./meetInstructionContracts').MeetInstruction} MeetInstruction */
/** @typedef {import('./meetInstructionContracts').MeetNewResourceSummary} MeetNewResourceSummary */
/** @typedef {import('./meetInstructionContracts').MeetParserOptions} MeetParserOptions */
/** @typedef {import('./meetInstructionContracts').MeetSpriteInstruction} MeetSpriteInstruction */

export function useMeetParser() {
  const PATTERNS = {
    choicesStart: /^\[choices\]\s*$/i,
    choicesEnd: /^\[\/choices\]\s*$/i,
    choiceItem: /^\s*[-•—]\s*(.+?)(?:\s*(?:->|→|=>)\s*(.+))?\s*$/,
    variable: /^\[var[:：]\s*([^:：\]]+?)\s*[:：]\s*([^\]]+?)\s*\]\s*$/i,
    narration: /^\*(.+)\*$/,

    // New format: [角色名] 内容 / [角色名]:内容 (allow optional list marker and loose separators)
    tagDialog: /^(?:[-•—]\s*)?\[([^\[\]:]{1,32})\](?:\s*[：:]\s*|\s+)?(.+)$/,
    // Old format: 角色名：内容 (fallback; allow optional list marker)
    dialog: /^(?:[-•—]\s*)?([^：:*\[\]\n]{1,32})[：:]\s*(.+)$/,

    // Meet-specific
    location: /^\[location[:：]\s*([^\]]+?)\s*\]\s*$/i,
    time: /^\[time[:：]\s*([^\]]+?)\s*\]\s*$/i,
    mood: /^\[mood[:：]\s*([^:：\]]+?)\s*[:：]\s*([^\]]+?)\s*\]\s*$/i
  }

  // Instruction keywords that should NOT be parsed as dialog names
  const INSTRUCTION_KEYWORDS = new Set([
    'bg', 'cg', 'sprite', 'location', 'time', 'mood', 'var', 'bgm', 'sfx',
    'choices', '/choices', 'new'
  ])

  const KNOWN_ANIMATIONS = new Set([
    'fadeIn', 'slideLeft', 'slideRight', 'slideUp', 'bounce',
    'shake', 'jump', 'nod', 'fadeOut'
  ])

  function normalizeCharacterToken(value) {
    return String(value || '')
      .trim()
      .replace(/^[「『“"'`]+/, '')
      .replace(/[」』”"'`]+$/, '')
      .replace(/\s+/g, '')
      .toLowerCase()
  }

  function resolveCharacter(charMap, vnName) {
    const rawName = String(vnName || '').trim()
    if (!rawName) return null
    const normalized = normalizeCharacterToken(rawName)
    return charMap[rawName] || (normalized ? charMap[normalized] : null) || null
  }

  function getCharacterId(charMap, vnName) {
    const rawName = String(vnName || '').trim()
    if (!rawName) return ''
    return resolveCharacter(charMap, rawName)?.contactId || rawName
  }

  function isInstructionKeywordName(name) {
    const raw = String(name || '').trim().toLowerCase()
    if (INSTRUCTION_KEYWORDS.has(raw)) return true
    const normalized = normalizeCharacterToken(name)
    return !!normalized && INSTRUCTION_KEYWORDS.has(normalized)
  }

  /**
   * @param {string} line
   * @returns {MeetBackgroundInstruction | null}
   */
  function parseBgLine(line) {
    const match = String(line || '').match(/^\[bg:\s*(.+?)\s*\]\s*$/i)
    if (!match) return null
    const inner = match[1].trim()
    if (!inner) return null

    const isNew = inner.toUpperCase().startsWith('NEW:')
    if (isNew) {
      const rest = inner.slice(4).trim()
      if (!rest) return null
      const firstColonIdx = rest.indexOf(':')
      const name = (firstColonIdx === -1 ? rest : rest.slice(0, firstColonIdx)).trim()
      const prompt = (firstColonIdx === -1 ? '' : rest.slice(firstColonIdx + 1)).trim()
      if (!name) return null
      return { type: 'bg', name, isNew: true, prompt: prompt || null, transition: 'fade' }
    }

    const firstColonIdx = inner.indexOf(':')
    const name = (firstColonIdx === -1 ? inner : inner.slice(0, firstColonIdx)).trim()
    const prompt = (firstColonIdx === -1 ? '' : inner.slice(firstColonIdx + 1)).trim()
    if (!name) return null
    return { type: 'bg', name, isNew: false, prompt: prompt || null, transition: 'fade' }
  }

  /**
   * @param {string} line
   * @param {Record<string, MeetCharacterRef>} charMap
   * @returns {MeetSpriteInstruction | null}
   */
  function parseSpriteLine(line, charMap) {
    const match = String(line || '').match(/^\[sprite:\s*(.+?)\s*\]\s*$/i)
    if (!match) return null
    const inner = match[1]

    // For NEW sprites, only split on first 3 colons to preserve prompt colons
    // Format: name:pos:NEW:expression:prompt (prompt may contain colons)
    // Format: name:pos:expression:animation
    const parts = inner.split(':')
    if (parts.length < 2) return null

    const vnName = (parts[0] || '').trim()
    const positionRaw = (parts[1] || '').trim()
    if (!vnName || !positionRaw) return null

    const characterId = getCharacterId(charMap, vnName)

    if (positionRaw === 'none') {
      const animation = (parts[2] || 'fadeOut').trim() || 'fadeOut'
      return { type: 'sprite', characterId, vnName, position: 'none', expression: '', isNew: false, prompt: null, animation }
    }

    let position = positionRaw
    let inferredAnim = null
    if (positionRaw.includes('>')) {
      position = (positionRaw.split('>').pop() || '').trim() || positionRaw
      inferredAnim = 'slide'
    }

    let idx = 2
    let isNew = false
    if ((parts[idx] || '').trim() === 'NEW') { isNew = true; idx += 1 }

    const expression = ((parts[idx] || 'normal') + '').trim() || 'normal'
    idx += 1

    let prompt = null
    let animation = null

    if (isNew) {
      // For NEW sprites: everything after expression is prompt (may contain colons)
      // Only strip trailing animation if it's a known animation name
      const rest = parts.slice(idx)
      if (rest.length === 0) {
        prompt = null
      } else {
        const joined = rest.join(':').trim()
        // Check if the last segment after the final colon is a known animation
        const lastColonIdx = joined.lastIndexOf(':')
        if (lastColonIdx !== -1) {
          const possibleAnim = joined.slice(lastColonIdx + 1).trim()
          if (KNOWN_ANIMATIONS.has(possibleAnim)) {
            animation = possibleAnim
            prompt = joined.slice(0, lastColonIdx).trim() || null
          } else {
            prompt = joined
          }
        } else {
          // Single segment: could be prompt or animation
          if (KNOWN_ANIMATIONS.has(joined)) {
            animation = joined
          } else {
            prompt = joined
          }
        }
      }
    } else {
      const tail = parts.slice(idx)
      if (tail.length > 0) {
        const maybeAnim = tail[tail.length - 1].trim()
        if (KNOWN_ANIMATIONS.has(maybeAnim)) { animation = maybeAnim }
        else if (tail.length === 1) { animation = inferredAnim || null }
      }
      if (!animation) animation = inferredAnim || null
    }

    return { type: 'sprite', characterId, vnName, position, expression, isNew, prompt, animation }
  }

  /**
   * @param {string} line
   * @returns {MeetCgInstruction | null}
   */
  function parseCgLine(line) {
    const match = String(line || '').match(/^\[cg:\s*(.+?)\s*\]\s*$/i)
    if (!match) return null
    const inner = match[1].trim()
    if (!inner) return null

    if (/^(off|none|null|stop)$/i.test(inner)) {
      return { type: 'cg', name: null, off: true, isNew: false, prompt: null }
    }

    const isNew = inner.toUpperCase().startsWith('NEW:')
    if (isNew) {
      const rest = inner.slice(4).trim()
      if (!rest) return null
      const firstColonIdx = rest.indexOf(':')
      const name = (firstColonIdx === -1 ? rest : rest.slice(0, firstColonIdx)).trim()
      const prompt = (firstColonIdx === -1 ? '' : rest.slice(firstColonIdx + 1)).trim()
      if (!name) return null
      return { type: 'cg', name, off: false, isNew: true, prompt: prompt || null }
    }

    const firstColonIdx = inner.indexOf(':')
    const name = (firstColonIdx === -1 ? inner : inner.slice(0, firstColonIdx)).trim()
    const prompt = (firstColonIdx === -1 ? '' : inner.slice(firstColonIdx + 1)).trim()
    if (!name) return null
    return { type: 'cg', name, off: false, isNew: false, prompt: prompt || null }
  }

  function normalizeMeetLine(rawLine) {
    return String(rawLine || '')
      .trim()
      // Allow Chinese/full-width brackets in LLM output.
      .replace(/[【〔［]/g, '[')
      .replace(/[】〕］]/g, ']')
      // Allow full-width colon in instruction tags.
      .replace(/：/g, ':')
  }

  /**
   * @param {string} rawValue
   * @returns {{ operation: 'set' | 'add', value: string | number }}
   */
  function parseMoodValue(rawValue) {
    const valueText = String(rawValue || '').trim()
    const numericValue = Number(valueText)
    /** @type {'set' | 'add'} */
    let operation = 'set'
    /** @type {string | number} */
    let value = valueText

    if (valueText.startsWith('+') || valueText.startsWith('-')) {
      operation = 'add'
      value = Number.isNaN(numericValue) ? valueText : numericValue
      return { operation, value }
    }

    if (!Number.isNaN(numericValue)) {
      value = numericValue
    }

    return { operation, value }
  }

  /**
   * @param {string} rawValue
   * @returns {{ operation: 'set' | 'add', value: string | number | boolean }}
   */
  function parseVariableValue(rawValue) {
    const valueText = String(rawValue || '').trim()
    const numericValue = Number(valueText)
    /** @type {'set' | 'add'} */
    let operation = 'set'
    /** @type {string | number | boolean} */
    let value = valueText

    if (valueText.startsWith('+') || valueText.startsWith('-')) {
      operation = 'add'
      value = Number.isNaN(numericValue) ? valueText : numericValue
      return { operation, value }
    }

    if (valueText === 'true' || valueText === 'false') {
      value = valueText === 'true'
      return { operation, value }
    }

    if (!Number.isNaN(numericValue)) {
      value = numericValue
    }

    return { operation, value }
  }

  /**
   * @param {string} rawText
   * @param {MeetParserOptions} [options]
   * @returns {MeetInstruction[]}
   */
  function parse(rawText, options = {}) {
    const { characters = [] } = options
    /** @type {Record<string, MeetCharacterRef>} */
    const charMap = {}
    characters.forEach(c => {
      const rawName = String(c?.vnName || '').trim()
      if (!rawName) return
      charMap[rawName] = c
      const normalized = normalizeCharacterToken(rawName)
      if (normalized) charMap[normalized] = c
    })

    const lines = String(rawText || '').split('\n')
    /** @type {MeetInstruction[]} */
    const instructions = []
    let inChoices = false
    let currentChoices = []

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim()
      const line = normalizeMeetLine(rawLine)
      if (!line) continue

      // --- Choices block (highest priority) ---
      if (PATTERNS.choicesStart.test(line)) { inChoices = true; currentChoices = []; continue }
      if (PATTERNS.choicesEnd.test(line)) {
        inChoices = false
        if (currentChoices.length > 0) instructions.push({ type: 'choices', options: currentChoices })
        continue
      }
      if (inChoices) {
        const cm = line.match(PATTERNS.choiceItem)
        if (cm) currentChoices.push({ text: (cm[1] || '').trim(), effect: cm[2] ? cm[2].trim() : null })
        continue
      }

      // --- keyword instructions: location, time, mood ---
      const locMatch = line.match(PATTERNS.location)
      if (locMatch) {
        instructions.push({ type: 'location', value: locMatch[1].trim() })
        continue
      }

      const timeMatch = line.match(PATTERNS.time)
      if (timeMatch) {
        instructions.push({ type: 'time', value: timeMatch[1].trim() })
        continue
      }

      const moodMatch = line.match(PATTERNS.mood)
      if (moodMatch) {
        const charName = moodMatch[1].trim()
        const { operation, value } = parseMoodValue(moodMatch[2])
        instructions.push({ type: 'mood', characterName: charName, operation, value })
        continue
      }

      // --- BGM ---
      const bgmMatch = line.match(/^\[bgm[:：]\s*([^\]]+?)\s*\]\s*$/i)
      if (bgmMatch) {
        const rawName = bgmMatch[1].trim()
        const shouldStop = /^(stop|none|null|off)$/i.test(rawName)
        instructions.push({ type: 'bgm', name: shouldStop ? null : rawName })
        continue
      }

      // --- SFX ---
      const sfxMatch = line.match(/^\[sfx[:：]\s*([^\]]+?)\s*\]\s*$/i)
      if (sfxMatch) {
        const rawName = sfxMatch[1].trim()
        const shouldStop = /^(stop|none|null|off)$/i.test(rawName)
        instructions.push({ type: 'sfx', name: shouldStop ? null : rawName })
        continue
      }

      // --- CG ---
      const cgInst = parseCgLine(line)
      if (cgInst) {
        instructions.push(cgInst)
        continue
      }

      // --- Background ---
      const bgInst = parseBgLine(line)
      if (bgInst) {
        instructions.push(bgInst)
        continue
      }

      // --- Sprite ---
      const spriteInst = parseSpriteLine(line, charMap)
      if (spriteInst) { instructions.push(spriteInst); continue }

      // --- Variable ---
      const varMatch = line.match(PATTERNS.variable)
      if (varMatch) {
        const key = varMatch[1].trim()
        const { operation, value } = parseVariableValue(varMatch[2])
        instructions.push({ type: 'variable', key, operation, value })
        continue
      }

      // --- Narration (asterisk-wrapped) ---
      const narMatch = line.match(PATTERNS.narration)
      if (narMatch) { instructions.push({ type: 'narration', text: narMatch[1].trim() }); continue }

      // --- New dialog format: [角色名] 内容 ---
      const tagDlg = line.match(PATTERNS.tagDialog)
      if (tagDlg) {
        const vnName = tagDlg[1].trim()
        const dialogText = String(tagDlg[2] || '').trim()
        // Exclude instruction keywords from being parsed as character names
        if (dialogText && !isInstructionKeywordName(vnName)) {
          instructions.push({ type: 'dialog', characterId: getCharacterId(charMap, vnName), vnName, text: dialogText })
          continue
        }
      }

      // --- Old dialog format: 角色名：内容 (fallback) ---
      const dlgMatch = line.match(PATTERNS.dialog)
      if (dlgMatch) {
        const vnName = dlgMatch[1].trim()
        const dialogText = String(dlgMatch[2] || '').trim()
        if (dialogText && !isInstructionKeywordName(vnName)) {
          instructions.push({ type: 'dialog', characterId: getCharacterId(charMap, vnName), vnName, text: dialogText })
          continue
        }
      }

      // --- Fallback: narration ---
      instructions.push({ type: 'narration', text: rawLine })
    }

    return instructions
  }

  /**
   * @param {MeetInstruction[]} instructions
   * @returns {MeetNewResourceSummary}
   */
  function extractNewResources(instructions) {
    const backgrounds = []
    const sprites = []
    ;(instructions || []).forEach(inst => {
      if (inst?.type === 'bg' && inst.isNew && inst.prompt) backgrounds.push({ name: inst.name, prompt: inst.prompt })
      if (inst?.type === 'sprite' && inst.isNew && inst.prompt) sprites.push({ characterId: inst.characterId, vnName: inst.vnName, expression: inst.expression, prompt: inst.prompt })
    })
    return { backgrounds, sprites }
  }

  return { parse, extractNewResources, PATTERNS }
}
