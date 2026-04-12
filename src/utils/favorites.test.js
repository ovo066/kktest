import { describe, expect, it } from 'vitest'
import {
  FAVORITE_KIND_COLLECTION,
  addFavoriteCollection,
  buildFavoriteDetailContent,
  buildFavoriteSnippet,
  collectFavorites,
  findFavorite,
  removeFavoriteCollection,
  resolveFavoriteDetailData
} from './favorites'

describe('favorites utils', () => {
  it('builds non-empty snippets for structured favorite messages', () => {
    expect(buildFavoriteSnippet({ isSticker: true, favorited: true, stickerName: '挥手' })).toBe('[表情包: 挥手]')
    expect(buildFavoriteSnippet({ content: '(transfer:88.80|晚饭)', favorited: true })).toBe('[转账]')
  })

  it('formats detail content from tokenized messages', () => {
    expect(buildFavoriteDetailContent({ content: '(transfer:88.80:晚饭)', favorited: true })).toBe('转账：88.80 · 晚饭')
    expect(buildFavoriteDetailContent({ content: '[quote:上一条]\n你好呀', favorited: true })).toBe('你好呀')
  })

  it('collects favorites in reverse chronological order and finds detail items', () => {
    const contacts = [
      {
        id: 'alice',
        name: 'Alice',
        avatar: 'A',
        avatarType: 'emoji',
        msgs: [
          { id: 'm1', role: 'assistant', content: '第一条', favorited: true, time: 1000 },
          { id: 'm2', role: 'assistant', content: '第二条', favorited: false, time: 2000 }
        ]
      },
      {
        id: 'bob',
        name: 'Bob',
        avatar: 'B',
        avatarType: 'emoji',
        msgs: [
          { id: 'm3', role: 'user', content: '(sticker:比心)', favorited: true, time: 3000 }
        ]
      }
    ]

    const list = collectFavorites(contacts)
    expect(list.map(item => item.msgId)).toEqual(['m3', 'm1'])
    expect(findFavorite(contacts, 'bob', 'm3')).toMatchObject({
      contactName: 'Bob',
      msgId: 'm3',
      snippet: '[表情包: 比心]'
    })
  })

  it('collects explicit favorite parts from the same message separately', () => {
    const contacts = [
      {
        id: 'alice',
        name: 'Alice',
        avatar: 'A',
        avatarType: 'emoji',
        msgs: [
          {
            id: 'm1',
            role: 'assistant',
            content: '第一句\n(sticker:比心)\n第二句',
            favoritePartIndexes: [0, 2],
            time: 1000
          }
        ]
      }
    ]

    const list = collectFavorites(contacts)
    expect(list).toHaveLength(2)
    expect(list.map(item => item.favoritePartKey)).toEqual(['0', '2'])
    expect(list.map(item => item.snippet)).toEqual(['第一句', '第二句'])
    expect(findFavorite(contacts, 'alice', 'm1', '2')).toMatchObject({
      favoritePartKey: '2',
      detailContent: '第二句'
    })
  })

  it('supports grouped favorite cards and resolves multi-bubble detail previews', () => {
    const contacts = [
      {
        id: 'alice',
        name: 'Alice',
        avatar: 'A',
        avatarType: 'emoji',
        msgs: [
          { id: 'm1', role: 'assistant', content: '第一句', time: 1000 },
          { id: 'm2', role: 'user', content: '第二句', time: 2000 }
        ],
        favoriteCollections: [{
          id: 'col_1',
          createdAt: 5000,
          items: [
            { msgId: 'm1', partKey: 'message' },
            { msgId: 'm2', partKey: 'message' }
          ]
        }]
      }
    ]

    const list = collectFavorites(contacts)
    expect(list[0]).toMatchObject({
      kind: FAVORITE_KIND_COLLECTION,
      favoriteId: 'col_1',
      itemCount: 2,
      anchorMsgId: 'm1',
      anchorPartKey: 'message'
    })

    const detail = resolveFavoriteDetailData(contacts, {
      contactId: 'alice',
      msgId: 'm1',
      kind: FAVORITE_KIND_COLLECTION,
      favoriteId: 'col_1'
    })

    expect(detail.favorite).toMatchObject({
      kind: FAVORITE_KIND_COLLECTION,
      favoriteId: 'col_1',
      itemCount: 2
    })
    expect(detail.previewMessages).toHaveLength(2)
    expect(detail.previewMessages[0]).toMatchObject({
      sourceMsgId: 'm1',
      contactId: 'alice'
    })
    expect(detail.previewMessages[1]).toMatchObject({
      sourceMsgId: 'm2',
      contactId: ''
    })
  })

  it('preserves voice emotion tags in single-part favorite preview messages', () => {
    const contacts = [
      {
        id: 'alice',
        name: 'Alice',
        avatar: 'A',
        avatarType: 'emoji',
        msgs: [
          {
            id: 'm1',
            role: 'assistant',
            content: '(voice:[emotion:happy]收藏里的语音)',
            favoritePartIndexes: [0],
            time: 1000
          }
        ]
      }
    ]

    const detail = resolveFavoriteDetailData(contacts, {
      contactId: 'alice',
      msgId: 'm1',
      favoritePartKey: '0'
    })

    expect(detail.previewMessages).toHaveLength(1)
    expect(detail.previewMessages[0]).toMatchObject({
      sourceMsgId: 'm1',
      contactId: 'alice',
      content: '(voice:[emotion:happy]收藏里的语音)'
    })
  })

  it('adds and removes grouped favorite cards without duplicating the same block set', () => {
    const contact = {
      id: 'alice',
      msgs: []
    }

    const first = addFavoriteCollection(contact, [
      { msgId: 'm1', partKey: 'message' },
      { msgId: 'm2', partKey: '0' }
    ], {
      id: 'col_a',
      createdAt: 100
    })
    expect(first.created).toBe(true)
    expect(contact.favoriteCollections).toHaveLength(1)

    const duplicate = addFavoriteCollection(contact, [
      { msgId: 'm1', partKey: 'message' },
      { msgId: 'm2', partKey: '0' }
    ], {
      id: 'col_b',
      createdAt: 200
    })
    expect(duplicate.duplicate).toBe(true)
    expect(contact.favoriteCollections).toHaveLength(1)

    expect(removeFavoriteCollection(contact, 'col_a')).toBe(true)
    expect(contact.favoriteCollections).toHaveLength(0)
  })
})
