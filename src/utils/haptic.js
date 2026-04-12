/**
 * Trigger haptic feedback via the Vibration API.
 * Falls back silently on unsupported devices.
 *
 * @param {number} [ms=10] - vibration duration in milliseconds
 */
export function haptic(ms = 10) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms)
  } catch {
    // Ignore - vibration not supported
  }
}
