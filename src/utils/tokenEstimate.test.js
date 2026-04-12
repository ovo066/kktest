import { beforeAll, describe, expect, it } from 'vitest'
import { countTokens as countO200kTokens } from 'gpt-tokenizer'
import { countTokens as countGpt4oTokens } from 'gpt-tokenizer/model/gpt-4o'
import { countTokens as countGpt5Tokens } from 'gpt-tokenizer/model/gpt-5'
import { fromPreTrained as createClaudeTokenizer } from '@lenml/tokenizer-claude'
import { fromPreTrained as createDeepSeekTokenizer } from '@lenml/tokenizer-deepseek_v3'
import { fromPreTrained as createGeminiTokenizer } from '@lenml/tokenizer-gemini'
import { estimateTokensForModel, preloadTokenEstimatorForModel } from './tokenEstimate'

const claudeTokenizer = createClaudeTokenizer()
const deepSeekTokenizer = createDeepSeekTokenizer()
const geminiTokenizer = createGeminiTokenizer()

describe('tokenEstimate', () => {
  beforeAll(async () => {
    await Promise.all([
      preloadTokenEstimatorForModel('claude-3-5-sonnet'),
      preloadTokenEstimatorForModel('gpt-4o'),
      preloadTokenEstimatorForModel('openrouter/openai/gpt-5.4'),
      preloadTokenEstimatorForModel('deepseek-chat'),
      preloadTokenEstimatorForModel('gemini-2.5-pro'),
      preloadTokenEstimatorForModel('custom-private-model')
    ])
  })

  it('prefers claude tokenizer when model is claude', () => {
    const text = '你好，Claude。Please summarize this in 3 bullets.'
    const expected = claudeTokenizer.encode(text).length
    const actual = estimateTokensForModel(text, 'claude-3-5-sonnet')
    expect(actual).toBe(expected)
  })

  it('supports fuzzy claude model id with provider prefix and version', () => {
    const text = 'Testing claude tokenizer on provider-prefixed model id.'
    const expected = claudeTokenizer.encode(text).length
    const actual = estimateTokensForModel(text, 'openrouter/anthropic/claude-4.6-sonnet')
    expect(actual).toBe(expected)
  })

  it('prefers gpt tokenizer when model is openai family', () => {
    const text = 'Hello GPT-4o, token count test with 中文 mixed text.'
    const expected = countGpt4oTokens(text)
    const actual = estimateTokensForModel(text, 'gpt-4o')
    expect(actual).toBe(expected)
  })

  it('supports fuzzy gpt model id and maps gpt-5.4 to gpt-5 tokenizer', () => {
    const text = 'Testing GPT tokenizer fuzzy matching for 5.4 style ids.'
    const expected = countGpt5Tokens(text)
    const actual = estimateTokensForModel(text, 'openrouter/openai/gpt-5.4')
    expect(actual).toBe(expected)
  })

  it('prefers deepseek tokenizer when model is deepseek family', () => {
    const text = '你好，DeepSeek。Token test with mixed English and 中文。'
    const expected = deepSeekTokenizer.encode(text).length
    const actual = estimateTokensForModel(text, 'deepseek-chat')
    expect(actual).toBe(expected)
  })

  it('supports fuzzy deepseek model id with provider prefix', () => {
    const text = 'Testing DeepSeek tokenizer on provider-prefixed model id.'
    const expected = deepSeekTokenizer.encode(text).length
    const actual = estimateTokensForModel(text, 'openrouter/deepseek/deepseek-r1')
    expect(actual).toBe(expected)
  })

  it('prefers gemini tokenizer when model is gemini family', () => {
    const text = '你好 Gemini，please output a concise summary with bullet points.'
    const expected = geminiTokenizer.encode(text).length
    const actual = estimateTokensForModel(text, 'gemini-2.5-pro')
    expect(actual).toBe(expected)
  })

  it('supports fuzzy gemini model id with provider prefix', () => {
    const text = 'Testing Gemini tokenizer on provider-prefixed model id.'
    const expected = geminiTokenizer.encode(text).length
    const actual = estimateTokensForModel(text, 'openrouter/google/gemini-2.5-flash')
    expect(actual).toBe(expected)
  })

  it('uses o200k tokenizer for unknown model family', () => {
    const text = '纯中文测试文本 with some English mixed in.'
    const expected = countO200kTokens(text)
    const actual = estimateTokensForModel(text, 'custom-private-model')
    expect(actual).toBe(expected)
  })
})
