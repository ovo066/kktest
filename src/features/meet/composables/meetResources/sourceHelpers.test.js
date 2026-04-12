import { describe, expect, it } from 'vitest'
import {
  buildSafebooruTags,
  extractFirstMediaUrl,
  normalizeExternalMediaUrl,
  normalizeUrlSourceEntries
} from './sourceHelpers'

describe('meet source helpers', () => {
  it('normalizes url source entries from pipe-delimited strings', () => {
    const result = normalizeUrlSourceEntries(['Cafe|https://example.com/cafe.png|coffee cozy'])

    expect(result).toEqual([
      {
        id: 'src_0',
        name: 'Cafe',
        url: 'https://example.com/cafe.png',
        tags: 'coffee cozy',
        characterId: '',
        expression: '',
        aliases: '',
        api: '',
        method: 'GET',
        headers: '',
        body: '',
        responsePath: ''
      }
    ])
  })

  it('normalizes external media urls and known hosts', () => {
    expect(normalizeExternalMediaUrl('https://github.com/octo/repo/blob/main/a.png')).toBe(
      'https://raw.githubusercontent.com/octo/repo/main/a.png'
    )
    expect(normalizeExternalMediaUrl('https://i.pximg.net/img-original/foo.jpg')).toBe(
      'https://wsrv.nl/?url=' + encodeURIComponent('https://i.pximg.net/img-original/foo.jpg')
    )
  })

  it('extracts nested media urls from mixed payloads', () => {
    const payload = {
      choices: [
        {
          message: {
            image_url: 'https://example.com/scene.webp'
          }
        }
      ]
    }

    expect(extractFirstMediaUrl(payload)).toBe('https://example.com/scene.webp')
  })

  it('builds safebooru tags from scene hints', () => {
    const tags = buildSafebooruTags('夜晚咖啡店')
    const parts = tags.split(' ')

    expect(parts).toEqual(expect.arrayContaining(['night', 'coffee_shop', 'cafe', 'indoors', 'scenery', 'no_humans']))
  })
})
