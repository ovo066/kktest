import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const idbKvMock = vi.hoisted(() => ({
  idbMediaDeleteMany: vi.fn(async () => {}),
  idbMediaGetAllKeys: vi.fn(async () => []),
  idbMediaGetMany: vi.fn(async () => []),
  idbMediaSetMany: vi.fn(async () => {})
}))

vi.mock('./idbKv', () => idbKvMock)

import { createMediaSnapshotController } from './mediaSnapshot'

const sampleImage = (seed) => `data:image/png;base64,${String(seed).repeat(9000)}`

const originalUrlCtor = globalThis.URL
const originalCreateObjectURL = globalThis.URL?.createObjectURL
const originalRevokeObjectURL = globalThis.URL?.revokeObjectURL

let runtimeIndex = 0

beforeEach(() => {
  runtimeIndex = 0
  vi.clearAllMocks()
  if (!globalThis.URL) {
    globalThis.URL = class {}
  }
  globalThis.URL.createObjectURL = vi.fn(() => `blob:persist-${++runtimeIndex}`)
  globalThis.URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  if (!originalUrlCtor) {
    delete globalThis.URL
    return
  }
  globalThis.URL = originalUrlCtor
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

describe('mediaSnapshot persistence', () => {
  it('persists newly externalized media on first save', async () => {
    const controller = createMediaSnapshotController()
    const packed = controller.externalizeStateMedia({
      contacts: [{
        id: 'contact-1',
        avatarType: 'image',
        avatar: sampleImage('a'),
        msgs: [{
          id: 'msg-1',
          isImage: true,
          imageUrl: sampleImage('b')
        }]
      }],
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

    expect(packed.mediaEntries.size).toBeGreaterThan(0)

    await controller.persistMediaEntries(packed.mediaEntries)

    expect(idbKvMock.idbMediaSetMany).toHaveBeenCalledTimes(1)
    const firstCallEntries = idbKvMock.idbMediaSetMany.mock.calls[0][0]
    expect(Array.isArray(firstCallEntries)).toBe(true)
    expect(firstCallEntries.length).toBeGreaterThan(0)
    expect(firstCallEntries[0][0]).toMatch(/^media:/)
    expect(firstCallEntries[0][1]).toBeInstanceOf(Blob)

    await controller.persistMediaEntries(packed.mediaEntries)
    expect(idbKvMock.idbMediaSetMany).toHaveBeenCalledTimes(1)
  })
})
