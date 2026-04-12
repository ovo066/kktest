import { describe, expect, it } from 'vitest'
import { getAvailableTools } from './toolRegistry'

describe('toolRegistry', () => {
  it('only exposes后台型工具，不替换现有可见 token 能力', () => {
    const tools = getAvailableTools({
      allowPlannerAI: true,
      allowLivenessEngine: true,
      allowAIStickers: true,
      allowAIImageGeneration: true,
      allowAIMusicRecommend: true,
      syncForumToAI: true
    })

    expect(tools.map((tool) => tool.function.name)).toEqual([
      'create_event',
      'write_diary',
      'add_memory',
      'update_mood'
    ])
  })
})
