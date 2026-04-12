/**
 * 图片处理相关的组合式函数
 */

/**
 * 压缩图片到指定宽度
 * @param {File} file - 图片文件
 * @param {number} maxWidth - 最大宽度
 * @param {number} quality - JPEG 质量 (0-1)，默认 0.8
 * @returns {Promise<string>} Base64 编码的图片
 */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result || '')
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }
      reject(new Error('Failed to encode image blob'))
    }, type, quality)
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error || new Error('Failed to read encoded blob'))
    reader.readAsDataURL(blob)
  })
}

export async function compressImageBlob(file, maxWidth, quality = 0.8, mimeType = 'image/webp') {
  const source = await readFileAsDataUrl(file)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = async () => {
      try {
        const safeMaxWidth = Math.max(1, Number(maxWidth) || img.width || 1)
        const width = img.width > safeMaxWidth ? safeMaxWidth : img.width
        const scale = img.width > 0 ? width / img.width : 1
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context unavailable')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        let blob = null
        try {
          blob = await canvasToBlob(canvas, mimeType, quality)
        } catch {
          blob = null
        }
        if (!blob || !blob.size) {
          blob = await canvasToBlob(canvas, 'image/jpeg', quality)
        }
        resolve(blob)
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = source
  })
}

export function compressImage(file, maxWidth, quality = 0.8) {
  return compressImageBlob(file, maxWidth, quality, 'image/jpeg').then(blobToDataUrl)
}

/**
 * 图片处理 composable
 */
export function useImage() {
  return {
    compressImage,
    compressImageBlob
  }
}
