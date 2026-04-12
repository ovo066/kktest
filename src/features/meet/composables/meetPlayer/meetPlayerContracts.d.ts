import type { Ref } from 'vue'
import type {
  MeetApiMessage,
  MeetBackgroundInstruction,
  MeetBgmInstruction,
  MeetCgInstruction,
  MeetCharacterRef,
  MeetChoiceOption,
  MeetDialogInstruction,
  MeetInstruction,
  MeetMoodInstruction,
  MeetNarrationInstruction,
  MeetSfxInstruction,
  MeetSpriteInstruction,
  MeetVariableInstruction
} from '../meetInstructionContracts'

export interface MeetPlayerDialogState {
  characterId: string
  vnName: string
  text: string
  nameColor: string
  isNarration: boolean
}

export interface MeetPlayerBackgroundState {
  name: string
  url: string | null
}

export interface MeetPlayerCgState {
  name: string
  prompt: string
  url: string | null
}

export interface MeetPlayerSpriteState {
  characterId: string
  vnName: string
  expression: string
  position: string
  animation: string | null
  url: string | null
  isExiting: boolean
}

export interface MeetPlayerVolumeState {
  bgm?: number
  voice?: number
  sfx?: number
}

export interface MeetMeetingResourcesLike {
  backgrounds?: Record<string, { url?: string | null }>
  cgs?: Record<string, { url?: string | null }>
  bgm?: Record<string, { url?: string | null }>
  sfx?: Record<string, { url?: string | null }>
  sprites?: Record<string, unknown>
}

export interface MeetMeetingLike {
  characters?: MeetCharacterRef[]
  history?: Array<MeetInstruction | Record<string, unknown>>
  llmContext?: Array<MeetApiMessage | Record<string, unknown>>
  variables?: Record<string, unknown>
  voice?: {
    ttsEnabled?: boolean
  }
  resources?: MeetMeetingResourcesLike
  location?: string
  worldSetting?: string
  presetId?: string | null
}

export interface MeetPlayerState {
  currentDialog: MeetPlayerDialogState | null
  currentChoices: MeetChoiceOption[] | null
  currentLocation: string
  currentTimeOfDay: string
  moodValues: Record<string, number>
  isPlaying: boolean
  isWaitingInput: boolean
  isAutoPlay: boolean
  autoPlayDelay: number
  instructionQueue: MeetInstruction[]
  instructionIndex: number
  _resolveWait: (() => void) | null
  isGenerating?: boolean
  currentBg?: MeetPlayerBackgroundState | null
  currentCg?: MeetPlayerCgState | null
  currentBgm?: string | null
  sprites: MeetPlayerSpriteState[]
  volume?: MeetPlayerVolumeState
}

export interface MeetStoreLike {
  addToHistory(entry: MeetInstruction | Record<string, unknown>): void
  getResource(type: string, key: string): { url?: string | null } | null
  getVariable(key: string, fallback?: unknown): unknown
  resetPlayer(): void
  setVariable(key: string, value: unknown): void
}

export interface MeetPlayerMediaController {
  currentBgmUrl: Ref<string | null>
  needsAudioUnlock: Ref<boolean>
  tryResumeAudioPlayback(): Promise<void>
  resetMediaRuntime(): void
  clearTransientSceneMedia(): void
  applySnapshotMediaInstruction(inst: MeetInstruction): boolean
  handleBgInstruction(inst: MeetBackgroundInstruction): Promise<void>
  handleCgInstruction(inst: MeetCgInstruction): Promise<void>
  handleSpriteInstruction(inst: MeetSpriteInstruction): Promise<void>
  handleBgmInstruction(inst: MeetBgmInstruction): Promise<void>
  handleSfxInstruction(inst: MeetSfxInstruction): Promise<void>
  applyAutoSceneFixups(options: {
    sawBg: boolean
    sawBgm: boolean
    sawCg: boolean
    locationChanged: boolean
    timeChanged: boolean
  }): Promise<void>
}

export interface MeetInstructionPlayerOptions {
  meeting: Ref<MeetMeetingLike | null>
  meetStore: MeetStoreLike
  player: MeetPlayerState
  scheduleSave(): void
  speak(text: string, characterId: string): Promise<unknown>
  stopSpeaking(): void
  media: MeetPlayerMediaController
  clearPendingWait(): void
  applyMoodInstruction(inst: MeetMoodInstruction): void
  applyVariableInstruction(inst: MeetVariableInstruction): void
}

export interface MeetInstructionPlayerApi {
  handleAdvanceTap(): void
  onTextComplete(): void
  playInstructions(instructions: MeetInstruction[]): Promise<void>
}

export interface MeetPlayerRuntimeOptions {
  meeting: Ref<MeetMeetingLike | null>
  meetStore: MeetStoreLike
  player: MeetPlayerState
  scheduleSave(): void
  startMeeting(options?: Record<string, unknown>): Promise<{ success: boolean, instructions?: MeetInstruction[] }>
  sendChoice(text: string): Promise<{ success: boolean, instructions?: MeetInstruction[] }>
  sendInput(text: string): Promise<{ success: boolean, instructions?: MeetInstruction[] }>
  speak(text: string, characterId: string): Promise<unknown>
  stopSpeaking(): void
  media: MeetPlayerMediaController
}

export interface MeetPlayerRuntimeApi {
  restoreMeetingRuntime(): void
  continueMeeting(): Promise<void>
  restartMeeting(): Promise<void>
  onCustomInput(text: string): Promise<void>
  onChoiceSelect(opt: MeetChoiceOption | null): Promise<void>
  handleAdvanceTap(): void
  onTextComplete(): void
}

export interface MeetPlayerAudioOptions {
  player: MeetPlayerState
  bgmAudio: Ref<HTMLAudioElement | null>
  resolveBGM(name: string, context: Record<string, unknown>): string | null
  resolveBGMAsync(name: string, context: Record<string, unknown>): Promise<string | null>
  resolveSFXAsync(name: string, context: Record<string, unknown>): Promise<string | null>
}

export interface MeetPlayerAudioApi {
  currentBgmUrl: Ref<string | null>
  needsAudioUnlock: Ref<boolean>
  tryResumeAudioPlayback(): Promise<void>
  resetAudioRuntime(): void
  handleBgmInstruction(inst: MeetBgmInstruction): Promise<void>
  handleSfxInstruction(inst: MeetSfxInstruction): Promise<void>
}

export interface MeetPlayerVisualsOptions {
  player: MeetPlayerState
  meetStore: MeetStoreLike
  scheduleSave(): void
  resolveBackground(name: string, prompt: string): Promise<string | null>
  resolveCG(name: string, prompt: string, options?: Record<string, unknown>): Promise<string | null>
  pickAutoBGM(context: Record<string, unknown>): Promise<{ name?: string, url?: string } | null>
  getSpriteUrl(characterId: string, expression?: string): string | null
  ensureSprite(input: Record<string, unknown>, options?: Record<string, unknown>): Promise<string | null>
  currentBgmUrl: Ref<string | null>
}

export interface MeetPlayerVisualsApi {
  resetVisualRuntime(): void
  clearTransientSceneMedia(): void
  applySnapshotMediaInstruction(inst: MeetInstruction): boolean
  handleBgInstruction(inst: MeetBackgroundInstruction): Promise<void>
  handleCgInstruction(inst: MeetCgInstruction): Promise<void>
  handleSpriteInstruction(inst: MeetSpriteInstruction): Promise<void>
  applyAutoSceneFixups(options: {
    sawBg: boolean
    sawBgm: boolean
    sawCg: boolean
    locationChanged: boolean
    timeChanged: boolean
  }): Promise<void>
}

export interface MeetPlayerShellStoreLike extends MeetStoreLike {
  setCurrentMeeting(id: string): void
}

export interface MeetPlayerShellOptions {
  continueMeeting(): Promise<void>
  handleAdvanceTap(): void
  meeting: Ref<(MeetMeetingLike & { name?: string }) | null>
  meetingId: Ref<string>
  meetStore: MeetPlayerShellStoreLike
  player: MeetPlayerState
  restartMeetingFlow(): Promise<void>
  restoreMeetingRuntime(): void
  router: { push(path: string): unknown, replace(path: string): unknown }
  tryResumeAudioPlayback(): Promise<void> | void
}

export interface MeetPlayerMediaOptions {
  player: MeetPlayerState
  meetStore: MeetStoreLike
  scheduleSave(): void
  bgmAudio: Ref<HTMLAudioElement | null>
  resolveBackground(name: string, prompt: string): Promise<string | null>
  resolveCG(name: string, prompt: string, options?: Record<string, unknown>): Promise<string | null>
  resolveBGM(name: string, context: Record<string, unknown>): string | null
  resolveBGMAsync(name: string, context: Record<string, unknown>): Promise<string | null>
  pickAutoBGM(context: Record<string, unknown>): Promise<{ name?: string, url?: string } | null>
  resolveSFXAsync(name: string, context: Record<string, unknown>): Promise<string | null>
  getSpriteUrl(characterId: string, expression?: string): string | null
  ensureSprite(input: Record<string, unknown>, options?: Record<string, unknown>): Promise<string | null>
}
