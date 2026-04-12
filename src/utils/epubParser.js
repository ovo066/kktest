/**
 * EPUB parser — extracts metadata + chapters from .epub files.
 * Uses JSZip for decompression and DOMParser for XHTML parsing.
 */
import JSZip from 'jszip'

/**
 * Parse an EPUB file (ArrayBuffer) into structured book data.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{ title, author, cover, chapters: [{ title, content }] }>}
 */
export async function parseEpub(buffer) {
  const zip = await JSZip.loadAsync(buffer)

  // 1. Find OPF file path from container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('text')
  if (!containerXml) throw new Error('Invalid EPUB: missing container.xml')

  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml')
  const rootfilePath = containerDoc.querySelector('rootfile')?.getAttribute('full-path')
  if (!rootfilePath) throw new Error('Invalid EPUB: no rootfile')

  // 2. Parse OPF
  const opfText = await zip.file(rootfilePath)?.async('text')
  if (!opfText) throw new Error('Invalid EPUB: cannot read OPF')

  const opfDoc = new DOMParser().parseFromString(opfText, 'application/xml')
  const opfDir = rootfilePath.includes('/') ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1) : ''

  // 3. Extract metadata
  const title = getTextContent(opfDoc, 'dc\\:title, title') || 'Untitled'
  const author = getTextContent(opfDoc, 'dc\\:creator, creator') || ''

  // 4. Build manifest map (id → href)
  const manifest = {}
  opfDoc.querySelectorAll('manifest > item').forEach(item => {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    const mediaType = item.getAttribute('media-type') || ''
    if (id && href) {
      manifest[id] = { href: opfDir + href, mediaType }
    }
  })

  // 5. Get spine order
  const spineItemRefs = Array.from(opfDoc.querySelectorAll('spine > itemref'))
  const spineIds = spineItemRefs.map(el => el.getAttribute('idref')).filter(Boolean)

  // 6. Try to get cover image
  let cover = null
  const coverMeta = opfDoc.querySelector('meta[name="cover"]')
  const coverId = coverMeta?.getAttribute('content')
  if (coverId && manifest[coverId]) {
    const coverEntry = manifest[coverId]
    if (coverEntry.mediaType.startsWith('image/')) {
      try {
        const coverBlob = await zip.file(coverEntry.href)?.async('blob')
        if (coverBlob) {
          cover = await blobToDataUrl(coverBlob)
        }
      } catch { /* ignore cover errors */ }
    }
  }

  // 7. Parse chapters from spine
  const chapters = []
  // Also try to get NCX/nav TOC for chapter titles
  const tocTitles = await extractTocTitles(zip, opfDoc, manifest, opfDir)

  for (let i = 0; i < spineIds.length; i++) {
    const idref = spineIds[i]
    const item = manifest[idref]
    if (!item) continue

    try {
      const xhtml = await zip.file(item.href)?.async('text')
      if (!xhtml) continue

      const doc = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml')
      const body = doc.querySelector('body')
      if (!body) continue

      const text = cleanHtmlToText(body)
      if (!text.trim()) continue

      // Try to find chapter title from TOC or from content
      const tocTitle = tocTitles.get(item.href) || tocTitles.get(item.href.replace(opfDir, ''))
      const extractedTitle = tocTitle || extractTitleFromContent(doc) || `Chapter ${i + 1}`

      chapters.push({
        title: extractedTitle,
        content: text.trim()
      })
    } catch {
      // Skip malformed chapters
    }
  }

  // Merge very short chapters (< 100 chars) into adjacent ones
  const merged = mergeShortChapters(chapters, 100)

  return { title, author, cover, chapters: merged }
}

function getTextContent(doc, selector) {
  const el = doc.querySelector(selector)
  return el?.textContent?.trim() || ''
}

async function extractTocTitles(zip, opfDoc, manifest, opfDir) {
  const titles = new Map()

  // Try NCX
  const ncxItem = Object.values(manifest).find(m => m.mediaType === 'application/x-dtbncx+xml')
  if (ncxItem) {
    try {
      const ncxText = await zip.file(ncxItem.href)?.async('text')
      if (ncxText) {
        const ncxDoc = new DOMParser().parseFromString(ncxText, 'application/xml')
        ncxDoc.querySelectorAll('navPoint').forEach(np => {
          const label = np.querySelector('navLabel > text')?.textContent?.trim()
          const src = np.querySelector('content')?.getAttribute('src')
          if (label && src) {
            // Normalize the href (strip fragment)
            const href = opfDir + src.split('#')[0]
            if (!titles.has(href)) {
              titles.set(href, label)
            }
          }
        })
      }
    } catch { /* ignore */ }
  }

  // Try nav (EPUB3)
  const navItem = Object.values(manifest).find(m =>
    m.mediaType === 'application/xhtml+xml' &&
    m.href && m.href.includes('nav')
  )
  if (navItem && titles.size === 0) {
    try {
      const navText = await zip.file(navItem.href)?.async('text')
      if (navText) {
        const navDoc = new DOMParser().parseFromString(navText, 'application/xhtml+xml')
        navDoc.querySelectorAll('nav[*|type="toc"] a, nav.toc a').forEach(a => {
          const label = a.textContent?.trim()
          const href = a.getAttribute('href')
          if (label && href) {
            const fullHref = opfDir + href.split('#')[0]
            if (!titles.has(fullHref)) {
              titles.set(fullHref, label)
            }
          }
        })
      }
    } catch { /* ignore */ }
  }

  return titles
}

function extractTitleFromContent(doc) {
  // Look for h1, h2, h3, or title-like elements
  for (const tag of ['h1', 'h2', 'h3', '.title', '.chapter-title']) {
    const el = doc.querySelector(tag)
    if (el?.textContent?.trim()) {
      const text = el.textContent.trim()
      if (text.length < 100) return text
    }
  }
  return null
}

function cleanHtmlToText(el) {
  // Convert HTML to readable text, preserving paragraph breaks
  const blocks = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br', 'hr']
  let result = ''

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const tag = node.tagName?.toLowerCase() || ''
    // Skip scripts, styles, and images
    if (['script', 'style', 'img', 'svg'].includes(tag)) return

    const isBlock = blocks.includes(tag)
    if (isBlock && result && !result.endsWith('\n')) {
      result += '\n'
    }

    if (tag === 'br') {
      result += '\n'
      return
    }

    for (const child of node.childNodes) {
      walk(child)
    }

    if (isBlock && !result.endsWith('\n')) {
      result += '\n'
    }
  }

  walk(el)

  // Clean up excessive newlines
  return result.replace(/\n{3,}/g, '\n\n').trim()
}

function mergeShortChapters(chapters, minLength) {
  if (chapters.length <= 1) return chapters
  const result = []

  for (const ch of chapters) {
    if (result.length > 0 && result[result.length - 1].content.length < minLength) {
      // Merge into previous
      result[result.length - 1].content += '\n\n' + ch.content
    } else {
      result.push({ ...ch })
    }
  }

  return result
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
