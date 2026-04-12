import { describe, expect, it } from 'vitest'
import {
  buildSnapshotForMediaGc,
  hydrateStoredContactMessages,
  partitionContactMessages,
  recoverContactsFromPersistedMessages,
  restoreInlineMediaInMessagePartitions
} from './contactMessagePersistence'

describe('contactMessagePersistence', () => {
  it('partitions contact messages and keeps summary fields on snapshot', () => {
    const packed = {
      snapshot: {
        contacts: [
          {
            id: 'c1',
            name: 'Alice',
            msgs: [
              { id: 'm1', role: 'user', content: 'hello', time: 1 },
              { id: 'm2', role: 'assistant', content: 'world', time: 2 }
            ]
          }
        ]
      },
      mediaEntries: new Map([['media://1', { type: 'image/png', size: 12 }]])
    }

    const result = partitionContactMessages(packed)

    expect(result.messagePartitions.get('c1')).toHaveLength(2)
    expect(result.snapshot.contacts[0].msgs).toBeUndefined()
    expect(result.snapshot.contacts[0].msgCount).toBe(2)
    expect(result.snapshot.contacts[0].lastMsgId).toBe('m2')
    expect(result.mediaEntries).toBe(packed.mediaEntries)
  })

  it('hydrates persisted messages first and tracks inline migrations', async () => {
    const snapshot = {
      contacts: [
        { id: 'c1', msgs: [{ id: 'inline-1' }] },
        { id: 'c2', msgs: [{ id: 'inline-2' }] },
        { id: 'c3' }
      ]
    }

    const result = await hydrateStoredContactMessages(snapshot, {
      getAllKeys: async () => ['c1', 'ghost'],
      getMany: async () => [
        ['c1', [{ id: 'persisted-1' }]]
      ]
    })

    expect(result.snapshot.contacts[0].msgs).toEqual([{ id: 'persisted-1' }])
    expect(result.snapshot.contacts[1].msgs).toEqual([{ id: 'inline-2' }])
    expect(result.snapshot.contacts[2].msgs).toEqual([])
    expect(result.shouldMigrateInlineMessages).toBe(true)
    expect(Array.from(result.persistedContactIds)).toEqual(['c1', 'ghost'])
  })

  it('can rebuild contacts from persisted message partitions only', async () => {
    const msgs = [
      { id: 'm1', role: 'user', content: 'hello', time: 1 },
      { id: 'm2', role: 'assistant', content: 'world', time: 2 }
    ]

    const contacts = await recoverContactsFromPersistedMessages({
      getAllKeys: async () => ['contact_abc123', 'contact_empty'],
      getMany: async () => [
        ['contact_abc123', msgs],
        ['contact_empty', []]
      ]
    })

    expect(contacts).toEqual([
      expect.objectContaining({
        id: 'contact_abc123',
        name: '已恢复会话 abc123',
        msgs,
        msgCount: 2,
        recoveredFromMessages: true
      })
    ])
  })

  it('can rebuild snapshot contacts for media gc and restore inline media in message partitions', () => {
    const snapshot = {
      contacts: [
        { id: 'c1', name: 'Alice' },
        { id: 'c2', name: 'Bob' }
      ]
    }
    const messagePartitions = new Map([
      ['c1', [{ id: 'm1', imageRef: 'media://1' }]]
    ])

    const gcSnapshot = buildSnapshotForMediaGc(snapshot, messagePartitions)
    expect(gcSnapshot.contacts[0].msgs).toEqual([{ id: 'm1', imageRef: 'media://1' }])
    expect(gcSnapshot.contacts[1].msgs).toBeUndefined()

    const restored = restoreInlineMediaInMessagePartitions(
      messagePartitions,
      new Map([['media://1', 'data:image/png;base64,abc']]),
      (tempSnapshot, mediaEntries) => {
        tempSnapshot.contacts[0].msgs[0].imageUrl = mediaEntries.get('media://1')
      }
    )

    expect(restored.get('c1')[0].imageUrl).toBe('data:image/png;base64,abc')
  })
})
