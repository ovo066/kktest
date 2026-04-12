export async function imageUrlToBase64(url) {
  if (!url) return ''
  if (url.startsWith('data:')) {
    return url.split(',')[1] || ''
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch failed: HTTP ${res.status}`)
  const blob = await res.blob()

  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = String(reader.result || '')
      resolve(result.split(',')[1] || '')
    }
    reader.onerror = () => reject(new Error('Failed to convert image to base64'))
    reader.readAsDataURL(blob)
  })
}

export async function imageUrlToDataUrl(url) {
  const text = String(url || '').trim()
  if (!text) return ''
  if (text.startsWith('data:')) return text

  const res = await fetch(text)
  if (!res.ok) throw new Error(`Image fetch failed: HTTP ${res.status}`)
  const blob = await res.blob()

  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to convert image to data url'))
    reader.readAsDataURL(blob)
  })
}

export async function normalizeImageUrlForApi(url) {
  const text = String(url || '').trim()
  if (!text) return ''
  if (/^(?:https?:\/\/|data:image\/)/i.test(text)) return text
  if (/^blob:/i.test(text)) return await imageUrlToDataUrl(text)
  return ''
}
