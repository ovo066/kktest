/**
 * Token estimation for display purposes.
 *
 * Model-specific tokenizers: claude, deepseek, gemini, openai family.
 * Unknown models fall back to OpenAI o200k tokenizer.
 * Simple heuristic is only used while tokenizers are still loading.
 */
import { estimateTokens as estimateTokensHeuristic } from './tokens'
import claudeTokenizerJsonUrl from '@lenml/tokenizer-claude/models/tokenizer.json?url'
import claudeTokenizerConfigUrl from '@lenml/tokenizer-claude/models/tokenizer_config.json?url'
import deepSeekTokenizerJsonUrl from '@lenml/tokenizer-deepseek_v3/models/tokenizer.json?url'
import deepSeekTokenizerConfigUrl from '@lenml/tokenizer-deepseek_v3/models/tokenizer_config.json?url'
import geminiTokenizerJsonUrl from '@lenml/tokenizer-gemini/models/tokenizer.json?url'
import geminiTokenizerConfigUrl from '@lenml/tokenizer-gemini/models/tokenizer_config.json?url'

function toPositiveInt(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n)
}

const TOKEN_COUNT_CACHE = new Map()
const TOKEN_COUNT_CACHE_MAX = 800
const USE_DIRECT_SPECIAL_TOKENIZER_IMPORTS = import.meta.env.MODE === 'test'
let claudeTokenizer = null
let deepSeekTokenizer = null
let geminiTokenizer = null
const openAITokenizers = {
  o200k: null,
  'gpt-3.5': null,
  'gpt-4': null,
  'gpt-4o': null,
  'gpt-4.1': null,
  'gpt-5': null,
  o1: null,
  o3: null,
  'o4-mini': null
}
const OPENAI_TOKENIZER_IMPORT_PATHS = {
  o200k: 'gpt-tokenizer',
  'gpt-3.5': 'gpt-tokenizer/model/gpt-3.5-turbo',
  'gpt-4': 'gpt-tokenizer/model/gpt-4',
  'gpt-4o': 'gpt-tokenizer/model/gpt-4o',
  'gpt-4.1': 'gpt-tokenizer/model/gpt-4.1',
  'gpt-5': 'gpt-tokenizer/model/gpt-5',
  o1: 'gpt-tokenizer/model/o1',
  o3: 'gpt-tokenizer/model/o3',
  'o4-mini': 'gpt-tokenizer/model/o4-mini'
}
const openAITokenizerLoadPromises = {}
const tokenizerLoadState = {
  claude: 'idle',
  deepseek: 'idle',
  gemini: 'idle'
}
const specialTokenizerAssetUrls = Object.freeze({
  claude: {
    tokenizerJSON: claudeTokenizerJsonUrl,
    tokenizerConfig: claudeTokenizerConfigUrl
  },
  deepseek: {
    tokenizerJSON: deepSeekTokenizerJsonUrl,
    tokenizerConfig: deepSeekTokenizerConfigUrl
  },
  gemini: {
    tokenizerJSON: geminiTokenizerJsonUrl,
    tokenizerConfig: geminiTokenizerConfigUrl
  }
})
let claudeTokenizerLoadPromise = null
let deepSeekTokenizerLoadPromise = null
let geminiTokenizerLoadPromise = null

function normalizeModelId(model) {
  const raw = String(model || '').trim().toLowerCase()
  if (!raw) return ''
  const parts = raw.split(/[/:]/).filter(Boolean)
  const tail = parts.length > 0 ? parts[parts.length - 1] : raw
  return tail.replace(/@.*$/, '').replace(/\s+/g, '')
}

function getModelFamily(model) {
  const raw = String(model || '').toLowerCase()
  const name = normalizeModelId(model) || raw
  if (!name) return 'default'
  if (name.includes('claude') || raw.includes('anthropic')) return 'claude'
  if (name.includes('deepseek')) return 'deepseek'
  if (name.includes('gemini')) return 'gemini'
  if (
    name.startsWith('gpt') ||
    name.startsWith('chatgpt') ||
    /^o\d/.test(name) ||
    raw.includes('openai')
  ) {
    return 'openai'
  }
  return 'default'
}

function readCachedCount(cacheKey) {
  if (!TOKEN_COUNT_CACHE.has(cacheKey)) return 0
  const cached = TOKEN_COUNT_CACHE.get(cacheKey)
  TOKEN_COUNT_CACHE.delete(cacheKey)
  TOKEN_COUNT_CACHE.set(cacheKey, cached)
  return cached
}

function writeCachedCount(cacheKey, tokens) {
  if (TOKEN_COUNT_CACHE.size >= TOKEN_COUNT_CACHE_MAX) {
    const oldestKey = TOKEN_COUNT_CACHE.keys().next().value
    if (oldestKey != null) TOKEN_COUNT_CACHE.delete(oldestKey)
  }
  TOKEN_COUNT_CACHE.set(cacheKey, tokens)
}

function loadOpenAITokenizer(key) {
  if (typeof openAITokenizers[key] === 'function') return Promise.resolve(true)
  if (openAITokenizers[key] === false) return Promise.resolve(false)
  if (openAITokenizerLoadPromises[key]) return openAITokenizerLoadPromises[key]

  const importPath = OPENAI_TOKENIZER_IMPORT_PATHS[key]
  if (!importPath) return Promise.resolve(false)

  openAITokenizerLoadPromises[key] = import(importPath).then((module) => {
    openAITokenizers[key] = module.countTokens
    return true
  }).catch(() => {
    openAITokenizers[key] = false
    return false
  }).finally(() => {
    delete openAITokenizerLoadPromises[key]
  })

  return openAITokenizerLoadPromises[key]
}

function buildTokenizerFromModule(kind, module) {
  if (typeof module?.fromPreTrained === 'function') {
    return module.fromPreTrained()
  }
  throw new Error(`Unsupported tokenizer module: ${kind}`)
}

async function loadSpecialTokenizerFromAssets(kind) {
  const urls = specialTokenizerAssetUrls[kind]
  if (!urls) throw new Error(`Unknown tokenizer assets: ${kind}`)
  const module = await import('@lenml/tokenizers')
  return module.TokenizerLoader.fromPreTrainedUrls(urls)
}

async function createSpecialTokenizer(kind) {
  if (USE_DIRECT_SPECIAL_TOKENIZER_IMPORTS) {
    if (kind === 'claude') {
      return buildTokenizerFromModule(kind, await import('@lenml/tokenizer-claude'))
    }
    if (kind === 'deepseek') {
      return buildTokenizerFromModule(kind, await import('@lenml/tokenizer-deepseek_v3'))
    }
    if (kind === 'gemini') {
      return buildTokenizerFromModule(kind, await import('@lenml/tokenizer-gemini'))
    }
  }

  return loadSpecialTokenizerFromAssets(kind)
}

function loadClaudeTokenizer() {
  if (tokenizerLoadState.claude === 'ready') return Promise.resolve(true)
  if (tokenizerLoadState.claude === 'failed') return Promise.resolve(false)
  if (claudeTokenizerLoadPromise) return claudeTokenizerLoadPromise

  tokenizerLoadState.claude = 'loading'
  claudeTokenizerLoadPromise = createSpecialTokenizer('claude').then((tokenizer) => {
    claudeTokenizer = tokenizer
    tokenizerLoadState.claude = 'ready'
    return true
  }).catch(() => {
    claudeTokenizer = false
    tokenizerLoadState.claude = 'failed'
    return false
  }).finally(() => {
    claudeTokenizerLoadPromise = null
  })

  return claudeTokenizerLoadPromise
}

function loadDeepSeekTokenizer() {
  if (tokenizerLoadState.deepseek === 'ready') return Promise.resolve(true)
  if (tokenizerLoadState.deepseek === 'failed') return Promise.resolve(false)
  if (deepSeekTokenizerLoadPromise) return deepSeekTokenizerLoadPromise

  tokenizerLoadState.deepseek = 'loading'
  deepSeekTokenizerLoadPromise = createSpecialTokenizer('deepseek').then((tokenizer) => {
    deepSeekTokenizer = tokenizer
    tokenizerLoadState.deepseek = 'ready'
    return true
  }).catch(() => {
    deepSeekTokenizer = false
    tokenizerLoadState.deepseek = 'failed'
    return false
  }).finally(() => {
    deepSeekTokenizerLoadPromise = null
  })

  return deepSeekTokenizerLoadPromise
}

function loadGeminiTokenizer() {
  if (tokenizerLoadState.gemini === 'ready') return Promise.resolve(true)
  if (tokenizerLoadState.gemini === 'failed') return Promise.resolve(false)
  if (geminiTokenizerLoadPromise) return geminiTokenizerLoadPromise

  tokenizerLoadState.gemini = 'loading'
  geminiTokenizerLoadPromise = createSpecialTokenizer('gemini').then((tokenizer) => {
    geminiTokenizer = tokenizer
    tokenizerLoadState.gemini = 'ready'
    return true
  }).catch(() => {
    geminiTokenizer = false
    tokenizerLoadState.gemini = 'failed'
    return false
  }).finally(() => {
    geminiTokenizerLoadPromise = null
  })

  return geminiTokenizerLoadPromise
}

export function preloadTokenEstimatorForModel(model = '') {
  const family = getModelFamily(model)
  if (family === 'openai') {
    return loadOpenAITokenizer(resolveOpenAITokenizer(model).key)
  }
  if (family === 'claude') {
    return loadClaudeTokenizer()
  }
  if (family === 'deepseek') {
    return loadDeepSeekTokenizer()
  }
  if (family === 'gemini') {
    return loadGeminiTokenizer()
  }
  return loadOpenAITokenizer('o200k')
}

function getClaudeTokenizer() {
  if (claudeTokenizer === false) return null
  if (claudeTokenizer) return claudeTokenizer
  void loadClaudeTokenizer()
  return null
}

function getDeepSeekTokenizer() {
  if (deepSeekTokenizer === false) return null
  if (deepSeekTokenizer) return deepSeekTokenizer
  void loadDeepSeekTokenizer()
  return null
}

function getGeminiTokenizer() {
  if (geminiTokenizer === false) return null
  if (geminiTokenizer) return geminiTokenizer
  void loadGeminiTokenizer()
  return null
}

function resolveOpenAITokenizer(model) {
  const id = normalizeModelId(model)
  if (/^o4([\-._]|$)/.test(id) || id.startsWith('o4mini')) {
    return { key: 'o4-mini', count: openAITokenizers['o4-mini'] }
  }
  if (/^o3([\-._]|$)/.test(id)) {
    return { key: 'o3', count: openAITokenizers.o3 }
  }
  if (/^o1([\-._]|$)/.test(id)) {
    return { key: 'o1', count: openAITokenizers.o1 }
  }
  if (/gpt[-_]?5/.test(id)) {
    return { key: 'gpt-5', count: openAITokenizers['gpt-5'] }
  }
  if (/gpt[-_]?4[._-]?1/.test(id)) {
    return { key: 'gpt-4.1', count: openAITokenizers['gpt-4.1'] }
  }
  if (
    id.includes('4o') ||
    id.includes('omni') ||
    id.includes('audio') ||
    id.includes('realtime')
  ) {
    return { key: 'gpt-4o', count: openAITokenizers['gpt-4o'] }
  }
  if (/gpt[-_]?4/.test(id)) {
    return { key: 'gpt-4', count: openAITokenizers['gpt-4'] }
  }
  if (/gpt[-_]?3([._-]?5)?/.test(id) || id.includes('gpt35')) {
    return { key: 'gpt-3.5', count: openAITokenizers['gpt-3.5'] }
  }
  return { key: 'o200k', count: openAITokenizers.o200k }
}

function encodeWithTokenizer(tokenizer, text) {
  if (!tokenizer?.encode) return 0
  const encoded = tokenizer.encode(text)
  return toPositiveInt(Array.isArray(encoded) ? encoded.length : encoded?.length)
}

function countWithThirdPartyTokenizer(text, model) {
  const family = getModelFamily(model)

  const openaiTokenizer = (family === 'openai' || family === 'default')
    ? (family === 'openai' ? resolveOpenAITokenizer(model) : { key: 'o200k', count: openAITokenizers.o200k })
    : null
  const modelKey = openaiTokenizer
    ? openaiTokenizer.key
    : (normalizeModelId(model) || family)
  const cacheKey = `${modelKey}\n${text}`
  const cached = readCachedCount(cacheKey)
  if (cached > 0) return cached

  let tokens = 0
  try {
    if (family === 'claude') {
      tokens = encodeWithTokenizer(getClaudeTokenizer(), text)
    } else if (family === 'deepseek') {
      tokens = encodeWithTokenizer(getDeepSeekTokenizer(), text)
    } else if (family === 'gemini') {
      tokens = encodeWithTokenizer(getGeminiTokenizer(), text)
    } else {
      if (typeof openaiTokenizer?.count === 'function') {
        tokens = toPositiveInt(openaiTokenizer.count(text))
      } else {
        void loadOpenAITokenizer(openaiTokenizer?.key || 'o200k')
      }
    }
  } catch {
    tokens = 0
  }

  if (tokens > 0) writeCachedCount(cacheKey, tokens)
  return tokens
}

export function estimateTokens(text) {
  return estimateTokensForModel(text, '')
}

export function estimateTokensForModel(text, model) {
  const s = typeof text === 'string' ? text : String(text || '')
  if (!s) return 0

  const tokenizerCount = countWithThirdPartyTokenizer(s, model)
  if (tokenizerCount > 0) return tokenizerCount

  // Synchronous fallback while tokenizer is still loading
  return Math.max(1, estimateTokensHeuristic(s))
}

export function formatTokenCount(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(Math.round(n))
}
