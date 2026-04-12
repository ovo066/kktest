import { ref, onMounted, onUnmounted } from 'vue'

export function useBattery() {
  const batteryPct = ref(null) // number (0-100) | null when unavailable
  const isCharging = ref(false)
  const supported = ref(false)

  let batteryManager = null

  const update = () => {
    if (!batteryManager) return
    const level = typeof batteryManager.level === 'number' ? batteryManager.level : null
    batteryPct.value = level == null ? null : Math.round(level * 100)
    isCharging.value = !!batteryManager.charging
  }

  onMounted(async () => {
    if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') return

    try {
      batteryManager = await navigator.getBattery()
      if (!batteryManager) return
      supported.value = true
      update()

      batteryManager.addEventListener?.('levelchange', update)
      batteryManager.addEventListener?.('chargingchange', update)
    } catch {
      // Battery Status API is intentionally unavailable in many browsers (e.g. iOS Safari).
    }
  })

  onUnmounted(() => {
    if (!batteryManager) return
    batteryManager.removeEventListener?.('levelchange', update)
    batteryManager.removeEventListener?.('chargingchange', update)
    batteryManager = null
  })

  return { batteryPct, isCharging, supported }
}

