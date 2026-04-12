import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC_DIR = path.join(ROOT_DIR, 'src')
const FEATURES_DIR = path.join(SRC_DIR, 'features')

const HOTSPOT_LINE_CAPS = [
  { file: 'src/composables/useApi.js', maxLines: 340 },
  { file: 'src/composables/storage/appData.js', maxLines: 300 },
  { file: 'src/composables/storage/mediaSnapshot.js', maxLines: 260 },
  { file: 'src/composables/storage/mediaSnapshotWalkers.js', maxLines: 180 },
  { file: 'src/composables/storage/mediaSnapshotTraversal.js', maxLines: 360 },
  { file: 'src/composables/storage/mediaSnapshotFieldTransforms.js', maxLines: 430 },
  { file: 'src/composables/api/chat/directChatOrchestrator.js', maxLines: 170 },
  { file: 'src/composables/api/chat/groupSingleChatOrchestrator.js', maxLines: 200 },
  { file: 'src/composables/api/chat/groupMultiChatOrchestrator.js', maxLines: 170 },
  { file: 'src/composables/call/callHistory.js', maxLines: 220 },
  { file: 'src/composables/useStorage.js', maxLines: 260 },
  { file: 'src/features/call/components/CallOverlay.vue', maxLines: 450 },
  { file: 'src/features/call/composables/useCallOverlayRuntime.js', maxLines: 420 },
  { file: 'src/features/call/composables/useCallOverlaySpeechRuntime.js', maxLines: 120 },
  { file: 'src/features/call/composables/useCallSpeechSession.js', maxLines: 420 },
  { file: 'src/features/chat/components/ChatCallLayers.vue', maxLines: 100 },
  { file: 'src/features/chat/components/ChatStickerLayers.vue', maxLines: 160 },
  { file: 'src/features/chat/components/ChatMessageBlock.vue', maxLines: 220 },
  { file: 'src/features/chat/components/ChatInput.vue', maxLines: 560 },
  { file: 'src/features/chat/composables/useChatInteractionSurface.js', maxLines: 180 },
  { file: 'src/features/chat/composables/useChatTimelineShell.js', maxLines: 120 },
  { file: 'src/features/chat/views/ChatView.vue', maxLines: 730 },
  { file: 'src/features/meet/composables/useMeetResources.js', maxLines: 560 },
  { file: 'src/features/meet/composables/meetPlayer/useMeetPlayerMedia.js', maxLines: 120 },
  { file: 'src/features/meet/composables/meetPlayer/useMeetPlayerRuntime.js', maxLines: 220 },
  { file: 'src/features/meet/views/MeetPlayerView.vue', maxLines: 420 },
  { file: 'src/features/moments/views/MomentsView.vue', maxLines: 860 }
]

const ALLOWED_CROSS_FEATURE_IMPORTS = new Set()

const IMPORT_RE = /(?:import|export)\s[\s\S]*?\sfrom\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
const EXTENSIONS = ['', '.js', '.vue', '.mjs', '.cjs', '.ts']

function getLineCount(filePath) {
  const content = readFileSync(filePath, 'utf8')
  return content.split(/\r?\n/).length
}

function collectFiles(dirPath, predicate, acc = []) {
  const entries = readdirSync(dirPath, { withFileTypes: true })
  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      collectFiles(fullPath, predicate, acc)
      return
    }
    if (predicate(fullPath)) acc.push(fullPath)
  })
  return acc
}

function extractImportSpecifiers(source) {
  const specifiers = []
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1] || match[2] || ''
    if (specifier) specifiers.push(specifier)
  }
  return specifiers
}

function resolveImportPath(importerPath, specifier) {
  const basePath = path.resolve(path.dirname(importerPath), specifier)
  for (const ext of EXTENSIONS) {
    const directCandidate = basePath + ext
    if (statExists(directCandidate) && statSync(directCandidate).isFile()) {
      return directCandidate
    }
  }
  for (const ext of EXTENSIONS.slice(1)) {
    const indexCandidate = path.join(basePath, 'index' + ext)
    if (statExists(indexCandidate) && statSync(indexCandidate).isFile()) {
      return indexCandidate
    }
  }
  return basePath
}

function statExists(candidatePath) {
  try {
    statSync(candidatePath)
    return true
  } catch {
    return false
  }
}

function normalizeForCompare(filePath) {
  return filePath.split(path.sep).join('/')
}

function getFeatureNameFromPath(filePath) {
  const normalized = normalizeForCompare(filePath)
  const marker = '/src/features/'
  const markerIndex = normalized.indexOf(marker)
  if (markerIndex === -1) return ''
  const rest = normalized.slice(markerIndex + marker.length)
  const [featureName] = rest.split('/')
  return featureName || ''
}

function getFeaturePublicEntryPath(featureName) {
  return path.join(FEATURES_DIR, featureName, 'index.js')
}

function getFeatureUiEntryPath(featureName) {
  return path.join(FEATURES_DIR, featureName, 'ui.js')
}

describe('architecture guardrails', () => {
  it('keeps hotspot files within agreed hard caps', () => {
    const violations = HOTSPOT_LINE_CAPS
      .map(({ file, maxLines }) => {
        const fullPath = path.join(ROOT_DIR, file)
        const lineCount = getLineCount(fullPath)
        return lineCount > maxLines ? `${file}: ${lineCount} > ${maxLines}` : null
      })
      .filter(Boolean)

    expect(violations).toEqual([])
  })

  it('does not introduce new cross-feature internal imports beyond the current allowlist', () => {
    const featureFiles = collectFiles(
      FEATURES_DIR,
      (filePath) => filePath.endsWith('.js') || filePath.endsWith('.vue')
    )
    const violations = []

    featureFiles.forEach((filePath) => {
      const importerFeature = getFeatureNameFromPath(filePath)
      const source = readFileSync(filePath, 'utf8')
      const specifiers = extractImportSpecifiers(source)

      specifiers.forEach((specifier) => {
        if (!specifier.startsWith('.')) return
        const resolvedPath = resolveImportPath(filePath, specifier)
        const importedFeature = getFeatureNameFromPath(resolvedPath)
        if (!importedFeature || importedFeature === importerFeature) return
        const edge = `${normalizeForCompare(path.relative(ROOT_DIR, filePath))} -> ${normalizeForCompare(path.relative(ROOT_DIR, resolvedPath))}`
        if (!ALLOWED_CROSS_FEATURE_IMPORTS.has(edge)) {
          violations.push(edge)
        }
      })
    })

    expect(violations).toEqual([])
  })

  it('only allows non-feature modules to import features through public entry files', () => {
    const sourceFiles = collectFiles(
      SRC_DIR,
      (filePath) => filePath.endsWith('.js') || filePath.endsWith('.vue')
    )
    const violations = []

    sourceFiles.forEach((filePath) => {
      const importerFeature = getFeatureNameFromPath(filePath)
      if (importerFeature) return

      const source = readFileSync(filePath, 'utf8')
      const specifiers = extractImportSpecifiers(source)

      specifiers.forEach((specifier) => {
        if (!specifier.startsWith('.')) return

        const resolvedPath = resolveImportPath(filePath, specifier)
        const importedFeature = getFeatureNameFromPath(resolvedPath)
        if (!importedFeature) return

        const allowedEntryPaths = [
          getFeaturePublicEntryPath(importedFeature),
          getFeatureUiEntryPath(importedFeature)
        ].map(normalizeForCompare)
        if (!allowedEntryPaths.includes(normalizeForCompare(resolvedPath))) {
          violations.push(
            `${normalizeForCompare(path.relative(ROOT_DIR, filePath))} -> ${normalizeForCompare(path.relative(ROOT_DIR, resolvedPath))}`
          )
        }
      })
    })

    expect(violations).toEqual([])
  })
})
