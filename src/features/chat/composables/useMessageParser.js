import { computed } from 'vue'
import {
  GIFT_CATEGORIES,
  getGiftData,
  getGiftImageUrl,
  getGiftPrice,
  getAllGifts,
  getGiftsByCategory
} from '../../../data/gifts'
import { extractQuoteFromText } from '../../../utils/messageQuote'
import {
  estimateVoiceDuration,
  generateWaveform,
  parseMessageContent,
  rebuildMessageContent
} from './messageParser/contentParts'
import { buildMessageBlocks } from './messageParser/buildBlocks'
import { formatTimeShort, formatTimestampDisplay, isSameDay } from './messageParser/display'

export {
  GIFT_CATEGORIES,
  getGiftData,
  getGiftImageUrl,
  getGiftPrice,
  getAllGifts,
  getGiftsByCategory,
  extractQuoteFromText,
  estimateVoiceDuration,
  formatTimeShort,
  formatTimestampDisplay,
  generateWaveform,
  isSameDay,
  parseMessageContent,
  rebuildMessageContent
}

export function useMessageParser(options) {
  const blocks = computed(() => buildMessageBlocks(options))
  return { blocks }
}
