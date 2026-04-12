/**
 * useBookParser — unified file parser for TXT and EPUB formats.
 * Returns structured chapter data for the reader.
 */
import { parseEpub } from '../utils/epubParser'

// Chapter title patterns for TXT files
const CHAPTER_PATTERNS = [
  /^[\s]*第[零一二三四五六七八九十百千万\d]+[章节回卷部篇集幕]/m,
  /^[\s]*Chapter\s+\d+/im,
  /^[\s]*CHAPTER\s+\d+/m,
  /^[\s]*卷[零一二三四五六七八九十百千万\d]+/m,
  /^[\s]*第[零一二三四五六七八九十百千万\d]+[章节回]\s*.{0,40}$/m
]

const COMBINED_CHAPTER_REGEX = new RegExp(
  CHAPTER_PATTERNS.map(r => r.source).join('|'),
  'gm'
)

const FALLBACK_ENCODINGS = ['gb18030', 'utf-16le', 'utf-16be', 'big5', 'shift_jis']
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g
const REPLACEMENT_CHAR_REGEX = /\uFFFD/g
const CJK_CHAR_REGEX = /[\u3400-\u9FFF]/g
const ASCII_LETTER_REGEX = /[A-Za-z]/g
const CHAPTER_HINT_REGEX = /(第[零一二三四五六七八九十百千万\d]+[章节回卷部篇集幕]|chapter\s+\d+)/i

/**
 * Parse a file into book structure.
 * @param {File} file - The file to parse
 * @returns {Promise<{ title, author, cover, format, chapters: [{ title, content }] }>}
 */
export function useBookParser() {
  async function parseFile(file) {
    const ext = getExtension(file.name)

    if (ext === 'epub') {
      return parseEpubFile(file)
    }

    // Default: treat as plain text
    return parseTxtFile(file)
  }

  async function parseEpubFile(file) {
    const buffer = await file.arrayBuffer()
    const result = await parseEpub(buffer)
    return {
      ...result,
      format: 'epub'
    }
  }

  async function parseTxtFile(file) {
    const text = await readFileAsText(file)
    const title = file.name.replace(/\.[^.]+$/, '') || '未知书名'
    const chapters = splitIntoChapters(text)

    return {
      title,
      author: '',
      cover: null,
      format: 'txt',
      chapters
    }
  }

  return { parseFile }
}

/**
 * Split text into chapters using pattern matching.
 */
function splitIntoChapters(text) {
  const matches = []
  let match

  // Find all chapter heading positions
  const regex = new RegExp(COMBINED_CHAPTER_REGEX.source, 'gm')
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      title: match[0].trim()
    })
  }

  if (matches.length === 0) {
    // No chapter headings found — split by fixed size
    return splitBySize(text, 3000)
  }

  const chapters = []

  // Content before first chapter heading
  if (matches[0].index > 200) {
    const preContent = text.slice(0, matches[0].index).trim()
    if (preContent) {
      chapters.push({ title: '序', content: preContent })
    }
  }

  // Split by chapter headings
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const chapterText = text.slice(start, end).trim()

    // Separate title from content
    const firstNewline = chapterText.indexOf('\n')
    const title = firstNewline > 0 ? chapterText.slice(0, firstNewline).trim() : matches[i].title
    const content = firstNewline > 0 ? chapterText.slice(firstNewline + 1).trim() : chapterText

    if (content) {
      chapters.push({ title, content })
    }
  }

  return chapters.length > 0 ? chapters : splitBySize(text, 3000)
}

/**
 * Fallback: split text into chunks of approximately `size` characters.
 */
function splitBySize(text, size) {
  const chapters = []
  let i = 0
  let chapterNum = 1

  while (i < text.length) {
    let end = Math.min(i + size, text.length)

    // Try to break at a paragraph boundary
    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf('\n\n', end)
      if (paragraphBreak > i + size * 0.5) {
        end = paragraphBreak + 2
      } else {
        const lineBreak = text.lastIndexOf('\n', end)
        if (lineBreak > i + size * 0.5) {
          end = lineBreak + 1
        }
      }
    }

    const content = text.slice(i, end).trim()
    if (content) {
      chapters.push({
        title: `第 ${chapterNum} 节`,
        content
      })
      chapterNum++
    }
    i = end
  }

  return chapters
}

async function readFileAsText(file) {
  const buffer = await file.arrayBuffer()
  return decodeTextBuffer(buffer)
}

function decodeTextBuffer(buffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes.length === 0) return ''

  const bomEncoding = detectEncodingFromBom(bytes)
  if (bomEncoding) {
    return normalizeDecodedText(new TextDecoder(bomEncoding).decode(buffer))
  }

  try {
    const utf8Text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return normalizeDecodedText(utf8Text)
  } catch {
    // Fall through to heuristic fallback decoding.
  }

  const candidates = []

  for (const encoding of FALLBACK_ENCODINGS) {
    try {
      const text = new TextDecoder(encoding).decode(buffer)
      candidates.push({
        text,
        score: scoreDecodedText(text)
      })
    } catch {
      // Ignore unsupported encodings and continue.
    }
  }

  if (candidates.length === 0) {
    return normalizeDecodedText(new TextDecoder('utf-8').decode(buffer))
  }

  candidates.sort((a, b) => b.score - a.score)
  return normalizeDecodedText(candidates[0].text)
}

function detectEncodingFromBom(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'utf-8'
  }
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return 'utf-16le'
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return 'utf-16be'
  }
  return null
}

function scoreDecodedText(text) {
  if (!text) return Number.NEGATIVE_INFINITY

  const sample = text.slice(0, 80000)
  const sampleLength = Math.max(sample.length, 1)

  const replacementCount = (sample.match(REPLACEMENT_CHAR_REGEX) || []).length
  const controlCount = (sample.match(CONTROL_CHAR_REGEX) || []).length
  const cjkCount = (sample.match(CJK_CHAR_REGEX) || []).length
  const asciiCount = (sample.match(ASCII_LETTER_REGEX) || []).length
  const chapterHintBonus = CHAPTER_HINT_REGEX.test(sample) ? 180 : 0

  const replacementPenalty = replacementCount * 80
  const controlPenalty = controlCount * 30
  const cjkBonus = Math.min(cjkCount, Math.floor(sampleLength * 0.35)) * 1.2
  const asciiBonus = Math.min(asciiCount, Math.floor(sampleLength * 0.4)) * 0.12

  return chapterHintBonus + cjkBonus + asciiBonus - replacementPenalty - controlPenalty
}

function normalizeDecodedText(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
}

function getExtension(filename) {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}
