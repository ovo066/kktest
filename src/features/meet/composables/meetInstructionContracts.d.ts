export interface MeetCharacterRef {
  contactId: string
  vnName: string
  role?: string
  nameColor?: string
  [key: string]: unknown
}

export interface MeetChoiceOption {
  text: string
  effect: string | null
}

export interface MeetLocationInstruction {
  type: 'location'
  value: string
}

export interface MeetTimeInstruction {
  type: 'time'
  value: string
}

export interface MeetMoodInstruction {
  type: 'mood'
  characterName: string
  operation: 'set' | 'add'
  value: string | number
}

export interface MeetVariableInstruction {
  type: 'variable'
  key: string
  operation: 'set' | 'add'
  value: string | number | boolean
}

export interface MeetBackgroundInstruction {
  type: 'bg'
  name: string
  isNew: boolean
  prompt: string | null
  transition: string
}

export interface MeetCgInstruction {
  type: 'cg'
  name: string | null
  off: boolean
  isNew: boolean
  prompt: string | null
}

export interface MeetSpriteInstruction {
  type: 'sprite'
  characterId: string
  vnName: string
  position: string
  expression: string
  isNew: boolean
  prompt: string | null
  animation: string | null
}

export interface MeetBgmInstruction {
  type: 'bgm'
  name: string | null
}

export interface MeetSfxInstruction {
  type: 'sfx'
  name: string | null
}

export interface MeetDialogInstruction {
  type: 'dialog'
  characterId: string
  vnName: string
  text: string
  nameColor?: string
}

export interface MeetNarrationInstruction {
  type: 'narration'
  text: string
}

export interface MeetChoicesInstruction {
  type: 'choices'
  options: MeetChoiceOption[]
}

export type MeetInstruction =
  | MeetLocationInstruction
  | MeetTimeInstruction
  | MeetMoodInstruction
  | MeetVariableInstruction
  | MeetBackgroundInstruction
  | MeetCgInstruction
  | MeetSpriteInstruction
  | MeetBgmInstruction
  | MeetSfxInstruction
  | MeetDialogInstruction
  | MeetNarrationInstruction
  | MeetChoicesInstruction

export interface MeetParserOptions {
  characters?: MeetCharacterRef[]
}

export interface MeetNewResourceSummary {
  backgrounds: Array<{
    name: string
    prompt: string
  }>
  sprites: Array<{
    characterId: string
    vnName: string
    expression: string
    prompt: string
  }>
}

export interface MeetApiResult {
  success: boolean
  instructions?: MeetInstruction[]
  error?: string
  code?: string
  context?: Record<string, unknown>
  retryable?: boolean
  traceId?: string
}

export type MeetApiMessageRole = 'system' | 'user' | 'assistant'

export interface MeetApiMessage {
  role: MeetApiMessageRole
  content: string
}
