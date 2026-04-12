const DEFAULT_REVOKE_DELAY_MS = 60 * 1000

export function downloadBlob(blob, filename, options = {}) {
  if (!(blob instanceof Blob)) {
    throw new TypeError('downloadBlob expects a Blob')
  }

  const revokeDelayMs = Number.isFinite(Number(options.revokeDelayMs))
    ? Math.max(1000, Math.round(Number(options.revokeDelayMs)))
    : DEFAULT_REVOKE_DELAY_MS

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = String(filename || 'download')
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body?.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // Ignore revoke failures for completed downloads.
    }
  }, revokeDelayMs)

  return url
}
