import { describe, expect, it, vi } from 'vitest'
import { createMeetSourceResolver } from './sourceResolver'

function createResolver(overrides = {}) {
  const meetStore = {
    currentMeeting: {
      resources: {
        bgm: {
          calm: { url: 'https://example.com/calm.mp3', tags: 'calm ambient' }
        },
        sfx: {}
      }
    },
    assetSources: {
      spriteUrls: [
        { name: 'Alice', characterId: 'alice', expression: 'normal', url: 'https://example.com/alice-normal.png' },
        { name: 'Alice', characterId: 'alice', expression: 'happy', url: 'https://example.com/alice-happy.png' }
      ],
      bgmUrls: [
        { name: 'battle', url: 'https://example.com/battle.mp3', tags: 'battle intense action' },
        { name: 'soft', api: 'https://api.example.com/bgm', responsePath: 'data.url', tags: 'calm soft' }
      ],
      sfxUrls: [
        { name: 'door', api: 'https://api.example.com/sfx', responsePath: 'url', tags: 'door open' }
      ]
    },
    ...overrides.meetStore
  }

  return createMeetSourceResolver({
    getAssetFlags: () => ({
      safebooruProxy: '',
      imageProxy: '',
      audioProxy: '',
      enableJamendoBgm: true,
      jamendoClientId: 'jamendo_test',
      jamendoInstrumentalOnly: true,
      jamendoSearchLimit: 8
    }),
    getMeetingBgmByName: (name) => meetStore.currentMeeting?.resources?.bgm?.[name] || null,
    getMeetingSfxByName: (name) => meetStore.currentMeeting?.resources?.sfx?.[name] || null,
    meetStore,
    normalizeMediaUrlForUse: (url) => url
  })
}

describe('createMeetSourceResolver', () => {
  it('prefers exact meeting BGM resources', () => {
    const resolver = createResolver()
    expect(resolver.resolveBGM('calm')).toBe('https://example.com/calm.mp3')
  })

  it('picks sprite sources by character and expression', () => {
    const resolver = createResolver()
    expect(resolver.getSpriteFromAssetSources('alice', 'happy', 'Alice')).toBe('https://example.com/alice-happy.png')
  })

  it('can resolve audio entries from API responses', async () => {
    const resolver = createResolver()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ url: 'https://example.com/door.wav' })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolver.resolveSFXAsync('door', {})).resolves.toBe('https://example.com/door.wav')

    vi.unstubAllGlobals()
  })

  it('can auto-pick BGM from context hints', async () => {
    const resolver = createResolver({
      meetStore: {
        currentMeeting: { resources: { bgm: {}, sfx: {} } }
      }
    })
    const picked = await resolver.pickAutoBGM({ text: '一场激烈的 battle 开始了' })
    expect(picked?.name).toBe('battle')
    expect(picked?.url).toBe('https://example.com/battle.mp3')
  })

  it('falls back to Jamendo when local BGM sources miss', async () => {
    const resolver = createResolver({
      meetStore: {
        currentMeeting: { resources: { bgm: {}, sfx: {} } },
        assetSources: {
          bgmUrls: [],
          sfxUrls: [],
          spriteUrls: []
        }
      }
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'j_1',
            name: 'Night Walk',
            artist_name: 'Jam Artist',
            audio: 'https://example.com/jamendo-night.mp3',
            duration: 180,
            musicinfo: {
              tags: {
                genres: ['ambient'],
                vartags: ['night', 'calm', 'instrumental']
              }
            }
          }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolver.resolveBGMAsync('夜晚散步', {
        location: '海边',
        timeOfDay: '夜晚',
        text: '海风很轻'
      })
    ).resolves.toBe('https://example.com/jamendo-night.mp3')

    await expect(
      resolver.pickAutoBGM({
        location: '海边',
        timeOfDay: '夜晚',
        text: '海风很轻'
      })
    ).resolves.toEqual({
      name: 'https://example.com/jamendo-night.mp3',
      url: 'https://example.com/jamendo-night.mp3'
    })

    expect(fetchMock).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
