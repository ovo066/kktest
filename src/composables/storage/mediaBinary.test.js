import { describe, expect, it } from 'vitest'
import { isStoredMediaRecord, mediaValueToBlob, serializeMediaForStorage } from './mediaBinary'

describe('mediaBinary', () => {
  it('serializes data urls into portable media records', async () => {
    const record = await serializeMediaForStorage('data:text/plain;base64,aGVsbG8=')

    expect(isStoredMediaRecord(record)).toBe(true)

    const blob = mediaValueToBlob(record)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/plain')
    await expect(blob.text()).resolves.toBe('hello')
  })

  it('serializes blob inputs without losing mime type', async () => {
    const source = new Blob(['world'], { type: 'text/plain' })
    const record = await serializeMediaForStorage(source)

    expect(isStoredMediaRecord(record)).toBe(true)

    const blob = mediaValueToBlob(record)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/plain')
    await expect(blob.text()).resolves.toBe('world')
  })

  it('falls back when blob.arrayBuffer is unavailable', async () => {
    const source = new Blob(['fallback'], { type: 'text/plain' })
    source.arrayBuffer = undefined

    const record = await serializeMediaForStorage(source)

    expect(isStoredMediaRecord(record)).toBe(true)

    const blob = mediaValueToBlob(record)
    expect(blob).toBeInstanceOf(Blob)
    await expect(blob.text()).resolves.toBe('fallback')
  })
})
