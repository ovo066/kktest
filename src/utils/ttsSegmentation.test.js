import { describe, expect, it } from 'vitest'
import {
  splitForCallTranscriptPlayback,
  splitForTTS,
  splitForVoiceMode
} from './ttsSegmentation'

describe('ttsSegmentation', () => {
  it('prefers punctuation boundaries once the minimum segment length is satisfied', () => {
    const segments = splitForTTS('这是一个足够长的第一句，需要在标点处切开。第二句也应该完整保留。', 20)

    expect(segments).toEqual(['这是一个足够长的第一句，需要在标点处切开。', '第二句也应该完整保留。'])
  })

  it('uses stricter minimax segmentation limits', () => {
    const text = 'A'.repeat(95)

    expect(splitForVoiceMode(text, 'minimax')).toHaveLength(2)
    expect(splitForVoiceMode(text, 'edge')).toHaveLength(1)
  })

  it('keeps transcript playback aligned to sentence boundaries', () => {
    const segments = splitForCallTranscriptPlayback('第一句。第二句！第三句没有标点', 'browser')

    expect(segments).toEqual(['第一句。', '第二句！', '第三句没有标点'])
  })
})
