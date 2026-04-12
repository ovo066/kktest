import { describe, expect, it } from 'vitest'
import { parseStickerImportEntries } from './useStickerImport'

describe('parseStickerImportEntries', () => {
  it('parses plain text sticker entries', () => {
    const entries = parseStickerImportEntries('猫猫 https://example.com/cat.png')

    expect(entries).toEqual([
      {
        name: '猫猫',
        url: 'https://example.com/cat.png',
        groupNames: []
      }
    ])
  })

  it('parses nested json entries with group metadata', () => {
    const entries = parseStickerImportEntries(JSON.stringify({
      items: [
        {
          name: '早八小狗',
          url: 'https://example.com/dog.png',
          groups: ['上班', '狗狗']
        }
      ]
    }))

    expect(entries).toEqual([
      {
        name: '早八小狗',
        url: 'https://example.com/dog.png',
        groupNames: ['上班', '狗狗']
      }
    ])
  })

  it('keeps tolerant group parsing in text mode', () => {
    const entries = parseStickerImportEntries('【委屈】小猫 https://example.com/cat-cry.png')

    expect(entries).toEqual([
      {
        name: '小猫',
        url: 'https://example.com/cat-cry.png',
        groupNames: ['委屈']
      }
    ])
  })
})

