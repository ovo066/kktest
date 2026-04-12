import { describe, expect, it } from 'vitest'
import {
  createDefaultCloudSyncSettings,
  createDefaultGeneralSettings,
  createDefaultLivenessSettings,
  createDefaultSettingsSnapshot,
  createDefaultThemeSettings,
  createDefaultToolCallingSettings,
  createDefaultVoiceSettings
} from './settingsDefaults'
import {
  CLOUD_SYNC_SETTINGS_STATE_FIELDS,
  GENERAL_SETTINGS_STATE_FIELDS,
  LIVENESS_SETTINGS_STATE_FIELDS,
  SETTINGS_SNAPSHOT_FIELD_KEYS,
  STORAGE_SETTINGS_PROXY_FIELDS,
  THEME_SETTINGS_STATE_FIELDS,
  TOOL_CALLING_SETTINGS_STATE_FIELDS,
  VOICE_SETTINGS_STATE_FIELDS
} from './settingsSchema'

function sortKeys(keys) {
  return [...keys].sort()
}

const SEPARATE_SETTINGS_OBJECT_FIELDS = [
  'voiceTtsConfig',
  'livenessConfig',
  'cloudSyncConfig',
  'toolCallingConfig'
]

describe('settings schema governance', () => {
  it('keeps store field lists aligned with default setting factories', () => {
    expect(sortKeys(THEME_SETTINGS_STATE_FIELDS)).toEqual(sortKeys(Object.keys(createDefaultThemeSettings())))
    expect(sortKeys(GENERAL_SETTINGS_STATE_FIELDS)).toEqual(sortKeys(Object.keys(createDefaultGeneralSettings())))
    expect(sortKeys(VOICE_SETTINGS_STATE_FIELDS)).toEqual(sortKeys(Object.keys(createDefaultVoiceSettings())))
    expect(sortKeys(LIVENESS_SETTINGS_STATE_FIELDS)).toEqual(sortKeys(Object.keys(createDefaultLivenessSettings())))
    expect(sortKeys(CLOUD_SYNC_SETTINGS_STATE_FIELDS)).toEqual(sortKeys(Object.keys(createDefaultCloudSyncSettings())))
    expect(sortKeys(TOOL_CALLING_SETTINGS_STATE_FIELDS)).toEqual(sortKeys(Object.keys(createDefaultToolCallingSettings())))
  })

  it('keeps persisted settings coverage aligned with the snapshot shape', () => {
    expect(sortKeys([
      ...SETTINGS_SNAPSHOT_FIELD_KEYS,
      ...SEPARATE_SETTINGS_OBJECT_FIELDS
    ])).toEqual(sortKeys(Object.keys(createDefaultSettingsSnapshot())))
  })

  it('includes every persisted settings field in the storage adapter proxy list', () => {
    SETTINGS_SNAPSHOT_FIELD_KEYS.forEach((key) => {
      expect(STORAGE_SETTINGS_PROXY_FIELDS).toContain(key)
    })
  })
})
