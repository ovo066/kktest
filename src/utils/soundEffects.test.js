import { describe, expect, it } from 'vitest'
import {
  createDefaultSoundConfig,
  findCustomSoundById,
  getBuiltinSoundOptions,
  isBuiltinSoundId,
  normalizeSoundConfig,
  normalizeKitId,
  getKitDefinitions
} from './soundEffects'

describe('soundEffects config', () => {
  it('creates isolated default configs', () => {
    const first = createDefaultSoundConfig()
    const second = createDefaultSoundConfig()

    first.customSounds.push({
      id: 'custom_ping',
      name: 'Ping',
      source: 'data:audio/wav;base64,AAAA'
    })

    expect(second.customSounds).toEqual([])
  })

  it('default config includes kit field', () => {
    const config = createDefaultSoundConfig()
    expect(config.kit).toBe('snd01')
    expect(config.events.messageSend.soundId).toBe('tap_01')
    expect(config.events.messageReceive.soundId).toBe('notification')
  })

  it('normalizes sound config and falls back missing sound ids', () => {
    const normalized = normalizeSoundConfig({
      enabled: true,
      volume: 1.8,
      customSounds: [
        { id: 'custom_ping', name: 'Ping', source: 'data:audio/wav;base64,AAAA', size: 128 },
        { id: 'broken', name: 'Broken', source: 'blob:test-sound' }
      ],
      events: {
        notification: {
          enabled: true,
          soundId: 'custom_ping'
        },
        messageReceive: {
          enabled: true,
          soundId: 'missing'
        }
      }
    })

    expect(normalized.enabled).toBe(true)
    expect(normalized.volume).toBe(1)
    expect(normalized.kit).toBe('snd01')
    expect(normalized.customSounds).toHaveLength(1)
    expect(normalized.events.notification.soundId).toBe('custom_ping')
    expect(normalized.events.messageReceive.soundId).toBe('notification')
  })

  it('migrates legacy builtin: sound IDs', () => {
    const normalized = normalizeSoundConfig({
      events: {
        messageSend: { enabled: true, soundId: 'builtin:send-soft' },
        messageReceive: { enabled: true, soundId: 'builtin:bubble' },
        notification: { enabled: true, soundId: 'builtin:soft-bell' },
        typing: { enabled: false, soundId: 'builtin:typing' },
        readReceipt: { enabled: false, soundId: 'builtin:glint' }
      }
    })

    expect(normalized.events.messageSend.soundId).toBe('tap_01')
    expect(normalized.events.messageReceive.soundId).toBe('notification')
    expect(normalized.events.notification.soundId).toBe('notification')
    expect(normalized.events.typing.soundId).toBe('type_01')
    expect(normalized.events.readReceipt.soundId).toBe('toggle_on')
  })

  it('resolves builtin and custom sound options', () => {
    const builtinOptions = getBuiltinSoundOptions()
    expect(builtinOptions.length).toBeGreaterThan(0)
    expect(builtinOptions[0].builtin).toBe(true)
    expect(isBuiltinSoundId(builtinOptions[0].id)).toBe(true)

    const custom = { id: 'custom_ping', name: 'Ping', source: 'data:audio/wav;base64,AAAA', size: 128 }
    expect(findCustomSoundById('custom_ping', [custom])?.name).toBe('Ping')
    expect(findCustomSoundById('nonexistent', [custom])).toBeNull()
  })

  it('normalizes kit id', () => {
    expect(normalizeKitId('snd01')).toBe('snd01')
    expect(normalizeKitId('snd02')).toBe('snd02')
    expect(normalizeKitId('snd03')).toBe('snd03')
    expect(normalizeKitId('invalid')).toBe('snd01')
    expect(normalizeKitId('')).toBe('snd01')
  })

  it('has at least 3 kit definitions', () => {
    expect(getKitDefinitions().length).toBeGreaterThanOrEqual(3)
  })
})
