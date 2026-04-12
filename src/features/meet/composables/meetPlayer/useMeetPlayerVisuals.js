// @ts-check

/** @typedef {import('../meetInstructionContracts').MeetBackgroundInstruction} MeetBackgroundInstruction */
/** @typedef {import('../meetInstructionContracts').MeetCgInstruction} MeetCgInstruction */
/** @typedef {import('../meetInstructionContracts').MeetInstruction} MeetInstruction */
/** @typedef {import('../meetInstructionContracts').MeetSpriteInstruction} MeetSpriteInstruction */
/** @typedef {import('./meetPlayerContracts').MeetPlayerSpriteState} MeetPlayerSpriteState */
/** @typedef {import('./meetPlayerContracts').MeetPlayerVisualsApi} MeetPlayerVisualsApi */
/** @typedef {import('./meetPlayerContracts').MeetPlayerVisualsOptions} MeetPlayerVisualsOptions */

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms || 0)))
}

/**
 * @param {MeetSpriteInstruction} inst
 * @param {string | null} spriteUrl
 * @param {number} existingIndex
 * @returns {MeetPlayerSpriteState}
 */
function buildSpriteData(inst, spriteUrl, existingIndex) {
  return {
    characterId: inst.characterId,
    vnName: inst.vnName,
    expression: inst.expression || 'normal',
    position: inst.position || 'center',
    animation: inst.animation || (existingIndex === -1 ? 'fadeIn' : null),
    url: spriteUrl,
    isExiting: false
  }
}

/**
 * @param {MeetPlayerVisualsOptions} options
 * @returns {MeetPlayerVisualsApi}
 */
export function useMeetPlayerVisuals({
  player,
  meetStore,
  scheduleSave,
  resolveBackground,
  resolveCG,
  pickAutoBGM,
  getSpriteUrl,
  ensureSprite,
  currentBgmUrl
}) {
  const pendingSpriteResolves = new Map()

  function resolveSpriteUrl(characterId, expression) {
    return getSpriteUrl(characterId, expression || 'normal')
  }

  function resetVisualRuntime() {
    pendingSpriteResolves.clear()
  }

  function clearTransientSceneMedia() {
    if (!player.currentCg) return
    player.currentCg = null
    scheduleSave()
  }

  /**
   * @param {MeetSpriteInstruction} inst
   * @param {{ force?: boolean, allowGenerate?: boolean }} [options]
   */
  function queueSpriteResolve(inst, options = {}) {
    if (!inst?.characterId || inst.position === 'none') return

    const expression = inst.expression || 'normal'
    const key = [
      inst.characterId,
      expression,
      options.force ? 'force' : 'normal',
      options.allowGenerate === false ? 'nogenerate' : 'generate'
    ].join(':')
    if (pendingSpriteResolves.has(key)) return

    const task = ensureSprite({
      characterId: inst.characterId,
      vnName: inst.vnName || '',
      expression,
      prompt: inst.prompt || '',
      isNew: !!inst.isNew
    }, options)
      .then((url) => {
        if (!url) return
        const idx = player.sprites.findIndex((sprite) => sprite.characterId === inst.characterId)
        if (idx === -1) return
        if ((player.sprites[idx].expression || 'normal') !== expression) return
        player.sprites[idx].url = url
        scheduleSave()
      })
      .catch(() => {
        // Keep dialogue flow uninterrupted when sprite generation fails.
      })
      .finally(() => {
        pendingSpriteResolves.delete(key)
      })

    pendingSpriteResolves.set(key, task)
  }

  /** @param {{ name: string, prompt?: string | null }} inst */
  function queueBackgroundResolve(inst) {
    if (!inst?.name) return
    resolveBackground(inst.name, inst.prompt || inst.name)
      .then((url) => {
        if (!url) return
        if (player.currentBg?.name === inst.name) {
          player.currentBg = { name: inst.name, url }
        }
        scheduleSave()
      })
      .catch(() => {
        // Ignore background resolve failures in restore path.
      })
  }

  /** @param {MeetCgInstruction} inst @param {Record<string, unknown>} [options] */
  function queueCgResolve(inst, options = {}) {
    if (!inst?.name || inst.off) return
    resolveCG(inst.name, inst.prompt || inst.name, options)
      .then((url) => {
        if (!url) return
        if (player.currentCg?.name === inst.name) {
          player.currentCg = { name: inst.name, prompt: inst.prompt || '', url }
        }
        scheduleSave()
      })
      .catch(() => {
        // Ignore CG resolve failures in restore path.
      })
  }

  /**
   * @param {MeetInstruction} inst
   * @returns {boolean}
   */
  function applySnapshotMediaInstruction(inst) {
    if (!inst || typeof inst !== 'object') return false

    switch (inst.type) {
      case 'bg': {
        const resolved = inst.name ? meetStore.getResource('backgrounds', inst.name) : null
        player.currentBg = {
          name: inst.name || '',
          url: resolved?.url || null
        }
        if (!resolved?.url && inst.name) {
          queueBackgroundResolve(inst)
        }
        return true
      }
      case 'cg': {
        if (inst.off || !inst.name) {
          player.currentCg = null
          return true
        }
        const resolved = meetStore.getResource('cgs', inst.name)
        player.currentCg = {
          name: inst.name,
          prompt: inst.prompt || '',
          url: resolved?.url || null
        }
        if (!resolved?.url) {
          queueCgResolve(inst, { allowGenerate: false })
        }
        return true
      }
      case 'sprite': {
        if (inst.position === 'none') {
          const idx = player.sprites.findIndex((sprite) => sprite.characterId === inst.characterId)
          if (idx !== -1) player.sprites.splice(idx, 1)
          return true
        }
        const spriteData = {
          characterId: inst.characterId,
          vnName: inst.vnName,
          expression: inst.expression || 'normal',
          position: inst.position || 'center',
          animation: null,
          url: resolveSpriteUrl(inst.characterId, inst.expression),
          isExiting: false
        }
        const existing = player.sprites.findIndex((sprite) => sprite.characterId === inst.characterId)
        if (existing !== -1) player.sprites[existing] = spriteData
        else player.sprites.push(spriteData)
        queueSpriteResolve(inst, spriteData.url ? { allowGenerate: false } : {})
        return true
      }
      case 'bgm':
        player.currentBgm = inst.name || null
        return true
      case 'sfx':
        return true
      default:
        return false
    }
  }

  /** @param {MeetBackgroundInstruction} inst */
  async function handleBgInstruction(inst) {
    const bg = meetStore.getResource('backgrounds', inst.name)
    if (bg?.url) {
      player.currentBg = { name: inst.name, url: bg.url }
      return
    }

    const prompt = inst.prompt || inst.name
    try {
      const url = await resolveBackground(inst.name, prompt)
      if (url) {
        player.currentBg = { name: inst.name, url }
        return
      }
    } catch {
      // Ignore fetch errors.
    }

    player.currentBg = { name: inst.name, url: null }
  }

  /** @param {MeetCgInstruction} inst */
  async function handleCgInstruction(inst) {
    if (inst.off || !inst?.name) {
      player.currentCg = null
      return
    }

    const existing = meetStore.getResource('cgs', inst.name)
    if (existing?.url && !inst.isNew) {
      player.currentCg = {
        name: inst.name,
        prompt: inst.prompt || '',
        url: existing.url
      }
      return
    }

    try {
      const url = await resolveCG(inst.name, inst.prompt || inst.name, {
        force: !!inst.isNew,
        isNew: !!inst.isNew
      })
      player.currentCg = {
        name: inst.name,
        prompt: inst.prompt || '',
        url: url || existing?.url || null
      }
    } catch {
      player.currentCg = {
        name: inst.name,
        prompt: inst.prompt || '',
        url: existing?.url || null
      }
    }
  }

  /** @param {MeetSpriteInstruction} inst */
  async function handleSpriteInstruction(inst) {
    if (inst.position === 'none') {
      const idx = player.sprites.findIndex((sprite) => sprite.characterId === inst.characterId)
      if (idx !== -1) {
        player.sprites[idx].animation = inst.animation || 'fadeOut'
        player.sprites[idx].isExiting = true
        await wait(340)
        player.sprites.splice(idx, 1)
      }
      return
    }

    const existing = player.sprites.findIndex((sprite) => sprite.characterId === inst.characterId)
    const spriteData = buildSpriteData(
      inst,
      resolveSpriteUrl(inst.characterId, inst.expression),
      existing
    )

    if (existing !== -1) player.sprites[existing] = spriteData
    else player.sprites.push(spriteData)

    queueSpriteResolve(inst)
  }

  async function applyAutoSceneFixups({ sawBg, sawBgm, sawCg, locationChanged, timeChanged }) {
    let changed = false

    if (!sawBg && (locationChanged || timeChanged)) {
      const name = String(player.currentLocation || '').trim()
      if (name && player.currentBg?.name !== name) {
        const resolved = meetStore.getResource('backgrounds', name)
        player.currentBg = { name, url: resolved?.url || null }
        if (!resolved?.url) queueBackgroundResolve({ name, prompt: name })
        changed = true
      }
    }

    if (player.currentCg && !sawCg && (sawBg || locationChanged || timeChanged)) {
      player.currentCg = null
      changed = true
    }

    const shouldAutoPickBgm = !sawBgm && (
      !player.currentBgm ||
      !currentBgmUrl.value ||
      locationChanged ||
      timeChanged
    )

    if (shouldAutoPickBgm) {
      const picked = await pickAutoBGM({
        location: player.currentLocation,
        timeOfDay: player.currentTimeOfDay,
        text: player.currentDialog?.text || ''
      }).catch(() => null)
      if (picked?.name) {
        if (player.currentBgm !== picked.name) {
          player.currentBgm = picked.name
          changed = true
        }
        if (picked.url && currentBgmUrl.value !== picked.url) {
          currentBgmUrl.value = picked.url
          changed = true
        }
      }
    }

    if (changed) scheduleSave()
  }

  return {
    resetVisualRuntime,
    clearTransientSceneMedia,
    applySnapshotMediaInstruction,
    handleBgInstruction,
    handleCgInstruction,
    handleSpriteInstruction,
    applyAutoSceneFixups
  }
}
