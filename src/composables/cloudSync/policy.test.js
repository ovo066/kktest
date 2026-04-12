import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CLOUD_SYNC_AUTO_SYNC_POLICY,
  getCloudSyncAutoSyncPolicy,
  normalizeCloudSyncAutoSyncPolicy,
  shouldDeferAutoUpload
} from './policy'

describe('cloudSync policy', () => {
  it('normalizes unknown policies to the default preset', () => {
    expect(normalizeCloudSyncAutoSyncPolicy('unknown')).toBe(DEFAULT_CLOUD_SYNC_AUTO_SYNC_POLICY)
    expect(getCloudSyncAutoSyncPolicy('')).toMatchObject({ key: DEFAULT_CLOUD_SYNC_AUTO_SYNC_POLICY })
  })

  it('resolves custom policies with persisted thresholds', () => {
    expect(getCloudSyncAutoSyncPolicy('custom', {
      minDeltaBytes: 3 * 1024 * 1024,
      minIntervalMs: 2 * 60 * 60 * 1000
    })).toMatchObject({
      key: 'custom',
      minDeltaBytes: 3 * 1024 * 1024,
      minIntervalMs: 2 * 60 * 60 * 1000
    })
  })

  it('defers small auto uploads according to the selected preset', () => {
    expect(shouldDeferAutoUpload({
      reason: 'auto',
      policy: 'economy',
      backupSize: 900 * 1024,
      lastUploadedSize: 800 * 1024,
      lastUploadedAtMs: 1_000,
      now: 10 * 60 * 1000
    })).toBe(true)

    expect(shouldDeferAutoUpload({
      reason: 'auto',
      policy: 'instant',
      backupSize: 900 * 1024,
      lastUploadedSize: 800 * 1024,
      lastUploadedAtMs: 1_000,
      now: 10 * 60 * 1000
    })).toBe(false)
  })

  it('defers large auto uploads until the cooldown interval has elapsed', () => {
    expect(shouldDeferAutoUpload({
      reason: 'auto',
      policy: 'balanced',
      backupSize: 3 * 1024 * 1024,
      lastUploadedSize: 256 * 1024,
      lastUploadedAtMs: 1_000,
      now: 10 * 60 * 1000
    })).toBe(true)
  })

  it('still defers auto uploads after cooldown when the delta is too small', () => {
    expect(shouldDeferAutoUpload({
      reason: 'auto',
      policy: 'economy',
      backupSize: 900 * 1024,
      lastUploadedSize: 850 * 1024,
      lastUploadedAtMs: 1_000,
      now: (2 * 60 * 60 * 1000) + 1_000
    })).toBe(true)
  })

  it('uses custom cooldown and delta thresholds for auto uploads', () => {
    expect(shouldDeferAutoUpload({
      reason: 'auto',
      policy: 'custom',
      customPolicy: {
        minDeltaBytes: 3 * 1024 * 1024,
        minIntervalMs: 2 * 60 * 60 * 1000
      },
      backupSize: 5 * 1024 * 1024,
      lastUploadedSize: 1 * 1024 * 1024,
      lastUploadedAtMs: 1_000,
      now: 60 * 60 * 1000
    })).toBe(true)

    expect(shouldDeferAutoUpload({
      reason: 'auto',
      policy: 'custom',
      customPolicy: {
        minDeltaBytes: 3 * 1024 * 1024,
        minIntervalMs: 2 * 60 * 60 * 1000
      },
      backupSize: 5 * 1024 * 1024,
      lastUploadedSize: 3 * 1024 * 1024,
      lastUploadedAtMs: 1_000,
      now: (3 * 60 * 60 * 1000) + 1_000
    })).toBe(true)

    expect(shouldDeferAutoUpload({
      reason: 'auto',
      policy: 'custom',
      customPolicy: {
        minDeltaBytes: 3 * 1024 * 1024,
        minIntervalMs: 2 * 60 * 60 * 1000
      },
      backupSize: 5 * 1024 * 1024,
      lastUploadedSize: 1 * 1024 * 1024,
      lastUploadedAtMs: 1_000,
      now: (3 * 60 * 60 * 1000) + 1_000
    })).toBe(false)
  })

  it('never defers manual uploads', () => {
    expect(shouldDeferAutoUpload({
      reason: 'manual',
      policy: 'economy',
      backupSize: 900 * 1024,
      lastUploadedSize: 900 * 1024,
      lastUploadedAtMs: 1_000,
      now: 2_000
    })).toBe(false)
  })
})
