export type StorageMediaEntryValue =
  | string
  | Blob
  | ArrayBuffer
  | Uint8Array
  | Record<string, unknown>
  | null

export type StorageMediaEntryMap = Map<string, StorageMediaEntryValue>
export type StorageMessageThread = unknown[]
export type StorageMessagePartitions = Map<string, StorageMessageThread>

export interface StorageRootMediaRefs {
  wallpaper?: string | null
  wallpaperRef?: string
  lockScreenWallpaper?: string | null
  lockScreenWallpaperRef?: string
}

export interface StorageConfigSnapshot {
  id: string
  name: string
  url: string
  key: string
  model: string
  temperature: number | null
  maxTokens: number | null
  [key: string]: unknown
}

export interface StoragePlannerSnapshot {
  events: Record<string, unknown>[]
  diaryEntries: Record<string, unknown>[]
  categories: Record<string, unknown>[]
  characterSchedules: Record<string, unknown>
}

export interface StorageOfflinePresetsSnapshot {
  presets: Record<string, unknown>[]
  activePresetId: string | null
  regexRules: Record<string, unknown>[]
  theme: string
  layout: string
  avatarMode: string
  themeConfig: {
    customCss: string
    fontFamily: string
    fontImport: string
  }
}

export interface StorageReaderWindowSize {
  width: number | null
  height: number | null
}

export interface StorageAppData {
  version: number
  localUpdatedAt: number
  contacts: Record<string, unknown>[]
  configs: StorageConfigSnapshot[]
  activeConfigId: string
  settings: Record<string, unknown>
  wallpaper: string | null
  lockScreenWallpaper: string | null
  theme: Record<string, unknown>
  lorebook: Record<string, unknown>[]
  personas: Record<string, unknown>[]
  defaultPersonaId: string | null
  stickers: Record<string, unknown>[]
  stickerGroups: Record<string, unknown>[]
  forum: Record<string, unknown>[]
  forumUser: Record<string, unknown> | null
  forumFollowing: Record<string, unknown>[]
  forumContactGroups: Record<string, unknown>[]
  forumContactGroupMap: Record<string, unknown>
  widgets: Record<string, unknown>[]
  savedThemes: Record<string, unknown>[]
  activeThemeId: string
  vnProjects: Record<string, unknown>[]
  vnCurrentProjectId: string | null
  vnImageGenConfig: Record<string, unknown> | null
  vnTtsConfig: Record<string, unknown> | null
  callResources: Record<string, unknown>
  characterResources: Record<string, unknown>
  albumPhotos: Record<string, unknown>[]
  meetMeetings: Record<string, unknown>[]
  meetPresets: Record<string, unknown>[]
  meetCurrentMeetingId: string | null
  meetAssetSources: Record<string, unknown> | null
  readerBooks: Record<string, unknown>[]
  readerSettings: Record<string, unknown> | null
  readerAISettings: Record<string, unknown> | null
  readerWindowSize: StorageReaderWindowSize | null
  readerAIChat: Record<string, unknown> | null
  readerAIChatSessions: Record<string, Record<string, unknown>> | null
  readerSelectionChatSessions: Record<string, Record<string, unknown>> | null
  readerCurrentChatSessionKey: string
  music: Record<string, unknown> | null
  planner: StoragePlannerSnapshot
  offlinePresets: StorageOfflinePresetsSnapshot
  [key: string]: unknown
}

export interface ExternalizedMediaSnapshot {
  rootMedia: StorageRootMediaRefs
  mediaEntries: StorageMediaEntryMap
}

export interface StorageSnapshotEnvelope {
  snapshot: StorageAppData
  mediaEntries: StorageMediaEntryMap
}

export interface StorageSnapshotBuildOptions {
  inlineMessages?: boolean
  localUpdatedAt?: number
  freshLocalUpdatedAt?: boolean
}

export interface StorageSnapshotPack extends StorageSnapshotEnvelope {
  messagePartitions: StorageMessagePartitions
}

export interface HydratedStoredSnapshotResult {
  snapshot: StorageAppData
  persistedContactIds: Set<string>
  shouldMigrateInlineMessages: boolean
}

export interface StorageCompactBackupSnapshot extends Partial<StorageAppData> {
  version: number
  contacts: Record<string, unknown>[]
  backupMeta?: {
    kind?: string
    isPartial?: boolean
    omittedKeys?: string[]
    [key: string]: unknown
  }
}

export type StorageBackupFormat = 'json' | 'zip'

export interface StorageBackupBuildOptions {
  includeSecrets?: boolean
  excludeMedia?: boolean
  format?: StorageBackupFormat
}

export interface StorageBackupBuildResult {
  format: StorageBackupFormat
  snapshot: StorageAppData
  blob: Blob
}

export interface StorageBackupImportOptions {
  fileName?: string
  type?: string
  suppressCloudSync?: boolean
  reason?: string
}

export interface StorageExportDataOptions {
  includeSecrets?: boolean
  format?: StorageBackupFormat
}

export interface StorageFlushSaveOptions {
  allowSignificantDataLoss?: boolean
  backupFirst?: boolean
  suppressCloudSync?: boolean
  reason?: string
}

export type StorageFlushSaveResult = StorageSnapshotPack | null
export type StorageScheduleSave = (options?: { urgent?: boolean }) => void
export type StorageSnapshotBuilder = (options?: StorageSnapshotBuildOptions) => StorageSnapshotPack
export type StorageHasUserData = (snapshot: unknown) => boolean
export type StorageShowToast = (message: string, duration?: number) => void
export type StorageFlushSave = (options?: StorageFlushSaveOptions) => Promise<StorageFlushSaveResult>

export interface StorageCurrentSnapshotMeta {
  localUpdatedAt: number
  hasUserData: boolean
}

export interface StorageStoreLike {
  contacts?: Record<string, unknown>[]
  personas?: Record<string, unknown>[]
  stickers?: Record<string, unknown>[]
  theme?: Record<string, unknown>
  widgets?: Record<string, unknown>[]
  readerBooks?: Record<string, unknown>[]
  savedThemes?: Record<string, unknown>[]
  vnProjects?: Record<string, unknown>[]
  meetMeetings?: Record<string, unknown>[]
  wallpaper?: string | null
  wallpaperRef?: string
  lockScreenWallpaper?: string | null
  lockScreenWallpaperRef?: string
}

export interface StorageMomentsStoreLike {
  moments?: Record<string, unknown>[]
  forumUser?: Record<string, unknown> | null
}

export interface StorageAlbumStoreLike {
  photos?: Record<string, unknown>[]
}

export interface StoragePlannerStoreLike {
  exportData(): StoragePlannerSnapshot
}

export interface StorageCharResStoreLike {
  exportData(): Record<string, unknown>
}

export interface StorageBridgeApi {
  buildBackupBlob(options?: StorageBackupBuildOptions): Promise<StorageBackupBuildResult>
  flushSaveNow(options?: StorageFlushSaveOptions): Promise<StorageFlushSaveResult>
  getCurrentSnapshotMeta(): StorageCurrentSnapshotMeta
  importBackupBlob(file: Blob | File, options?: StorageBackupImportOptions): Promise<boolean>
  scheduleSave: StorageScheduleSave
}

export interface StorageComposableApi extends StorageBridgeApi {
  loadAll(): Promise<StorageAppData>
  exportData(options?: StorageExportDataOptions): Promise<boolean>
  importData(file: Blob | File): Promise<boolean>
  requestPersistence(): Promise<boolean>
}

export interface StoragePersistenceControllerOptions {
  hasUserData: StorageHasUserData
  showToast: StorageShowToast
  snapshotAppData: StorageSnapshotBuilder
  flushSaveNow: StorageFlushSave
  canFlushOnPageHide?: () => boolean
}

export interface StoragePersistenceController {
  bindAutoFlushLifecycle(): boolean
  maybeWarnAboutPersistence(snapshot: StorageAppData): Promise<void>
  requestPersistence(): Promise<boolean>
}

export interface StorageRuntimeContact extends Record<string, unknown> {
  maxMessages?: number
  msgs?: unknown[]
}

export interface StorageRuntimeStore extends StorageStoreLike {
  contacts?: StorageRuntimeContact[]
}

export interface StorageRuntimeOptions {
  store: StorageRuntimeStore
  momentsStore: StorageMomentsStoreLike
  readerStore: object
  charResStore: StorageCharResStoreLike
  albumStore: StorageAlbumStoreLike
  livenessStore: object
  musicStore: object
  offlineStore: object
  plannerStore: StoragePlannerStoreLike
  exportResources(): Record<string, unknown>
  importResources(resources: Record<string, unknown>): void
  externalizeStateMedia(input: Record<string, unknown>): ExternalizedMediaSnapshot
}

export type StorageRuntimeResolvedDeps = Omit<StorageRuntimeOptions, 'externalizeStateMedia'>

export interface StorageRuntime {
  buildBaseSnapshot(): StorageSnapshotEnvelope
  applyAppDataToState(appData: unknown, scheduleSave?: StorageScheduleSave): StorageAppData
  trimMessagesIfNeeded(): void
}

export interface StorageBuildDeps {
  store: StorageStoreLike
  momentsStore: StorageMomentsStoreLike
  albumStore: StorageAlbumStoreLike
  plannerStore: StoragePlannerStoreLike
  charResStore: StorageCharResStoreLike
  externalizeStateMedia(input: Record<string, unknown>): ExternalizedMediaSnapshot
  exportCallResources(): Record<string, unknown>
}

export interface StorageApplyDeps {
  scheduleSave?: () => void
  [key: string]: unknown
}
