import { describe, expect, it } from 'vitest'
import {
  computeFinalSaveDelay,
  getAdaptiveMinSaveIntervalMs,
  getAdaptiveSaveDelayMs,
  shouldReestimateSnapshotSize
} from './savePolicy'

describe('storage save policy', () => {
  it('returns larger save delays for larger snapshots', () => {
    expect(getAdaptiveSaveDelayMs(1)).toBe(200)
    expect(getAdaptiveSaveDelayMs(30 * 1024 * 1024)).toBe(900)
    expect(getAdaptiveSaveDelayMs(90 * 1024 * 1024)).toBe(2000)
    expect(getAdaptiveSaveDelayMs(130 * 1024 * 1024)).toBe(4500)
  })

  it('applies min save intervals only to large snapshots', () => {
    expect(getAdaptiveMinSaveIntervalMs(10)).toBe(0)
    expect(getAdaptiveMinSaveIntervalMs(90 * 1024 * 1024)).toBe(3500)
    expect(getAdaptiveMinSaveIntervalMs(130 * 1024 * 1024)).toBe(12000)
  })

  it('delays saves when the previous large save happened too recently', () => {
    const delay = computeFinalSaveDelay({
      approxBytes: 90 * 1024 * 1024,
      lastSaveFinishedAt: 1000,
      now: 2500
    })

    expect(delay).toBe(2000)
  })

  it('reduces re-estimation frequency for very large snapshots', () => {
    expect(shouldReestimateSnapshotSize({ approxBytes: 0, saveCount: 10 })).toBe(true)
    expect(shouldReestimateSnapshotSize({ approxBytes: 90 * 1024 * 1024, saveCount: 15 })).toBe(false)
    expect(shouldReestimateSnapshotSize({ approxBytes: 90 * 1024 * 1024, saveCount: 16 })).toBe(true)
    expect(shouldReestimateSnapshotSize({ approxBytes: 130 * 1024 * 1024, saveCount: 29 })).toBe(false)
    expect(shouldReestimateSnapshotSize({ approxBytes: 130 * 1024 * 1024, saveCount: 30 })).toBe(true)
  })
})
