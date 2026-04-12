import { computed } from 'vue'
import { renderOfflineContent } from '../utils/offlineRichText'

export function useOfflineRenderer(offlineMsgs, regexRules, streamingText, isGenerating) {
  const segments = computed(() => {
    const msgs = offlineMsgs.value || []
    const rules = regexRules.value || []
    const result = []

    for (const msg of msgs) {
      const rendered = renderOfflineContent(msg.content, rules)
      result.push({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        html: rendered.html,
        htmlDocument: rendered.htmlDocument,
        renderMode: rendered.mode,
        time: msg.time,
        stats: msg.stats || null,
        truncated: msg.truncated === true || msg?.stats?.truncated === true
      })
    }

    // Add streaming segment
    if (isGenerating.value && streamingText.value) {
      const rendered = renderOfflineContent(streamingText.value, rules)
      result.push({
        id: '__streaming__',
        role: 'assistant',
        content: streamingText.value,
        html: rendered.html,
        htmlDocument: rendered.htmlDocument,
        renderMode: rendered.mode,
        time: Date.now(),
        isStreaming: true
      })
    }

    return result
  })

  return { segments }
}
