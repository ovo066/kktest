// @ts-check

/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */
/** @typedef {import('./storageContracts').StorageBackupBuildOptions} StorageBackupBuildOptions */
/** @typedef {import('./storageContracts').StorageBackupBuildResult} StorageBackupBuildResult */
/** @typedef {import('./storageContracts').StorageBackupImportOptions} StorageBackupImportOptions */
/** @typedef {import('./storageContracts').StorageFlushSaveOptions} StorageFlushSaveOptions */
/** @typedef {import('./storageContracts').StorageMediaEntryMap} StorageMediaEntryMap */
/** @typedef {import('./storageContracts').StorageSnapshotBuildOptions} StorageSnapshotBuildOptions */
/** @typedef {import('./storageContracts').StorageSnapshotPack} StorageSnapshotPack */

function hasZipHeader(header) {
  return (
    header.length >= 4 &&
    header[0] === 0x50 &&
    header[1] === 0x4b &&
    (
      (header[2] === 0x03 && header[3] === 0x04) ||
      (header[2] === 0x05 && header[3] === 0x06) ||
      (header[2] === 0x07 && header[3] === 0x08)
    )
  )
}

async function readFileAsArrayBuffer(file) {
  if (!file) throw new Error('Missing file')
  if (typeof file.arrayBuffer === 'function') {
    return await file.arrayBuffer()
  }
  if (typeof Response !== 'undefined') {
    return await new Response(file).arrayBuffer()
  }
  if (typeof FileReader !== 'undefined') {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0))
      reader.onerror = () => reject(reader.error || new Error('Failed to read backup file'))
      reader.readAsArrayBuffer(file)
    })
  }
  throw new Error('ArrayBuffer reader unavailable')
}

async function readFileAsText(file) {
  if (!file) throw new Error('Missing file')
  if (typeof file.text === 'function') {
    return await file.text()
  }
  if (typeof FileReader !== 'undefined') {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(reader.error || new Error('Failed to read backup file'))
      reader.readAsText(file)
    })
  }
  throw new Error('Text reader unavailable')
}

/**
 * @param {object} options
 * @param {(options?: StorageSnapshotBuildOptions) => StorageSnapshotPack} options.snapshotAppData
 * @param {() => number} options.getLocalUpdatedAt
 * @param {(snapshot: StorageAppData) => void} options.redactSecretsForExport
 * @param {(snapshot: StorageAppData) => Set<string>} options.collectMediaRefsFromSnapshot
 * @param {(refs: string[], mediaEntries: StorageMediaEntryMap) => Promise<StorageMediaEntryMap>} options.collectMediaEntriesForExport
 * @param {(value: unknown) => Promise<string | null>} options.mediaBinaryToDataUrl
 * @param {(snapshot: StorageAppData, getMediaValue: (ref: string) => string | undefined) => void} options.applyMediaMapToSnapshot
 * @param {(snapshot: StorageAppData) => StorageAppData} options.stripSnapshotMedia
 * @param {(value: unknown) => Blob | null} options.normalizeMediaBinary
 * @param {(mimeType: string) => string} options.guessMediaExtensionFromMimeType
 * @param {(entries: Array<[string, Blob]>) => Promise<void>} options.idbMediaSetMany
 * @param {(data: unknown) => StorageAppData} options.normalizeLoadedAppData
 * @param {(snapshot: StorageAppData) => Promise<void>} options.hydrateSnapshotMedia
 * @param {(snapshot: StorageAppData) => unknown} options.applyAppDataToState
 * @param {(options?: StorageFlushSaveOptions) => Promise<unknown>} options.flushSaveNow
 * @param {(error: unknown, details: Record<string, unknown>) => void} options.handleError
 * @returns {{
 *   buildBackupBlob: (options?: StorageBackupBuildOptions) => Promise<StorageBackupBuildResult>,
 *   importBackupBlob: (fileOrBlob: Blob | File, options?: StorageBackupImportOptions) => Promise<boolean>
 * }}
 */
export function createBackupTransport({
  snapshotAppData,
  getLocalUpdatedAt,
  redactSecretsForExport,
  collectMediaRefsFromSnapshot,
  collectMediaEntriesForExport,
  mediaBinaryToDataUrl,
  applyMediaMapToSnapshot,
  stripSnapshotMedia,
  normalizeMediaBinary,
  guessMediaExtensionFromMimeType,
  idbMediaSetMany,
  normalizeLoadedAppData,
  hydrateSnapshotMedia,
  applyAppDataToState,
  flushSaveNow,
  handleError
}) {
  /**
   * @param {StorageBackupBuildOptions} [options]
   * @returns {Promise<StorageBackupBuildResult>}
   */
  async function buildBackupBlob(options = {}) {
    const includeSecrets = options && options.includeSecrets === true
    const excludeMedia = options && options.excludeMedia === true
    const format = options && options.format === 'json' ? 'json' : 'zip'
    const packed = snapshotAppData({ inlineMessages: true, localUpdatedAt: getLocalUpdatedAt() })
    const snapshot = packed.snapshot

    if (!includeSecrets) {
      redactSecretsForExport(snapshot)
    }

    if (excludeMedia) {
      stripSnapshotMedia(snapshot)
    }

    if (format === 'json') {
      const refs = excludeMedia ? [] : Array.from(collectMediaRefsFromSnapshot(snapshot))
      const mediaMap = excludeMedia ? new Map() : await collectMediaEntriesForExport(refs, packed.mediaEntries)
      const inlineMediaMap = new Map()
      for (const ref of refs) {
        const value = mediaMap.get(ref)
        if (!value) continue
        const dataUrl = await mediaBinaryToDataUrl(value)
        if (dataUrl) inlineMediaMap.set(ref, dataUrl)
      }
      applyMediaMapToSnapshot(snapshot, ref => inlineMediaMap.get(ref))
      const payload = {
        version: 1,
        exportedAt: Date.now(),
        data: snapshot
      }

      return {
        format,
        snapshot,
        blob: new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      }
    }

    const refs = excludeMedia ? [] : Array.from(collectMediaRefsFromSnapshot(snapshot))
    const mediaMap = excludeMedia ? new Map() : await collectMediaEntriesForExport(refs, packed.mediaEntries)
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const payload = {
      version: 2,
      exportedAt: Date.now(),
      data: snapshot
    }
    zip.file('data.json', JSON.stringify(payload, null, 2))

    const manifest = []
    let fileIndex = 0
    refs.forEach((ref) => {
      const value = mediaMap.get(ref)
      const binary = normalizeMediaBinary(value)
      if (!binary) return
      const ext = guessMediaExtensionFromMimeType(binary.type)
      const fileName = `media/${String(fileIndex).padStart(6, '0')}.${ext}`
      zip.file(fileName, binary, { binary: true, compression: 'STORE' })
      manifest.push({
        ref,
        file: fileName,
        type: binary.type || 'application/octet-stream',
        size: binary.size || 0
      })
      fileIndex += 1
    })
    zip.file('media-manifest.json', JSON.stringify({ version: 1, media: manifest }, null, 2))

    return {
      format,
      snapshot,
      blob: await zip.generateAsync({ type: 'blob', compression: 'STORE' })
    }
  }

  /**
   * @param {Blob | File} fileOrBlob
   * @param {StorageBackupImportOptions} [options]
   * @returns {Promise<boolean>}
   */
  async function importBackupBlob(fileOrBlob, options = {}) {
    try {
      const file = fileOrBlob
      const intrinsicFileName = (typeof File !== 'undefined' && file instanceof File) ? file.name : ''
      const lowerName = String(options.fileName || intrinsicFileName || '').toLowerCase()
      const fileType = String(options.type || file?.type || '').toLowerCase()
      let parsed = null

      let isZipBackup = lowerName.endsWith('.zip') || fileType.includes('zip')
      if (!isZipBackup && file?.slice) {
        try {
          const header = new Uint8Array(await readFileAsArrayBuffer(file.slice(0, 4)))
          isZipBackup = hasZipHeader(header)
        } catch {
          isZipBackup = false
        }
      }

      if (isZipBackup) {
        const { default: JSZip } = await import('jszip')
        const zip = await JSZip.loadAsync(await readFileAsArrayBuffer(file))
        const dataEntry = zip.file('data.json')
        if (!dataEntry) return false
        parsed = JSON.parse(await dataEntry.async('string'))

        const manifestEntry = zip.file('media-manifest.json')
        if (manifestEntry) {
          const manifest = JSON.parse(await manifestEntry.async('string'))
          const mediaList = Array.isArray(manifest?.media) ? manifest.media : []
          /** @type {Array<[string, Blob]>} */
          const entries = []
          for (const item of mediaList) {
            const ref = typeof item?.ref === 'string' ? item.ref : ''
            const fileName = typeof item?.file === 'string' ? item.file : ''
            if (!ref || !fileName) continue
            const mediaFile = zip.file(fileName)
            if (!mediaFile) continue
            const blob = await mediaFile.async('blob')
            if (!blob || !blob.size) continue
            entries.push([ref, blob])
          }
          if (entries.length > 0) {
            await idbMediaSetMany(entries)
          }
        }
      } else {
        const text = await readFileAsText(file)
        parsed = JSON.parse(text)
      }

      const data = normalizeLoadedAppData(parsed.data || parsed)
      await hydrateSnapshotMedia(data)
      applyAppDataToState(data)
      await flushSaveNow({
        allowSignificantDataLoss: true,
        backupFirst: true,
        suppressCloudSync: options.suppressCloudSync === true,
        reason: options.reason || 'import'
      })
      return true
    } catch (error) {
      handleError(error, {
        mode: 'warn',
        context: 'Storage:Import',
        fallbackMessage: '备份导入失败'
      })
      return false
    }
  }

  return {
    buildBackupBlob,
    importBackupBlob
  }
}
