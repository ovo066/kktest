import { describe, expect, it } from 'vitest'
import {
  describeMcpServerSelection,
  normalizeMcpServerIds,
  resolveDirectMcpServerIds,
  resolveGroupMultiMcpServerIds,
  resolveGroupSingleMcpServerIds
} from './mcpServers'

describe('mcpServers helpers', () => {
  it('normalizes server ids by trimming empties and removing duplicates', () => {
    expect(normalizeMcpServerIds([' a ', '', null, 'b', 'a'])).toEqual(['a', 'b'])
  })

  it('describes selections with configured server names', () => {
    expect(describeMcpServerSelection(['srv_a', 'srv_b'], [
      { id: 'srv_a', name: 'Filesystem' },
      { id: 'srv_b', name: 'Calendar' }
    ])).toBe('Filesystem、Calendar')

    expect(describeMcpServerSelection([], [], {
      emptyLabel: '全部已启用服务器'
    })).toBe('全部已启用服务器')
  })

  it('uses explicit contact selections and otherwise falls back to all enabled servers', () => {
    expect(resolveDirectMcpServerIds({ mcpServerIds: ['srv_a'] })).toEqual(['srv_a'])
    expect(resolveDirectMcpServerIds({ mcpServerIds: [] })).toBeUndefined()
  })

  it('resolves group multi selections with member override and group fallback', () => {
    const group = { mcpServerIds: ['srv_group'] }
    expect(resolveGroupMultiMcpServerIds(group, { mcpServerIds: ['srv_member'] })).toEqual(['srv_member'])
    expect(resolveGroupMultiMcpServerIds(group, { mcpServerIds: [] })).toEqual(['srv_group'])
    expect(resolveGroupMultiMcpServerIds({ mcpServerIds: [] }, { mcpServerIds: [] })).toBeUndefined()
  })

  it('merges explicit selections for single-api groups', () => {
    expect(resolveGroupSingleMcpServerIds({
      mcpServerIds: ['srv_group'],
      members: [
        { mcpServerIds: [] },
        { mcpServerIds: ['srv_member'] }
      ]
    })).toEqual(['srv_group', 'srv_member'])

    expect(resolveGroupSingleMcpServerIds({
      mcpServerIds: [],
      members: [
        { mcpServerIds: ['srv_a'] },
        { mcpServerIds: ['srv_b', 'srv_a'] }
      ]
    })).toEqual(['srv_a', 'srv_b'])

    expect(resolveGroupSingleMcpServerIds({
      mcpServerIds: [],
      members: [{ mcpServerIds: [] }]
    })).toBeUndefined()
  })
})
