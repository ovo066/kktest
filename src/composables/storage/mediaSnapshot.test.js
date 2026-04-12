import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMediaSnapshotController } from './mediaSnapshot'

const SAMPLE_IMAGE = `data:image/png;base64,${'A'.repeat(9000)}`
const sampleImage = (seed) => `data:image/png;base64,${String(seed).repeat(9000)}`

const originalCreateObjectURL = globalThis.URL?.createObjectURL
const originalRevokeObjectURL = globalThis.URL?.revokeObjectURL

afterEach(() => {
  if (originalCreateObjectURL) {
    globalThis.URL.createObjectURL = originalCreateObjectURL
  } else {
    delete globalThis.URL.createObjectURL
  }
  if (originalRevokeObjectURL) {
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL
  } else {
    delete globalThis.URL.revokeObjectURL
  }
})

describe('mediaSnapshot runtime cache', () => {
  it('reuses cached binary when state only keeps blob urls', () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test-1')
    globalThis.URL.revokeObjectURL = vi.fn()

    const controller = createMediaSnapshotController()
    const contact = {
      id: 'c1',
      avatarType: 'image',
      avatar: SAMPLE_IMAGE,
      msgs: []
    }
    const input = {
      contacts: [contact],
      albumPhotos: [],
      personas: [],
      stickers: [],
      widgets: [],
      readerBooks: [],
      theme: {},
      wallpaper: null,
      wallpaperRef: '',
      lockScreenWallpaper: null,
      lockScreenWallpaperRef: ''
    }

    const first = controller.externalizeStateMedia(input)
    const firstRef = first.contacts[0].avatarRef

    expect(first.mediaEntries.get(firstRef)).toBe(SAMPLE_IMAGE)
    expect(contact.avatar).toBe('blob:test-1')

    const second = controller.externalizeStateMedia(input)

    expect(second.contacts[0].avatarRef).toBe(firstRef)
    expect(second.mediaEntries.has(firstRef)).toBe(true)
    expect(second.mediaEntries.get(firstRef)).toBeInstanceOf(Blob)
  })

  it('converts chat message images to runtime blob urls while externalizing storage refs', () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:chat-msg')
    globalThis.URL.revokeObjectURL = vi.fn()

    const controller = createMediaSnapshotController()
    const contact = {
      id: 'c1',
      avatarType: 'emoji',
      avatar: '🙂',
      msgs: [{
        id: 'msg-1',
        isImage: true,
        imageUrl: SAMPLE_IMAGE
      }]
    }

    const packed = controller.externalizeStateMedia({
      contacts: [contact],
      albumPhotos: [],
      personas: [],
      stickers: [],
      widgets: [],
      readerBooks: [],
      theme: {},
      wallpaper: null,
      wallpaperRef: '',
      lockScreenWallpaper: null,
      lockScreenWallpaperRef: ''
    })

    expect(contact.msgs[0].imageUrl).toBe('blob:chat-msg')
    expect(contact.msgs[0].imageRef).toMatch(/^media:/)
    expect(packed.contacts[0].msgs[0].imageRef).toBe(contact.msgs[0].imageRef)
    expect(packed.contacts[0].msgs[0].imageUrl).toBeUndefined()
  })

  it('externalizes short inline image data urls to media refs', () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:short-inline')
    globalThis.URL.revokeObjectURL = vi.fn()

    const controller = createMediaSnapshotController()
    const shortInlineImage = 'data:image/png;base64,AA=='
    const contact = {
      id: 'c1',
      avatarType: 'image',
      avatar: shortInlineImage,
      msgs: []
    }

    const packed = controller.externalizeStateMedia({
      contacts: [contact],
      albumPhotos: [],
      personas: [],
      stickers: [],
      widgets: [],
      readerBooks: [],
      theme: {},
      wallpaper: null,
      wallpaperRef: '',
      lockScreenWallpaper: null,
      lockScreenWallpaperRef: ''
    })

    expect(contact.avatarRef).toMatch(/^media:/)
    expect(packed.contacts[0].avatar).toBeUndefined()
    expect(packed.contacts[0].avatarRef).toBe(contact.avatarRef)
    expect(packed.mediaEntries.get(contact.avatarRef)).toBe(shortInlineImage)
  })

  it('clears stale media refs when value switches to remote url', () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:stale-ref')
    globalThis.URL.revokeObjectURL = vi.fn()

    const controller = createMediaSnapshotController()
    const packed = controller.externalizeStateMedia({
      contacts: [],
      albumPhotos: [],
      personas: [],
      stickers: [],
      widgets: [],
      readerBooks: [],
      theme: {
        appIcons: {
          messages: 'https://cdn.example.com/icon.png'
        },
        appIconRefs: {
          messages: 'media:theme_icon:theme:messages'
        }
      },
      wallpaper: 'https://cdn.example.com/wallpaper.jpg',
      wallpaperRef: 'media:wallpaper:settings:wallpaper',
      lockScreenWallpaper: null,
      lockScreenWallpaperRef: ''
    })

    expect(packed.rootMedia.wallpaper).toBe('https://cdn.example.com/wallpaper.jpg')
    expect(packed.rootMedia.wallpaperRef).toBeUndefined()
    expect(packed.theme.appIcons.messages).toBe('https://cdn.example.com/icon.png')
    expect(packed.theme.appIconRefs).toBeUndefined()
  })

  it('externalizes nested media trees used by backups', () => {
    let runtimeIndex = 0
    globalThis.URL.createObjectURL = vi.fn(() => `blob:nested-${++runtimeIndex}`)
    globalThis.URL.revokeObjectURL = vi.fn()

    const controller = createMediaSnapshotController()
    const input = {
      contacts: [],
      albumPhotos: [],
      personas: [],
      stickers: [],
      widgets: [],
      readerBooks: [],
      theme: {
        mockImagePlaceholder: sampleImage('1'),
        appIcons: {
          messages: sampleImage('2')
        }
      },
      forumUser: {
        id: 'forum-user',
        avatar: sampleImage('3')
      },
      forum: [
        {
          id: 'moment-1',
          authorAvatar: sampleImage('4'),
          images: [sampleImage('5')],
          replies: [
            {
              id: 'reply-1',
              authorAvatar: sampleImage('6')
            }
          ]
        }
      ],
      planner: {
        diaryEntries: [
          {
            id: 'diary-1',
            images: [sampleImage('7')]
          }
        ]
      },
      callResources: {
        contact_1: {
          avatar: sampleImage('8'),
          characterImage: sampleImage('9'),
          backgrounds: [sampleImage('b')],
          sprites: {
            happy: sampleImage('c')
          }
        }
      },
      characterResources: {
        contact_2: {
          baseImage: { url: sampleImage('d') },
          expressions: {
            happy: { url: sampleImage('e') }
          },
          generationPrefs: {
            characterRefImage: sampleImage('f'),
            vibeReferences: [
              {
                id: 'vibe-1',
                image: sampleImage('g')
              }
            ]
          }
        }
      },
      vnProjects: [
        {
          id: 'vn-1',
          resources: {
            backgrounds: {
              room: { url: sampleImage('h') }
            },
            sprites: {
              hero_happy: { url: sampleImage('i') }
            }
          },
          saves: [
            {
              id: 'vn-save-1',
              snapshot: {
                playerSnapshot: {
                  currentBg: { url: sampleImage('j') },
                  sprites: [{ id: 'vn-sprite-1', url: sampleImage('k') }]
                }
              }
            }
          ]
        }
      ],
      meetMeetings: [
        {
          id: 'meet-1',
          resources: {
            backgrounds: {
              cafe: { url: sampleImage('l') }
            },
            cgs: {
              cg1: { url: sampleImage('m') }
            },
            sprites: {
              hero_normal: { url: sampleImage('n') }
            }
          },
          saves: [
            {
              id: 'meet-save-1',
              snapshot: {
                playerSnapshot: {
                  currentBg: { url: sampleImage('o') },
                  currentCg: { url: sampleImage('p') },
                  sprites: [{ id: 'meet-sprite-1', url: sampleImage('q') }]
                }
              }
            }
          ]
        }
      ],
      savedThemes: [
        {
          id: 'theme-1',
          data: {
            mockImagePlaceholder: sampleImage('r')
          }
        }
      ],
      wallpaper: sampleImage('s'),
      wallpaperRef: '',
      lockScreenWallpaper: null,
      lockScreenWallpaperRef: ''
    }

    const packed = controller.externalizeStateMedia(input)

    expect(packed.theme.mockImagePlaceholderRef).toMatch(/^media:/)
    expect(packed.theme.appIconRefs.messages).toMatch(/^media:/)
    expect(packed.forumUser.avatarRef).toMatch(/^media:/)
    expect(packed.forum[0].imageRefs[0]).toMatch(/^media:/)
    expect(packed.planner.diaryEntries[0].imageRefs[0]).toMatch(/^media:/)
    expect(packed.callResources.contact_1.backgroundRefs[0]).toMatch(/^media:/)
    expect(packed.callResources.contact_1.spriteRefs.happy).toMatch(/^media:/)
    expect(packed.characterResources.contact_2.baseImage.urlRef).toMatch(/^media:/)
    expect(packed.characterResources.contact_2.expressions.happy.urlRef).toMatch(/^media:/)
    expect(packed.characterResources.contact_2.generationPrefs.characterRefImageRef).toMatch(/^media:/)
    expect(packed.characterResources.contact_2.generationPrefs.vibeReferences[0].imageRef).toMatch(/^media:/)
    expect(packed.vnProjects[0].resources.backgrounds.room.urlRef).toMatch(/^media:/)
    expect(packed.vnProjects[0].saves[0].snapshot.playerSnapshot.currentBg.urlRef).toMatch(/^media:/)
    expect(packed.meetMeetings[0].resources.cgs.cg1.urlRef).toMatch(/^media:/)
    expect(packed.meetMeetings[0].saves[0].snapshot.playerSnapshot.currentCg.urlRef).toMatch(/^media:/)
    expect(packed.savedThemes[0].data.mockImagePlaceholderRef).toMatch(/^media:/)

    const snapshot = {
      wallpaper: packed.rootMedia.wallpaper || null,
      wallpaperRef: packed.rootMedia.wallpaperRef || '',
      lockScreenWallpaper: packed.rootMedia.lockScreenWallpaper || null,
      lockScreenWallpaperRef: packed.rootMedia.lockScreenWallpaperRef || '',
      theme: structuredClone(packed.theme),
      forumUser: structuredClone(packed.forumUser),
      forum: structuredClone(packed.forum),
      planner: structuredClone(packed.planner),
      callResources: structuredClone(packed.callResources),
      characterResources: structuredClone(packed.characterResources),
      vnProjects: structuredClone(packed.vnProjects),
      meetMeetings: structuredClone(packed.meetMeetings),
      savedThemes: structuredClone(packed.savedThemes),
      contacts: [],
      albumPhotos: [],
      personas: [],
      stickers: [],
      widgets: [],
      readerBooks: []
    }

    controller.restoreInlineMediaFromMap(snapshot, packed.mediaEntries)

    expect(snapshot.theme.mockImagePlaceholder).toBe(sampleImage('1'))
    expect(snapshot.theme.appIcons.messages).toBe(sampleImage('2'))
    expect(snapshot.forumUser.avatar).toBe(sampleImage('3'))
    expect(snapshot.forum[0].images[0]).toBe(sampleImage('5'))
    expect(snapshot.planner.diaryEntries[0].images[0]).toBe(sampleImage('7'))
    expect(snapshot.callResources.contact_1.backgrounds[0]).toBe(sampleImage('b'))
    expect(snapshot.callResources.contact_1.sprites.happy).toBe(sampleImage('c'))
    expect(snapshot.characterResources.contact_2.baseImage.url).toBe(sampleImage('d'))
    expect(snapshot.characterResources.contact_2.generationPrefs.vibeReferences[0].image).toBe(sampleImage('g'))
    expect(snapshot.vnProjects[0].saves[0].snapshot.playerSnapshot.currentBg.url).toBe(sampleImage('j'))
    expect(snapshot.meetMeetings[0].saves[0].snapshot.playerSnapshot.currentCg.url).toBe(sampleImage('p'))
    expect(snapshot.savedThemes[0].data.mockImagePlaceholder).toBe(sampleImage('r'))
  })

  it('strips local-only media refs while preserving remote urls for media-free backups', () => {
    const controller = createMediaSnapshotController()
    const snapshot = {
      wallpaperRef: 'media:wallpaper:settings:wallpaper',
      theme: {
        appIcons: {
          messages: 'https://cdn.example.com/icon.png',
          photos: ''
        },
        appIconRefs: {
          photos: 'media:theme_icon:theme:photos'
        }
      },
      contacts: [{
        id: 'c1',
        avatarType: 'image',
        avatarRef: 'media:contact_avatar:c1:avatar',
        msgs: [{
          id: 'msg-1',
          isImage: true,
          imageRef: 'media:msg:c1:msg-1'
        }]
      }],
      forum: [{
        id: 'moment-1',
        images: ['https://cdn.example.com/moment-cover.jpg', ''],
        imageRefs: ['', 'media:forum_image:moment-1:1']
      }],
      planner: {
        diaryEntries: []
      },
      callResources: {},
      characterResources: {},
      vnProjects: [],
      meetMeetings: [],
      savedThemes: [],
      albumPhotos: [],
      personas: [],
      stickers: [],
      widgets: [],
      readerBooks: []
    }

    controller.stripSnapshotMedia(snapshot)

    expect(snapshot.wallpaperRef).toBeUndefined()
    expect(snapshot.wallpaper).toBeNull()
    expect(snapshot.theme.appIcons.messages).toBe('https://cdn.example.com/icon.png')
    expect(snapshot.theme.appIcons.photos).toBeUndefined()
    expect(snapshot.theme.appIconRefs).toBeUndefined()
    expect(snapshot.contacts[0].avatarRef).toBeUndefined()
    expect(snapshot.contacts[0].avatar).toBe('')
    expect(snapshot.contacts[0].msgs[0].imageRef).toBeUndefined()
    expect(snapshot.contacts[0].msgs[0].imageUrl).toBe('')
    expect(snapshot.forum[0].images).toEqual(['https://cdn.example.com/moment-cover.jpg'])
    expect(snapshot.forum[0].imageRefs).toBeUndefined()
  })
})
