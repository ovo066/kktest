import { computed, ref } from 'vue'
import {
  collectImportedRegexRules,
  createEmptyOfflineRegexRule,
  normalizeOfflineRegexRule,
  normalizeOfflineRegexRules
} from '../../../utils/offlineRegex'
import { ensureOfflineContactFields } from '../../../utils/offlineSessionLinkage'

const REGEX_SCOPE_LABELS = {
  global: '全局正则',
  preset: '预设正则',
  character: '角色正则'
}

export function useOfflineRegexRules({ offlineStore, contact, scheduleSave, showToast }) {
  const editingRegexRule = ref(null)
  const editingRegexScope = ref('global')

  const activePreset = computed(() => {
    const presetId = String(offlineStore.activePresetId || '').trim()
    return presetId ? offlineStore.getPreset(presetId) : null
  })

  function getRulesByScope(scope) {
    if (scope === 'global') {
      return offlineStore.regexRules
    }

    if (scope === 'preset') {
      return activePreset.value?.regexRules || null
    }

    if (scope === 'character') {
      if (!contact?.value) return null
      ensureOfflineContactFields(contact.value)
      if (!Array.isArray(contact.value.offlineRegexRules)) {
        contact.value.offlineRegexRules = []
      }
      return contact.value.offlineRegexRules
    }

    return null
  }

  function ensureRulesByScope(scope) {
    if (scope === 'global') {
      if (!Array.isArray(offlineStore.regexRules)) {
        offlineStore.regexRules = []
      }
      return offlineStore.regexRules
    }

    if (scope === 'preset') {
      const preset = activePreset.value
      if (!preset) return null
      if (!Array.isArray(preset.regexRules)) {
        preset.regexRules = []
      }
      return preset.regexRules
    }

    if (scope === 'character') {
      if (!contact?.value) return null
      ensureOfflineContactFields(contact.value)
      if (!Array.isArray(contact.value.offlineRegexRules)) {
        contact.value.offlineRegexRules = []
      }
      return contact.value.offlineRegexRules
    }

    return null
  }

  function getScopeDisplayName(scope) {
    if (scope === 'preset') {
      return activePreset.value?.name || REGEX_SCOPE_LABELS.preset
    }
    if (scope === 'character') {
      return contact?.value?.name || REGEX_SCOPE_LABELS.character
    }
    return REGEX_SCOPE_LABELS.global
  }

  function normalizeScopeRules(scope) {
    const rules = ensureRulesByScope(scope)
    if (!rules) return null
    const normalized = normalizeOfflineRegexRules(rules)
    rules.splice(0, rules.length, ...normalized)
    return rules
  }

  function guardScope(scope) {
    if (scope === 'preset' && !activePreset.value) {
      showToast('请先选择一个预设')
      return false
    }
    if (scope === 'character' && !contact?.value) {
      showToast('未找到当前角色')
      return false
    }
    return true
  }

  function handleAddRegex(scope = 'global') {
    if (!guardScope(scope)) return
    const rules = ensureRulesByScope(scope)
    editingRegexScope.value = scope
    editingRegexRule.value = createEmptyOfflineRegexRule(rules?.length || 0)
  }

  function handleToggleRegex(scope, id) {
    const rule = (getRulesByScope(scope) || []).find(item => item.id === id)
    if (!rule) return
    rule.enabled = !rule.enabled
    scheduleSave()
  }

  function handleEditRegex(scope, id) {
    if (!guardScope(scope)) return
    const rule = (getRulesByScope(scope) || []).find(item => item.id === id)
    if (!rule) return
    editingRegexScope.value = scope
    editingRegexRule.value = { ...rule }
  }

  function handleDeleteRegex(scope, id) {
    const rules = ensureRulesByScope(scope)
    if (!rules) return
    const idx = rules.findIndex(rule => rule.id === id)
    if (idx === -1) return
    rules.splice(idx, 1)
    normalizeScopeRules(scope)
    scheduleSave()
  }

  function handleSaveRegex(payload) {
    const scope = String(payload?.scope || editingRegexScope.value || 'global')
    if (!guardScope(scope)) return
    const rules = ensureRulesByScope(scope)
    if (!rules) return

    const normalized = normalizeOfflineRegexRule(payload?.rule || payload, rules.length)
    if (!normalized) {
      showToast('请输入有效的正则表达式')
      return
    }

    const idx = rules.findIndex(rule => rule.id === normalized.id)
    if (idx !== -1) {
      rules.splice(idx, 1, normalized)
    } else {
      rules.push(normalized)
    }

    normalizeScopeRules(scope)
    editingRegexRule.value = null
    editingRegexScope.value = scope
    scheduleSave()
  }

  function handleCancelRegexEdit() {
    editingRegexRule.value = null
  }

  async function handleImportRegex(scope, file) {
    if (!guardScope(scope)) return
    const rules = ensureRulesByScope(scope)
    if (!rules) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const imported = collectImportedRegexRules(parsed)
      if (imported.length === 0) {
        showToast('未找到有效规则')
        return
      }

      let added = 0
      for (const ruleData of imported) {
        const normalized = normalizeOfflineRegexRule(ruleData, rules.length + added)
        if (!normalized) continue
        rules.push(normalized)
        added += 1
      }

      if (added === 0) {
        showToast('未找到有效规则')
        return
      }

      normalizeScopeRules(scope)
      scheduleSave()
      showToast(`已为${getScopeDisplayName(scope)}导入 ${added} 条正则规则`)
    } catch {
      showToast('导入失败')
    }
  }

  return {
    activePreset,
    editingRegexRule,
    editingRegexScope,
    handleAddRegex,
    handleToggleRegex,
    handleEditRegex,
    handleDeleteRegex,
    handleSaveRegex,
    handleCancelRegexEdit,
    handleImportRegex
  }
}
