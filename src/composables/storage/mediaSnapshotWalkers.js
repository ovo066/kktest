import { defaultAppData } from './appData'
import {
  cloneCollectionWithMedia,
  cloneNodeWithMedia,
  cloneRecordWithMedia,
  collectCollectionMediaRefs,
  collectNodeMediaRefs,
  collectRecordMediaRefs,
  hydrateNodeMedia,
  hydrateRecordMedia,
  stripNodeMedia,
  stripRecordMedia
} from './mediaSnapshotTraversal'
import {
  ROOT_MEDIA_SCHEMA,
  SNAPSHOT_COLLECTION_SCHEMAS,
  SNAPSHOT_OBJECT_SCHEMAS,
  SNAPSHOT_RECORD_SCHEMAS,
  THEME_SCHEMA
} from './mediaSnapshotSchemas'

function extractThemeMedia(theme, state) {
  if (!theme || typeof theme !== 'object') return defaultAppData().theme
  return cloneNodeWithMedia(theme, THEME_SCHEMA, state)
}

function collectThemeMediaRefs(theme, refs) {
  if (!theme || typeof theme !== 'object') return
  collectNodeMediaRefs(theme, THEME_SCHEMA, refs)
}

function hydrateThemeMedia(theme, resolveValue) {
  if (!theme || typeof theme !== 'object') return
  hydrateNodeMedia(theme, THEME_SCHEMA, resolveValue)
}

function stripThemeMedia(theme) {
  if (!theme || typeof theme !== 'object') return
  stripNodeMedia(theme, THEME_SCHEMA)
}

export function externalizeSnapshotMedia(input = {}, state) {
  const rootMedia = cloneNodeWithMedia({
    wallpaper: input.wallpaper || null,
    wallpaperRef: input.wallpaperRef || '',
    lockScreenWallpaper: input.lockScreenWallpaper || null,
    lockScreenWallpaperRef: input.lockScreenWallpaperRef || ''
  }, ROOT_MEDIA_SCHEMA, state)

  const result = {
    rootMedia,
    theme: extractThemeMedia(input.theme, state),
    mediaEntries: state.mediaEntries
  }

  SNAPSHOT_OBJECT_SCHEMAS.forEach(({ key, schema }) => {
    result[key] = cloneNodeWithMedia(input[key], schema, state)
  })

  SNAPSHOT_RECORD_SCHEMAS.forEach(({ key, schema }) => {
    result[key] = cloneRecordWithMedia(input[key], schema, state)
  })

  SNAPSHOT_COLLECTION_SCHEMAS.forEach(({ key, schema }) => {
    result[key] = cloneCollectionWithMedia(input[key], schema, state)
  })

  return result
}

export function collectSnapshotMediaRefs(snapshot) {
  const refs = new Set()
  if (!snapshot || typeof snapshot !== 'object') return refs

  collectNodeMediaRefs(snapshot, ROOT_MEDIA_SCHEMA, refs)
  collectThemeMediaRefs(snapshot.theme, refs)

  SNAPSHOT_OBJECT_SCHEMAS.forEach(({ key, schema }) => {
    collectNodeMediaRefs(snapshot[key], schema, refs)
  })
  SNAPSHOT_RECORD_SCHEMAS.forEach(({ key, schema }) => {
    collectRecordMediaRefs(snapshot[key], schema, refs)
  })
  SNAPSHOT_COLLECTION_SCHEMAS.forEach(({ key, schema }) => {
    collectCollectionMediaRefs(snapshot[key], schema, refs)
  })

  return refs
}

export function applyMediaMapToSnapshot(snapshot, resolveValue) {
  if (!snapshot || typeof snapshot !== 'object') return
  if (typeof resolveValue !== 'function') return

  hydrateNodeMedia(snapshot, ROOT_MEDIA_SCHEMA, resolveValue)
  hydrateThemeMedia(snapshot.theme, resolveValue)

  SNAPSHOT_OBJECT_SCHEMAS.forEach(({ key, schema }) => {
    hydrateNodeMedia(snapshot[key], schema, resolveValue)
  })
  SNAPSHOT_RECORD_SCHEMAS.forEach(({ key, schema }) => {
    hydrateRecordMedia(snapshot[key], schema, resolveValue)
  })
  SNAPSHOT_COLLECTION_SCHEMAS.forEach(({ key, schema }) => {
    if (!Array.isArray(snapshot[key])) return
    snapshot[key].forEach((item, index) => hydrateNodeMedia(item, schema, resolveValue, null, index))
  })
}

export function restoreInlineMediaFromMap(snapshot, mediaEntries) {
  if (!snapshot || typeof snapshot !== 'object') return
  if (!(mediaEntries instanceof Map) || mediaEntries.size === 0) return
  applyMediaMapToSnapshot(snapshot, ref => mediaEntries.get(ref))
}

export function stripSnapshotMediaFields(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot

  stripNodeMedia(snapshot, ROOT_MEDIA_SCHEMA)
  stripThemeMedia(snapshot.theme)

  SNAPSHOT_OBJECT_SCHEMAS.forEach(({ key, schema }) => {
    stripNodeMedia(snapshot[key], schema)
  })
  SNAPSHOT_RECORD_SCHEMAS.forEach(({ key, schema }) => {
    stripRecordMedia(snapshot[key], schema)
  })
  SNAPSHOT_COLLECTION_SCHEMAS.forEach(({ key, schema }) => {
    if (!Array.isArray(snapshot[key])) return
    snapshot[key].forEach((item) => stripNodeMedia(item, schema))
  })

  return snapshot
}
