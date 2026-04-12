import {
  buildMediaRef,
  isBlobUrl,
  isInlineImageDataUrl,
  shouldExternalizeInlineMedia
} from './mediaSnapshotHelpers'

function resolveListFieldOption(option, source, itemValue, itemIndex, context) {
  return typeof option === 'function' ? option(itemValue, itemIndex, context, source) : option
}

function resolveRecordFieldOption(option, source, itemValue, itemKey, context, index) {
  return typeof option === 'function' ? option(itemValue, itemKey, context, source, index) : option
}

export function externalizeMediaField(sourceObj, targetObj, options = {}) {
  if (!sourceObj || typeof sourceObj !== 'object' || !targetObj || typeof targetObj !== 'object') return

  const valueKey = options.valueKey || 'url'
  const refKey = options.refKey || 'imageRef'
  const shouldHandle = typeof options.shouldHandle === 'function' ? options.shouldHandle : null
  const rawValue = typeof sourceObj[valueKey] === 'string' ? sourceObj[valueKey] : ''
  if (shouldHandle && !shouldHandle(sourceObj, rawValue)) return

  let ref = typeof sourceObj[refKey] === 'string' && sourceObj[refKey] ? sourceObj[refKey] : ''
  if (!rawValue && ref && options.clearRefWhenValueMissing === true) {
    delete targetObj[refKey]
    if (sourceObj[refKey]) {
      sourceObj[refKey] = ''
    }
    return
  }

  const canExternalizeInline = shouldExternalizeInlineMedia(rawValue)
  const keepRefOnly = !!ref && (!rawValue || isBlobUrl(rawValue))
  if (!canExternalizeInline && !keepRefOnly) {
    if (ref) {
      delete targetObj[refKey]
      if (sourceObj[refKey]) {
        sourceObj[refKey] = ''
      }
      ref = ''
    }
    if (isBlobUrl(rawValue)) {
      targetObj[valueKey] = rawValue
    }
    return
  }

  if (!ref && canExternalizeInline && options.dedupeByUrl?.has(rawValue)) {
    ref = options.dedupeByUrl.get(rawValue)
  }
  if (!ref) {
    ref = buildMediaRef(options.scope || 'media', options.ownerId, options.itemId, options.index || 0)
  }

  if (canExternalizeInline) {
    options.dedupeByUrl?.set(rawValue, ref)
    options.mediaEntries?.set(ref, rawValue)
    if (options.preserveRuntimeValue !== true) {
      const runtimeUrl = options.ensureRuntimeMediaUrl?.(ref, rawValue) || ''
      if (runtimeUrl && runtimeUrl !== rawValue) {
        sourceObj[valueKey] = runtimeUrl
      }
    }
  } else if (keepRefOnly && !options.mediaEntries?.has(ref)) {
    const cachedValue = options.getCachedMediaValue?.(ref)
    if (cachedValue) {
      options.mediaEntries?.set(ref, cachedValue)
    }
  }

  targetObj[refKey] = ref
  if (canExternalizeInline || isBlobUrl(rawValue)) {
    delete targetObj[valueKey]
  }
  if (sourceObj[refKey] !== ref) {
    sourceObj[refKey] = ref
  }
}

export function hydrateMediaField(targetObj, options = {}) {
  if (!targetObj || typeof targetObj !== 'object') return

  const valueKey = options.valueKey || 'url'
  const refKey = options.refKey || 'imageRef'
  const shouldHandle = typeof options.shouldHandle === 'function' ? options.shouldHandle : null
  const currentValue = typeof targetObj[valueKey] === 'string' ? targetObj[valueKey] : ''
  if (shouldHandle && !shouldHandle(targetObj, currentValue)) return
  if (currentValue && !isBlobUrl(currentValue)) return

  const ref = typeof targetObj[refKey] === 'string' ? targetObj[refKey] : ''
  if (!ref) return

  const value = options.resolveValue(ref)
  if (typeof value === 'string' && value) {
    targetObj[valueKey] = value
  }
}

export function externalizeMediaListField(sourceObj, targetObj, options = {}, context = null) {
  if (!sourceObj || typeof sourceObj !== 'object' || !targetObj || typeof targetObj !== 'object') return

  const valueKey = options.valueKey || 'images'
  const refsKey = options.refsKey || 'imageRefs'
  const sourceValues = Array.isArray(sourceObj[valueKey]) ? sourceObj[valueKey] : []
  const sourceRefs = Array.isArray(sourceObj[refsKey]) ? sourceObj[refsKey] : []

  if (sourceValues.length === 0) {
    if (sourceRefs.length > 0 && options.clearRefsWhenValueMissing === true) {
      delete targetObj[refsKey]
      sourceObj[refsKey] = []
    }
    return
  }

  const nextValues = Array.isArray(targetObj[valueKey]) ? [...targetObj[valueKey]] : [...sourceValues]
  const nextRefs = new Array(sourceValues.length).fill('')
  let hasRef = false
  const total = Math.max(sourceValues.length, sourceRefs.length)

  for (let itemIndex = 0; itemIndex < total; itemIndex += 1) {
    const sourceSlot = {
      value: typeof sourceValues[itemIndex] === 'string' ? sourceValues[itemIndex] : '',
      ref: typeof sourceRefs[itemIndex] === 'string' ? sourceRefs[itemIndex] : ''
    }
    const nextSlot = { ...sourceSlot }

    externalizeMediaField(sourceSlot, nextSlot, {
      valueKey: 'value',
      refKey: 'ref',
      scope: resolveListFieldOption(options.scope, sourceObj, sourceSlot.value, itemIndex, context),
      ownerId: resolveListFieldOption(options.ownerId, sourceObj, sourceSlot.value, itemIndex, context),
      itemId: resolveListFieldOption(options.itemId, sourceObj, sourceSlot.value, itemIndex, context),
      index: itemIndex,
      mediaEntries: options.mediaEntries,
      dedupeByUrl: options.dedupeByUrl,
      clearRefWhenValueMissing: options.clearRefsWhenValueMissing === true,
      ensureRuntimeMediaUrl: options.ensureRuntimeMediaUrl,
      getCachedMediaValue: options.getCachedMediaValue,
      preserveRuntimeValue: options.preserveRuntimeValue === true
    })

    if (typeof nextSlot.value === 'string' && nextSlot.value) {
      nextValues[itemIndex] = nextSlot.value
    } else if (isBlobUrl(sourceSlot.value) || shouldExternalizeInlineMedia(sourceSlot.value) || nextSlot.ref) {
      nextValues[itemIndex] = ''
    } else if (typeof sourceValues[itemIndex] === 'string') {
      nextValues[itemIndex] = sourceValues[itemIndex]
    } else {
      nextValues[itemIndex] = ''
    }

    if (nextSlot.ref) {
      nextRefs[itemIndex] = nextSlot.ref
      hasRef = true
    }

    if (itemIndex < sourceValues.length && typeof sourceValues[itemIndex] === 'string' && sourceValues[itemIndex] !== sourceSlot.value) {
      sourceValues[itemIndex] = sourceSlot.value
    }
  }

  targetObj[valueKey] = nextValues.slice(0, sourceValues.length)
  if (hasRef) {
    targetObj[refsKey] = nextRefs.slice(0, sourceValues.length)
    sourceObj[refsKey] = nextRefs.slice(0, sourceValues.length)
  } else {
    delete targetObj[refsKey]
    sourceObj[refsKey] = []
  }
}

export function hydrateMediaListField(targetObj, options = {}) {
  if (!targetObj || typeof targetObj !== 'object') return

  const valueKey = options.valueKey || 'images'
  const refsKey = options.refsKey || 'imageRefs'
  const refs = Array.isArray(targetObj[refsKey]) ? targetObj[refsKey] : []
  if (refs.length === 0) return

  const currentValues = Array.isArray(targetObj[valueKey]) ? targetObj[valueKey] : []
  const total = Math.max(currentValues.length, refs.length)
  const nextValues = Array.from({ length: total }, (_, index) => (
    typeof currentValues[index] === 'string' ? currentValues[index] : ''
  ))

  for (let itemIndex = 0; itemIndex < total; itemIndex += 1) {
    if (nextValues[itemIndex] && !isBlobUrl(nextValues[itemIndex])) continue
    const ref = typeof refs[itemIndex] === 'string' ? refs[itemIndex] : ''
    if (!ref) continue
    const value = options.resolveValue(ref)
    if (typeof value === 'string' && value) {
      nextValues[itemIndex] = value
    }
  }

  targetObj[valueKey] = nextValues
}

export function collectMediaListFieldRefs(targetObj, field, refs) {
  if (!targetObj || typeof targetObj !== 'object') return
  const refList = Array.isArray(targetObj[field.refsKey]) ? targetObj[field.refsKey] : []
  refList.forEach((ref) => {
    if (typeof ref === 'string' && ref) refs.add(ref)
  })
}

export function externalizeMediaRecordField(sourceObj, targetObj, options = {}, context = null) {
  if (!sourceObj || typeof sourceObj !== 'object' || !targetObj || typeof targetObj !== 'object') return

  const valueKey = options.valueKey || 'appIcons'
  const refsKey = options.refsKey || 'appIconRefs'
  const sourceValues = sourceObj[valueKey] && typeof sourceObj[valueKey] === 'object' && !Array.isArray(sourceObj[valueKey])
    ? sourceObj[valueKey]
    : {}
  const sourceRefs = sourceObj[refsKey] && typeof sourceObj[refsKey] === 'object' && !Array.isArray(sourceObj[refsKey])
    ? sourceObj[refsKey]
    : {}
  const keys = Array.from(new Set([...Object.keys(sourceValues), ...Object.keys(sourceRefs)]))

  if (keys.length === 0) {
    if (Object.keys(sourceRefs).length > 0 && options.clearRefsWhenValueMissing === true) {
      delete targetObj[refsKey]
      sourceObj[refsKey] = {}
    }
    return
  }

  const nextValues = targetObj[valueKey] && typeof targetObj[valueKey] === 'object' && !Array.isArray(targetObj[valueKey])
    ? { ...targetObj[valueKey] }
    : { ...sourceValues }
  const nextRefs = {}
  let hasRef = false

  keys.forEach((itemKey, index) => {
    const sourceSlot = {
      value: typeof sourceValues[itemKey] === 'string' ? sourceValues[itemKey] : '',
      ref: typeof sourceRefs[itemKey] === 'string' ? sourceRefs[itemKey] : ''
    }
    const nextSlot = { ...sourceSlot }

    externalizeMediaField(sourceSlot, nextSlot, {
      valueKey: 'value',
      refKey: 'ref',
      scope: resolveRecordFieldOption(options.scope, sourceObj, sourceSlot.value, itemKey, context, index),
      ownerId: resolveRecordFieldOption(options.ownerId, sourceObj, sourceSlot.value, itemKey, context, index),
      itemId: resolveRecordFieldOption(options.itemId, sourceObj, sourceSlot.value, itemKey, context, index),
      index,
      mediaEntries: options.mediaEntries,
      dedupeByUrl: options.dedupeByUrl,
      clearRefWhenValueMissing: options.clearRefsWhenValueMissing === true,
      ensureRuntimeMediaUrl: options.ensureRuntimeMediaUrl,
      getCachedMediaValue: options.getCachedMediaValue,
      preserveRuntimeValue: options.preserveRuntimeValue === true
    })

    if (typeof nextSlot.value === 'string' && nextSlot.value) {
      nextValues[itemKey] = nextSlot.value
    } else if (isBlobUrl(sourceSlot.value) || shouldExternalizeInlineMedia(sourceSlot.value) || nextSlot.ref) {
      delete nextValues[itemKey]
    } else if (Object.prototype.hasOwnProperty.call(sourceValues, itemKey)) {
      nextValues[itemKey] = sourceValues[itemKey]
    } else {
      delete nextValues[itemKey]
    }

    if (nextSlot.ref) {
      nextRefs[itemKey] = nextSlot.ref
      hasRef = true
    }

    if (typeof sourceValues[itemKey] === 'string' && sourceValues[itemKey] !== sourceSlot.value) {
      sourceValues[itemKey] = sourceSlot.value
    }
  })

  targetObj[valueKey] = nextValues
  if (hasRef) {
    targetObj[refsKey] = nextRefs
    sourceObj[refsKey] = { ...nextRefs }
  } else {
    delete targetObj[refsKey]
    sourceObj[refsKey] = {}
  }
}

export function hydrateMediaRecordField(targetObj, options = {}) {
  if (!targetObj || typeof targetObj !== 'object') return

  const valueKey = options.valueKey || 'appIcons'
  const refsKey = options.refsKey || 'appIconRefs'
  const refs = targetObj[refsKey] && typeof targetObj[refsKey] === 'object' && !Array.isArray(targetObj[refsKey])
    ? targetObj[refsKey]
    : null
  if (!refs) return

  const values = targetObj[valueKey] && typeof targetObj[valueKey] === 'object' && !Array.isArray(targetObj[valueKey])
    ? { ...targetObj[valueKey] }
    : {}

  Object.entries(refs).forEach(([itemKey, ref]) => {
    if (typeof ref !== 'string' || !ref) return
    const currentValue = typeof values[itemKey] === 'string' ? values[itemKey] : ''
    if (currentValue && !isBlobUrl(currentValue)) return
    const value = options.resolveValue(ref)
    if (typeof value === 'string' && value) {
      values[itemKey] = value
    }
  })

  targetObj[valueKey] = values
}

export function collectMediaRecordFieldRefs(targetObj, field, refs) {
  if (!targetObj || typeof targetObj !== 'object') return
  const refMap = targetObj[field.refsKey] && typeof targetObj[field.refsKey] === 'object' && !Array.isArray(targetObj[field.refsKey])
    ? targetObj[field.refsKey]
    : null
  if (!refMap) return
  Object.values(refMap).forEach((ref) => {
    if (typeof ref === 'string' && ref) refs.add(ref)
  })
}

function isLocalSnapshotMediaValue(value) {
  return isInlineImageDataUrl(value) || isBlobUrl(value)
}

function resolveClearedScalarValue(valueKey, currentValue) {
  if (currentValue === null || /wallpaper/i.test(String(valueKey || ''))) {
    return null
  }
  return ''
}

export function stripMediaField(targetObj, options = {}) {
  if (!targetObj || typeof targetObj !== 'object') return

  const valueKey = options.valueKey || 'url'
  const refKey = options.refKey || 'imageRef'
  const currentValue = targetObj[valueKey]
  const ref = typeof targetObj[refKey] === 'string' ? targetObj[refKey] : ''
  if (!ref && !isLocalSnapshotMediaValue(currentValue)) return

  targetObj[valueKey] = resolveClearedScalarValue(valueKey, currentValue)
  delete targetObj[refKey]
}

export function stripMediaListField(targetObj, options = {}) {
  if (!targetObj || typeof targetObj !== 'object') return

  const valueKey = options.valueKey || 'images'
  const refsKey = options.refsKey || 'imageRefs'
  const values = Array.isArray(targetObj[valueKey]) ? targetObj[valueKey] : []
  const refs = Array.isArray(targetObj[refsKey]) ? targetObj[refsKey] : []
  const total = Math.max(values.length, refs.length)
  if (total === 0) return

  const nextValues = []
  for (let index = 0; index < total; index += 1) {
    const value = typeof values[index] === 'string' ? values[index] : ''
    const ref = typeof refs[index] === 'string' ? refs[index] : ''
    if (ref || isLocalSnapshotMediaValue(value)) continue
    if (value) nextValues.push(value)
  }

  targetObj[valueKey] = nextValues
  delete targetObj[refsKey]
}

export function stripMediaRecordField(targetObj, options = {}) {
  if (!targetObj || typeof targetObj !== 'object') return

  const valueKey = options.valueKey || 'appIcons'
  const refsKey = options.refsKey || 'appIconRefs'
  const values = targetObj[valueKey] && typeof targetObj[valueKey] === 'object' && !Array.isArray(targetObj[valueKey])
    ? targetObj[valueKey]
    : {}
  const refs = targetObj[refsKey] && typeof targetObj[refsKey] === 'object' && !Array.isArray(targetObj[refsKey])
    ? targetObj[refsKey]
    : {}
  const keys = Array.from(new Set([...Object.keys(values), ...Object.keys(refs)]))
  if (keys.length === 0) return

  const nextValues = {}
  keys.forEach((key) => {
    const value = typeof values[key] === 'string' ? values[key] : ''
    const ref = typeof refs[key] === 'string' ? refs[key] : ''
    if (ref || isLocalSnapshotMediaValue(value)) return
    if (value) {
      nextValues[key] = value
    }
  })

  targetObj[valueKey] = nextValues
  delete targetObj[refsKey]
}
