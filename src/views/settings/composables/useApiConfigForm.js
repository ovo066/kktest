import { onMounted, reactive, ref, watch } from 'vue'

const DEFAULT_MODEL_LIST = Object.freeze(['gpt-3.5-turbo', 'gpt-4', 'gpt-4o'])

function normalizeCachedModelList(rawList) {
  if (!Array.isArray(rawList)) return []
  const dedup = new Set()
  const models = []
  for (const item of rawList) {
    const model = String(item || '').trim()
    if (!model || dedup.has(model)) continue
    dedup.add(model)
    models.push(model)
  }
  return models
}

export function useApiConfigForm({ fetchModels, scheduleSave, showConfirm, showToast, store }) {
  const modelLoading = ref(false)
  const modelList = ref([...DEFAULT_MODEL_LIST])
  const configForm = reactive({
    name: '',
    url: '',
    key: '',
    model: '',
    temperature: '',
    maxTokens: ''
  })

  function toInputValue(v) {
    return (v === null || v === undefined || v === '') ? '' : String(v)
  }

  function parseOptionalNumber(value, min, max, integer = false) {
    const raw = String(value ?? '').trim()
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return NaN
    if (n < min || n > max) return NaN
    if (integer && !Number.isInteger(n)) return NaN
    return n
  }

  function loadConfigInputs() {
    const c = store.configs.find(x => x.id === store.activeConfigId) || store.configs[0]
    if (!c) {
      modelList.value = [...DEFAULT_MODEL_LIST]
      return
    }

    configForm.name = c.name || ''
    configForm.url = c.url || ''
    configForm.key = c.key || ''
    configForm.model = c.model || ''
    configForm.temperature = toInputValue(c.temperature)
    configForm.maxTokens = toInputValue(c.maxTokens)

    const cachedModels = normalizeCachedModelList(c.cachedModels)
    modelList.value = cachedModels.length > 0 ? cachedModels : [...DEFAULT_MODEL_LIST]
  }

  function addConfig() {
    const id = 'cfg_' + Date.now()
    store.configs.push({ id, name: '新配置', url: 'https://api.openai.com/v1', key: '', model: 'gpt-3.5-turbo', temperature: null, maxTokens: null })
    store.activeConfigId = id
    scheduleSave()
    loadConfigInputs()
    showToast('已创建')
  }

  async function deleteConfig() {
    if (store.configs.length <= 1) {
      showToast('无法删除最后一个')
      return
    }
    const confirmed = await showConfirm({ message: '确定删除?', destructive: true })
    if (!confirmed) return
    store.configs = store.configs.filter(c => c.id !== store.activeConfigId)
    store.activeConfigId = store.configs[0].id
    scheduleSave()
    loadConfigInputs()
    showToast('已删除')
  }

  function saveConfig() {
    const c = store.configs.find(x => x.id === store.activeConfigId)
    if (!c) return false
    const previousUrl = String(c.url || '').trim()
    const previousKey = String(c.key || '').trim()

    const parsedTemperature = parseOptionalNumber(configForm.temperature, 0, 2, false)
    if (Number.isNaN(parsedTemperature)) {
      showToast('温度需在 0-2 之间')
      return false
    }
    const parsedMaxTokens = parseOptionalNumber(configForm.maxTokens, 1, 32768, true)
    if (Number.isNaN(parsedMaxTokens)) {
      showToast('输出上限需为 1-32768 的整数，留空不限制输出')
      return false
    }

    c.name = configForm.name.trim() || '未命名'
    c.url = configForm.url.trim()
    c.key = configForm.key.trim()
    c.model = configForm.model.trim()
    c.temperature = parsedTemperature
    c.maxTokens = parsedMaxTokens

    if (previousUrl !== c.url || previousKey !== c.key) {
      c.cachedModels = []
      c.cachedModelsUpdatedAt = null
      modelList.value = [...DEFAULT_MODEL_LIST]
    }

    scheduleSave()
    showToast('已保存')
    return true
  }

  async function handleFetchModels() {
    modelLoading.value = true
    const result = await fetchModels()
    modelLoading.value = false
    if (result.success) {
      const models = normalizeCachedModelList(result.models)
      modelList.value = models.length > 0 ? models : [...DEFAULT_MODEL_LIST]

      const c = store.configs.find(x => x.id === store.activeConfigId)
      if (c) {
        c.cachedModels = [...modelList.value]
        c.cachedModelsUpdatedAt = Date.now()
        scheduleSave()
      }

      showToast('已加载 ' + modelList.value.length + ' 个模型')
    } else {
      showToast(result.error)
    }
  }

  onMounted(() => {
    loadConfigInputs()
  })

  watch(() => store.activeConfigId, () => {
    loadConfigInputs()
    scheduleSave()
  })

  return {
    addConfig,
    configForm,
    deleteConfig,
    handleFetchModels,
    loadConfigInputs,
    modelList,
    modelLoading,
    saveConfig
  }
}
