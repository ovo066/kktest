import {
  collectMediaListFieldRefs,
  collectMediaRecordFieldRefs,
  externalizeMediaField,
  externalizeMediaListField,
  externalizeMediaRecordField,
  hydrateMediaField,
  hydrateMediaListField,
  hydrateMediaRecordField,
  stripMediaField,
  stripMediaListField,
  stripMediaRecordField
} from './mediaSnapshotFieldTransforms'

function resolveFieldOption(option, source, index, context) {
  return typeof option === 'function' ? option(source, index, context) : option
}

function resolveShouldHandle(field, mode, context) {
  const specific = mode === 'hydrate' ? field.hydrateShouldHandle : field.extractShouldHandle
  if (specific === null) return null

  const handler = typeof specific === 'function'
    ? specific
    : (typeof field.shouldHandle === 'function' ? field.shouldHandle : null)
  if (!handler) return null

  return (item, rawValue) => handler(item, rawValue, context)
}

function createNodeContext(source, target, parentContext, index, key = null) {
  return {
    source,
    target,
    index,
    key,
    parent: parentContext?.source || null,
    parentTarget: parentContext?.target || null,
    parentIndex: parentContext?.index ?? null,
    parentKey: parentContext?.key ?? null,
    parentContext: parentContext || null
  }
}

export function cloneNodeWithMedia(source, schema, state, parentContext = null, index = 0, key = null) {
  if (!source || typeof source !== 'object') return source

  const next = { ...source }
  const context = createNodeContext(source, next, parentContext, index, key)

  const fields = Array.isArray(schema?.fields) ? schema.fields : []
  fields.forEach((field) => {
    externalizeMediaField(source, next, {
      valueKey: field.valueKey,
      refKey: field.refKey,
      scope: resolveFieldOption(field.scope, source, index, context),
      ownerId: resolveFieldOption(field.ownerId, source, index, context),
      itemId: resolveFieldOption(field.itemId, source, index, context),
      index,
      mediaEntries: state.mediaEntries,
      dedupeByUrl: state.dedupeByUrl,
      clearRefWhenValueMissing: field.clearRefWhenValueMissing === true,
      ensureRuntimeMediaUrl: state.ensureRuntimeMediaUrl,
      getCachedMediaValue: state.getCachedMediaValue,
      shouldHandle: resolveShouldHandle(field, 'extract', context),
      preserveRuntimeValue: field.preserveRuntimeValue === true
    })
  })

  const listFields = Array.isArray(schema?.listFields) ? schema.listFields : []
  listFields.forEach((field) => {
    externalizeMediaListField(source, next, {
      valueKey: field.valueKey,
      refsKey: field.refsKey,
      scope: field.scope,
      ownerId: field.ownerId,
      itemId: field.itemId,
      mediaEntries: state.mediaEntries,
      dedupeByUrl: state.dedupeByUrl,
      clearRefsWhenValueMissing: field.clearRefsWhenValueMissing === true,
      ensureRuntimeMediaUrl: state.ensureRuntimeMediaUrl,
      getCachedMediaValue: state.getCachedMediaValue,
      preserveRuntimeValue: field.preserveRuntimeValue === true
    }, context)
  })

  const recordFields = Array.isArray(schema?.recordFields) ? schema.recordFields : []
  recordFields.forEach((field) => {
    externalizeMediaRecordField(source, next, {
      valueKey: field.valueKey,
      refsKey: field.refsKey,
      scope: field.scope,
      ownerId: field.ownerId,
      itemId: field.itemId,
      mediaEntries: state.mediaEntries,
      dedupeByUrl: state.dedupeByUrl,
      clearRefsWhenValueMissing: field.clearRefsWhenValueMissing === true,
      ensureRuntimeMediaUrl: state.ensureRuntimeMediaUrl,
      getCachedMediaValue: state.getCachedMediaValue,
      preserveRuntimeValue: field.preserveRuntimeValue === true
    }, context)
  })

  const children = Array.isArray(schema?.children) ? schema.children : []
  children.forEach((child) => {
    const childKey = child.key
    const value = source[childKey]

    if (child.collection) {
      if (Array.isArray(value)) {
        next[childKey] = value.map((item, childIndex) => cloneNodeWithMedia(item, child.schema, state, context, childIndex))
      } else if (child.defaultToEmpty !== false) {
        next[childKey] = []
      }
      return
    }

    if (child.record) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        next[childKey] = cloneRecordWithMedia(value, child.schema, state, context)
      } else if (child.defaultToEmpty !== false) {
        next[childKey] = {}
      }
      return
    }

    if (value && typeof value === 'object') {
      next[childKey] = cloneNodeWithMedia(value, child.schema, state, context, index, childKey)
    }
  })

  return next
}

export function cloneCollectionWithMedia(items, schema, state) {
  if (!Array.isArray(items)) return []
  return items.map((item, index) => cloneNodeWithMedia(item, schema, state, null, index))
}

export function cloneRecordWithMedia(items, schema, state, parentContext = null) {
  if (!items || typeof items !== 'object' || Array.isArray(items)) return {}

  const next = {}
  Object.entries(items).forEach(([entryKey, value], index) => {
    if (value && typeof value === 'object') {
      next[entryKey] = cloneNodeWithMedia(value, schema, state, parentContext, index, entryKey)
    } else {
      next[entryKey] = value
    }
  })
  return next
}

export function collectNodeMediaRefs(target, schema, refs) {
  if (!target || typeof target !== 'object') return

  const fields = Array.isArray(schema?.fields) ? schema.fields : []
  fields.forEach((field) => {
    const ref = typeof target[field.refKey] === 'string' ? target[field.refKey] : ''
    if (ref) refs.add(ref)
  })

  const listFields = Array.isArray(schema?.listFields) ? schema.listFields : []
  listFields.forEach((field) => {
    collectMediaListFieldRefs(target, field, refs)
  })

  const recordFields = Array.isArray(schema?.recordFields) ? schema.recordFields : []
  recordFields.forEach((field) => {
    collectMediaRecordFieldRefs(target, field, refs)
  })

  const children = Array.isArray(schema?.children) ? schema.children : []
  children.forEach((child) => {
    const value = target[child.key]
    if (child.collection) {
      if (Array.isArray(value)) value.forEach(item => collectNodeMediaRefs(item, child.schema, refs))
      return
    }
    if (child.record) {
      collectRecordMediaRefs(value, child.schema, refs)
      return
    }
    if (value && typeof value === 'object') {
      collectNodeMediaRefs(value, child.schema, refs)
    }
  })
}

export function collectCollectionMediaRefs(items, schema, refs) {
  if (!Array.isArray(items)) return
  items.forEach(item => collectNodeMediaRefs(item, schema, refs))
}

export function collectRecordMediaRefs(items, schema, refs) {
  if (!items || typeof items !== 'object' || Array.isArray(items)) return
  Object.values(items).forEach((item) => {
    if (item && typeof item === 'object') {
      collectNodeMediaRefs(item, schema, refs)
    }
  })
}

export function stripNodeMedia(target, schema) {
  if (!target || typeof target !== 'object') return

  const fields = Array.isArray(schema?.fields) ? schema.fields : []
  fields.forEach((field) => {
    stripMediaField(target, {
      valueKey: field.valueKey,
      refKey: field.refKey
    })
  })

  const listFields = Array.isArray(schema?.listFields) ? schema.listFields : []
  listFields.forEach((field) => {
    stripMediaListField(target, {
      valueKey: field.valueKey,
      refsKey: field.refsKey
    })
  })

  const recordFields = Array.isArray(schema?.recordFields) ? schema.recordFields : []
  recordFields.forEach((field) => {
    stripMediaRecordField(target, {
      valueKey: field.valueKey,
      refsKey: field.refsKey
    })
  })

  const children = Array.isArray(schema?.children) ? schema.children : []
  children.forEach((child) => {
    const value = target[child.key]
    if (child.collection) {
      if (Array.isArray(value)) value.forEach(item => stripNodeMedia(item, child.schema))
      return
    }
    if (child.record) {
      stripRecordMedia(value, child.schema)
      return
    }
    if (value && typeof value === 'object') {
      stripNodeMedia(value, child.schema)
    }
  })
}

export function stripRecordMedia(items, schema) {
  if (!items || typeof items !== 'object' || Array.isArray(items)) return
  Object.values(items).forEach((item) => {
    if (item && typeof item === 'object') {
      stripNodeMedia(item, schema)
    }
  })
}

export function hydrateNodeMedia(target, schema, resolveValue, parentContext = null, index = 0, key = null) {
  if (!target || typeof target !== 'object') return

  const context = createNodeContext(target, target, parentContext, index, key)

  const fields = Array.isArray(schema?.fields) ? schema.fields : []
  fields.forEach((field) => {
    hydrateMediaField(target, {
      valueKey: field.valueKey,
      refKey: field.refKey,
      resolveValue,
      shouldHandle: resolveShouldHandle(field, 'hydrate', context)
    })
  })

  const listFields = Array.isArray(schema?.listFields) ? schema.listFields : []
  listFields.forEach((field) => {
    hydrateMediaListField(target, {
      valueKey: field.valueKey,
      refsKey: field.refsKey,
      resolveValue
    })
  })

  const recordFields = Array.isArray(schema?.recordFields) ? schema.recordFields : []
  recordFields.forEach((field) => {
    hydrateMediaRecordField(target, {
      valueKey: field.valueKey,
      refsKey: field.refsKey,
      resolveValue
    })
  })

  const children = Array.isArray(schema?.children) ? schema.children : []
  children.forEach((child) => {
    const value = target[child.key]
    if (child.collection) {
      if (Array.isArray(value)) {
        value.forEach((item, childIndex) => hydrateNodeMedia(item, child.schema, resolveValue, context, childIndex))
      }
      return
    }
    if (child.record) {
      hydrateRecordMedia(value, child.schema, resolveValue, context)
      return
    }
    if (value && typeof value === 'object') {
      hydrateNodeMedia(value, child.schema, resolveValue, context, index, child.key)
    }
  })
}

export function hydrateRecordMedia(items, schema, resolveValue, parentContext = null) {
  if (!items || typeof items !== 'object' || Array.isArray(items)) return
  Object.entries(items).forEach(([entryKey, item], index) => {
    if (item && typeof item === 'object') {
      hydrateNodeMedia(item, schema, resolveValue, parentContext, index, entryKey)
    }
  })
}
