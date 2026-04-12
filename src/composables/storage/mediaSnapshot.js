import {
  idbMediaDeleteMany,
  idbMediaGetAllKeys,
  idbMediaGetMany,
  idbMediaSetMany
} from './idbKv'
import {
  MEDIA_REF_PREFIX,
  buildMediaSignature,
  isBlobUrl,
  isBlobValue,
  isInlineImageDataUrl,
  normalizeMediaBinary,
  shouldUpgradeStoredMediaValue
} from './mediaSnapshotHelpers'
import {
  applyMediaMapToSnapshot,
  collectSnapshotMediaRefs,
  externalizeSnapshotMedia,
  restoreInlineMediaFromMap,
  stripSnapshotMediaFields
} from './mediaSnapshotWalkers'

export function createMediaSnapshotController() {
  let mediaGcRunning = false
  const mediaSignatureCache = new Map()
  const mediaRuntimeUrlCache = new Map()

  function revokeRuntimeMediaUrl(ref) {
    const cached = mediaRuntimeUrlCache.get(ref)
    if (!cached?.url) return
    try {
      URL.revokeObjectURL(cached.url)
    } catch {
      // ignore
    }
    mediaRuntimeUrlCache.delete(ref)
  }

  function ensureRuntimeMediaUrl(ref, value) {
    if (typeof value === 'string' && value && !isInlineImageDataUrl(value) && !isBlobUrl(value)) {
      return value
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return ''

    const binary = normalizeMediaBinary(value)
    if (!binary) return ''

    const signature = buildMediaSignature(binary)
    const cached = mediaRuntimeUrlCache.get(ref)
    if (cached && cached.signature === signature && cached.url) {
      if (!cached.binary) {
        mediaRuntimeUrlCache.set(ref, { ...cached, binary })
      }
      return cached.url
    }

    revokeRuntimeMediaUrl(ref)
    const url = URL.createObjectURL(binary)
    mediaRuntimeUrlCache.set(ref, { url, signature, binary })
    return url
  }

  function getCachedMediaValue(ref) {
    return mediaRuntimeUrlCache.get(ref)?.binary || null
  }

  function pruneRuntimeMediaUrls(liveRefs) {
    const live = liveRefs instanceof Set ? liveRefs : new Set(liveRefs || [])
    Array.from(mediaRuntimeUrlCache.keys()).forEach((ref) => {
      if (!live.has(ref)) {
        revokeRuntimeMediaUrl(ref)
      }
    })
  }

  function externalizeStateMedia(input = {}) {
    return externalizeSnapshotMedia(input, {
      mediaEntries: new Map(),
      dedupeByUrl: new Map(),
      ensureRuntimeMediaUrl,
      getCachedMediaValue
    })
  }

  function collectMediaRefsFromSnapshot(snapshot) {
    return collectSnapshotMediaRefs(snapshot)
  }

  function stripSnapshotMedia(snapshot) {
    return stripSnapshotMediaFields(snapshot)
  }

  async function hydrateSnapshotMedia(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return snapshot

    const liveRefs = collectMediaRefsFromSnapshot(snapshot)
    const refs = Array.from(liveRefs)
    pruneRuntimeMediaUrls(liveRefs)
    if (refs.length === 0) return snapshot

    try {
      const rows = await idbMediaGetMany(refs)
      const runtimeMediaMap = new Map()
      const upgrades = []

      rows.forEach(([ref, value]) => {
        if (!value) return

        const runtimeValue = ensureRuntimeMediaUrl(ref, value)
        if (runtimeValue) {
          runtimeMediaMap.set(ref, runtimeValue)
        }

        const binary = normalizeMediaBinary(value)
        if (!binary) return

        mediaSignatureCache.set(ref, buildMediaSignature(binary))
        if (shouldUpgradeStoredMediaValue(value)) {
          upgrades.push([ref, binary])
        }
      })

      applyMediaMapToSnapshot(snapshot, ref => runtimeMediaMap.get(ref))
      if (upgrades.length > 0) {
        void idbMediaSetMany(upgrades).catch((err) => {
          console.warn('[mediaSnapshot] idbMediaSetMany upgrade failed:', err)
        })
      }
    } catch (err) {
      console.warn('[mediaSnapshot] hydrateSnapshotMedia failed:', err)
    }

    return snapshot
  }

  async function persistMediaEntries(mediaEntries) {
    if (!(mediaEntries instanceof Map) || mediaEntries.size === 0) return

    const pending = []
    const pendingSignatures = new Map()

    mediaEntries.forEach((value, ref) => {
      if (typeof ref !== 'string' || !ref) return

      const binary = normalizeMediaBinary(value)
      if (!binary) return

      const signature = buildMediaSignature(binary)
      if (mediaSignatureCache.get(ref) === signature) return

      pending.push([ref, binary])
      pendingSignatures.set(ref, signature)
    })

    if (pending.length === 0) return

    await idbMediaSetMany(pending)
    pendingSignatures.forEach((signature, ref) => {
      mediaSignatureCache.set(ref, signature)
    })
  }

  async function maybeGarbageCollectUnusedMedia(snapshot, options = {}) {
    const saveCount = Number(options.saveCount) || 0
    const gcEverySaves = Number(options.gcEverySaves) || 0
    if (mediaGcRunning) return
    if (saveCount <= 0 || gcEverySaves <= 0 || saveCount % gcEverySaves !== 0) return

    mediaGcRunning = true
    try {
      const liveRefs = collectMediaRefsFromSnapshot(snapshot)
      const keys = await idbMediaGetAllKeys()
      const stale = keys.filter((key) => {
        if (typeof key !== 'string' || !key.startsWith(MEDIA_REF_PREFIX)) return false
        return !liveRefs.has(key)
      })
      if (stale.length > 0) {
        await idbMediaDeleteMany(stale)
        stale.forEach((key) => {
          mediaSignatureCache.delete(key)
          revokeRuntimeMediaUrl(key)
        })
      }
    } catch (err) {
      console.warn('[mediaSnapshot] maybeGarbageCollectUnusedMedia failed:', err)
    } finally {
      mediaGcRunning = false
    }
  }

  async function collectMediaEntriesForExport(refs, mediaEntries) {
    const mediaMap = new Map()
    const refList = Array.isArray(refs) ? refs.filter(Boolean) : []

    if (refList.length > 0) {
      try {
        const rows = await idbMediaGetMany(refList)
        rows.forEach(([ref, value]) => {
          if (!ref || !value) return
          mediaMap.set(ref, value)
        })
      } catch (err) {
        console.warn('[mediaSnapshot] collectMediaEntriesForExport failed:', err)
      }
    }

    if (mediaEntries instanceof Map) {
      mediaEntries.forEach((value, ref) => {
        if (!ref || !value || mediaMap.has(ref)) return
        mediaMap.set(ref, value)
      })
    }

    return mediaMap
  }

  return {
    applyMediaMapToSnapshot,
    collectMediaEntriesForExport,
    collectMediaRefsFromSnapshot,
    externalizeStateMedia,
    guessMediaExtensionFromMimeType,
    hydrateSnapshotMedia,
    maybeGarbageCollectUnusedMedia,
    mediaBinaryToDataUrl,
    normalizeMediaBinary,
    persistMediaEntries,
    restoreInlineMediaFromMap,
    stripSnapshotMedia
  }
}

function guessMediaExtensionFromMimeType(mimeType) {
  const type = String(mimeType || '').toLowerCase()
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  if (type.includes('gif')) return 'gif'
  if (type.includes('svg')) return 'svg'
  if (type.includes('avif')) return 'avif'
  if (type.includes('bmp')) return 'bmp'
  return 'jpg'
}

function mediaBinaryToDataUrl(value) {
  if (isInlineImageDataUrl(value)) return Promise.resolve(value)
  if (!isBlobValue(value)) return Promise.resolve('')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error || new Error('Failed to encode export media'))
    reader.readAsDataURL(value)
  })
}

export { guessMediaExtensionFromMimeType }
