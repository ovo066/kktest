/**
 * VN 输出解析器
 * 将 LLM 的结构化文本输出解析为 VNInstruction 数组
 */

export function useVNParser() {
  const PATTERNS = {
    // [bg:教室_白天] 或 [bg:NEW:走廊:school hallway, anime style]
    bg: /^\[bg:(?:NEW:)?([^:\]]+)(?::([^\]]+))?\]\s*$/,

    // [choices] ... [/choices]
    choicesStart: /^\[choices\]\s*$/,
    choicesEnd: /^\[\/choices\]\s*$/,
    choiceItem: /^\s*-\s*(.+?)(?:\s*->\s*(.+))?\s*$/,

    // [var:affection.小樱:+1]  [var:flags.day1:true]
    variable: /^\[var:([^:\]]+):([^\]]+)\]\s*$/,

    // 旁白: *text*
    narration: /^\*(.+)\*$/,

    // 对话: 角色名：对话内容  或  角色名: 对话内容
    dialog: /^([^：:*\[\]\n]{1,20})[：:]\s*(.+)$/
  }

  const KNOWN_ANIMATIONS = new Set([
    'fadeIn', 'slideLeft', 'slideRight', 'slideUp', 'bounce',
    'shake', 'jump', 'nod',
    'fadeOut'
  ])

  function parseSpriteLine(line, charMap) {
    if (!line.startsWith('[sprite:') || !line.endsWith(']')) return null
    const inner = line.slice('[sprite:'.length, -1)
    const parts = inner.split(':')
    if (parts.length < 2) return null

    const vnName = (parts[0] || '').trim()
    const positionRaw = (parts[1] || '').trim()
    if (!vnName || !positionRaw) return null

    const characterId = charMap[vnName]?.contactId || vnName

    // Exit
    if (positionRaw === 'none') {
      const animation = (parts[2] || 'fadeOut').trim() || 'fadeOut'
      return {
        type: 'sprite',
        characterId,
        vnName,
        position: 'none',
        expression: '',
        isNew: false,
        prompt: null,
        animation
      }
    }

    // Move: left>center
    let position = positionRaw
    let inferredAnim = null
    if (positionRaw.includes('>')) {
      const to = positionRaw.split('>').pop()
      position = (to || '').trim() || positionRaw
      inferredAnim = 'slide'
    }

    // Parse remaining tokens.
    // Formats:
    // [sprite:角色名:位置:表情]
    // [sprite:角色名:位置:表情:动画]
    // [sprite:角色名:位置:NEW:表情:英文prompt]
    // [sprite:角色名:位置:NEW:表情:英文prompt:动画]
    let idx = 2
    let isNew = false
    if ((parts[idx] || '').trim() === 'NEW') {
      isNew = true
      idx += 1
    }

    const expression = ((parts[idx] || 'normal') + '').trim() || 'normal'
    idx += 1

    let prompt = null
    let animation = null

    if (isNew) {
      const rest = parts.slice(idx)
      if (rest.length === 0) {
        prompt = null
      } else if (rest.length === 1) {
        prompt = rest[0].trim()
      } else {
        const last = rest[rest.length - 1].trim()
        if (KNOWN_ANIMATIONS.has(last)) {
          animation = last
          prompt = rest.slice(0, -1).join(':').trim()
        } else {
          prompt = rest.join(':').trim()
        }
      }
    } else {
      const tail = parts.slice(idx)
      if (tail.length > 0) {
        const maybeAnim = tail[tail.length - 1].trim()
        if (KNOWN_ANIMATIONS.has(maybeAnim)) {
          animation = maybeAnim
        } else if (tail.length === 1) {
          // Some models may output move-only hints; allow.
          animation = inferredAnim || null
        }
      }
      if (!animation) animation = inferredAnim || null
    }

    return {
      type: 'sprite',
      characterId,
      vnName,
      position,
      expression,
      isNew,
      prompt,
      animation
    }
  }

  /**
   * 解析 LLM 输出文本为指令数组
   * @param {string} rawText - LLM 原始输出
   * @param {Object} options - { characters: [{ vnName, contactId }] }
   * @returns {Array}
   */
  function parse(rawText, options = {}) {
    const { characters = [] } = options
    const charMap = {}
    characters.forEach(c => { if (c?.vnName) charMap[c.vnName] = c })

    const lines = String(rawText || '').split('\n')
    const instructions = []
    let inChoices = false
    let currentChoices = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // --- Choices block ---
      if (PATTERNS.choicesStart.test(line)) {
        inChoices = true
        currentChoices = []
        continue
      }
      if (PATTERNS.choicesEnd.test(line)) {
        inChoices = false
        if (currentChoices.length > 0) {
          instructions.push({ type: 'choices', options: currentChoices })
        }
        continue
      }
      if (inChoices) {
        const cm = line.match(PATTERNS.choiceItem)
        if (cm) {
          currentChoices.push({
            text: (cm[1] || '').trim(),
            effect: cm[2] ? cm[2].trim() : null
          })
        }
        continue
      }

      // --- BGM ---
      const bgmMatch = line.match(/^\[bgm:([^\]]+)\]$/)
      if (bgmMatch) {
        const bgmName = bgmMatch[1].trim()
        instructions.push({
          type: 'bgm',
          name: bgmName === 'stop' ? null : bgmName
        })
        continue
      }

      // --- Background ---
      const bgMatch = line.match(PATTERNS.bg)
      if (bgMatch) {
        const isNew = line.includes('[bg:NEW:')
        instructions.push({
          type: 'bg',
          name: bgMatch[1].trim(),
          isNew,
          prompt: bgMatch[2] ? bgMatch[2].trim() : null,
          transition: 'fade'
        })
        continue
      }

      // --- Sprite ---
      const spriteInst = parseSpriteLine(line, charMap)
      if (spriteInst) {
        instructions.push(spriteInst)
        continue
      }

      // --- Variable ---
      const varMatch = line.match(PATTERNS.variable)
      if (varMatch) {
        const key = varMatch[1].trim()
        const rawVal = varMatch[2].trim()
        let operation = 'set'
        let value = rawVal

        if (rawVal.startsWith('+') || rawVal.startsWith('-')) {
          operation = 'add'
          value = parseFloat(rawVal)
        } else if (rawVal === 'true' || rawVal === 'false') {
          value = rawVal === 'true'
        } else if (!isNaN(rawVal)) {
          value = parseFloat(rawVal)
        }

        instructions.push({ type: 'variable', key, operation, value })
        continue
      }

      // --- Narration ---
      const narMatch = line.match(PATTERNS.narration)
      if (narMatch) {
        instructions.push({ type: 'narration', text: narMatch[1].trim() })
        continue
      }

      // --- Dialog ---
      const dlgMatch = line.match(PATTERNS.dialog)
      if (dlgMatch) {
        const vnName = dlgMatch[1].trim()
        instructions.push({
          type: 'dialog',
          characterId: charMap[vnName]?.contactId || vnName,
          vnName,
          text: dlgMatch[2].trim()
        })
        continue
      }

      // --- Fallback: narration ---
      instructions.push({ type: 'narration', text: line })
    }

    return instructions
  }

  /**
   * 从指令数组中提取需要生成的新资源
   * @param {Array} instructions
   */
  function extractNewResources(instructions) {
    const backgrounds = []
    const sprites = []

    ;(instructions || []).forEach(inst => {
      if (inst?.type === 'bg' && inst.isNew && inst.prompt) {
        backgrounds.push({ name: inst.name, prompt: inst.prompt })
      }
      if (inst?.type === 'sprite' && inst.isNew && inst.prompt) {
        sprites.push({
          characterId: inst.characterId,
          vnName: inst.vnName,
          expression: inst.expression,
          prompt: inst.prompt
        })
      }
    })

    return { backgrounds, sprites }
  }

  return { parse, extractNewResources, PATTERNS }
}

