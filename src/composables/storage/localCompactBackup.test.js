import { describe, expect, it, vi } from 'vitest'
import { buildCompactBackupSnapshot } from './localCompactBackup'

describe('local compact backup', () => {
  it('keeps only recent messages and strips heavy modules', () => {
    const restoreInlineMediaFromMap = vi.fn()
    const snapshot = {
      version: 2,
      contacts: [
        {
          id: 'c1',
          name: 'Alice',
          msgs: [{ id: 'm1', text: 'old' }],
          offlineMsgs: [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }],
          offlineSessions: [{ id: 's1' }],
          offlineSnapshots: [{ id: 'p1' }],
          callHistory: [
            { id: 'call1', transcript: Array.from({ length: 25 }, (_, index) => ({ id: index })) }
          ]
        }
      ],
      planner: { events: [{ id: 'e1' }] },
      forum: [{ id: 'forum1' }],
      albumPhotos: [{ id: 'album1' }],
      vnProjects: [{ id: 'vn1' }],
      meetMeetings: [{ id: 'meet1' }],
      meetPresets: [{ id: 'preset1' }],
      callResources: { key: 'value' },
      characterResources: { key: 'value' },
      liveness: { enabled: true },
      music: { track: 'x' }
    }
    const compact = buildCompactBackupSnapshot(snapshot, {
      mediaEntries: new Map(),
      messagePartitions: new Map([
        ['c1', [{ id: 'm1', text: 'old' }, { id: 'm2', text: 'new' }]]
      ]),
      msgLimit: 1,
      restoreInlineMediaFromMap
    })

    expect(compact.contacts[0].msgs).toEqual([{ id: 'm2', text: 'new' }])
    expect(compact.contacts[0].msgCount).toBe(2)
    expect(compact.contacts[0].offlineMsgs).toEqual([{ id: 'o3' }])
    expect(compact.contacts[0].offlineSessions).toEqual([])
    expect(compact.contacts[0].offlineSnapshots).toEqual([])
    expect(compact.contacts[0].callHistory[0].transcript).toHaveLength(20)
    expect(compact.forum).toEqual([])
    expect(compact.albumPhotos).toEqual([])
    expect(compact.vnProjects).toEqual([])
    expect(compact.meetMeetings).toEqual([])
    expect(compact.meetPresets).toEqual([])
    expect(compact.callResources).toEqual({})
    expect(compact.characterResources).toEqual({})
    expect(compact.liveness).toBeNull()
    expect(compact.music).toBeNull()
    expect(compact.backupMeta).toEqual({
      kind: 'local-compact',
      isPartial: true,
      omittedKeys: [
        'forum',
        'albumPhotos',
        'vnProjects',
        'meetMeetings',
        'meetPresets',
        'callResources',
        'characterResources',
        'liveness',
        'music',
        'offlinePresets'
      ]
    })
    expect(restoreInlineMediaFromMap).toHaveBeenCalledOnce()
  })
})
