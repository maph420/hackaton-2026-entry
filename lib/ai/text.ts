import 'server-only'
import { extractText, getDocumentProxy } from 'unpdf'
import { transcribeImage } from '@/lib/ai/ocr'

export const MAX_FILE_BYTES = 8 * 1024 * 1024

const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.csv', '.tex']

export type ParsedDocument = {
  text: string
  /** Text of each page (index 0 is page 1); null when the format has no pagination. */
  pages: string[] | null
}

export async function extractPdfPages(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes)
  const { text } = await extractText(pdf, { mergePages: false })
  return text.map(normalize)
}

/** Keeps whole pages from the start until the character budget is reached. */
export function truncatePages(pages: string[], maxChars: number): string[] {
  const kept: string[] = []
  let total = 0
  for (const page of pages) {
    if (kept.length > 0 && total + page.length > maxChars) break
    kept.push(page)
    total += page.length
  }
  return kept
}

export async function extractDocumentFromFile(file: File): Promise<ParsedDocument> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('El archivo supera el límite de 8 MB.')
  }

  const name = file.name.toLowerCase()

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pages = await extractPdfPages(new Uint8Array(await file.arrayBuffer()))
    return { text: pages.join('\n\n').trim(), pages }
  }

  if (file.type.startsWith('text/') || TEXT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return { text: normalize(await file.text()), pages: null }
  }

  const imageType = imageMimeType(file)
  if (imageType) {
    const text = await transcribeImage(new Uint8Array(await file.arrayBuffer()), imageType)
    return { text: normalize(text), pages: null }
  }

  throw new Error('Formato no soportado todavía. Subí un PDF, una imagen o un archivo de texto.')
}

const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/** Returns the image media type of a supported upload, or null when it is not an image. */
export function imageMimeType(file: File): string | null {
  if (Object.values(IMAGE_TYPES).includes(file.type)) return file.type
  const name = file.name.toLowerCase()
  const extension = Object.keys(IMAGE_TYPES).find((ext) => name.endsWith(ext))
  return extension ? IMAGE_TYPES[extension] : null
}

export async function extractTextFromFile(file: File): Promise<string> {
  return (await extractDocumentFromFile(file)).text
}

export type PageChunk = { content: string; page: number | null }

/** Chunks every page on its own so each fragment maps to an exact page. */
export function chunkPages(pages: string[]): PageChunk[] {
  return pages.flatMap((text, index) =>
    chunkText(text).map((content) => ({ content, page: index + 1 })),
  )
}

function normalize(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function chunkText(text: string, maxChars = 1000, overlap = 150): string[] {
  const paragraphs = normalize(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''

  const flush = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      flush()
      for (let start = 0; start < paragraph.length; start += maxChars - overlap) {
        chunks.push(paragraph.slice(start, start + maxChars).trim())
      }
      continue
    }
    if (current.length + paragraph.length + 2 > maxChars) {
      const tail = current.slice(-overlap)
      flush()
      current = tail ? `${tail}\n\n${paragraph}` : paragraph
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph
    }
  }
  flush()

  return chunks.filter((chunk) => chunk.length > 20)
}
