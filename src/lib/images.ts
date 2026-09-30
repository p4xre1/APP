/**
 * User images (logo, stamp/signature) for documents.
 *
 * Nothing here ever fetches anything: the only source is a file the user picks.
 * Every image is decoded, downscaled to a small edge and re-encoded (PNG first,
 * JPEG as a fallback) before it is stored, so a photo from a phone camera cannot
 * bloat the encrypted vault or a backup file. The stored value is a data URL
 * inside the business record, which means it is encrypted at rest, exported in
 * encrypted backups, restored by import, and deleted by "Reset app".
 */
export const MAX_IMAGE_EDGE = 512
/** Stored size caps: the logo is shown large, a stamp can be smaller. */
export const MAX_LOGO_BYTES = 200 * 1024
export const MAX_STAMP_BYTES = 120 * 1024
/** Refused before decoding: a huge file would only waste memory on a low-end phone. */
export const MAX_SOURCE_BYTES = 8 * 1024 * 1024
/**
 * Import validation ceiling. It matches the limit the app has always stated for a
 * logo ("Max 2MB"), so backups written by earlier versions still import, while a
 * bloated or hand-edited file is refused.
 */
export const MAX_BACKUP_IMAGE_BYTES = 2 * 1024 * 1024

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'] as const

/** Errors are i18n keys, like every other error the app surfaces. */
export const IMAGE_ERRORS = {
  tooLarge: 'Image is too large. Choose a smaller file.',
  unreadable: 'This image could not be read. Try a PNG or JPG file.',
  unsupported: 'Only PNG and JPG images are supported.',
  write: 'The image could not be prepared.',
} as const

/** Payload size of a base64 data URL, i.e. the bytes the record actually holds. */
export function imageBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const payload = dataUrl.slice(comma + 1)
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
}

/** True only for a stored PNG/JPEG data URL inside the byte cap. */
export function isImageDataUrl(value: unknown, maxBytes: number): boolean {
  if (typeof value !== 'string') return false
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)) return false
  return imageBytes(value) <= maxBytes
}

/** Target edge for a downscale: never upscales, always keeps the aspect ratio. */
export function targetSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (!Number.isFinite(longest) || longest <= 0) return { width: 0, height: 0 }
  const scale = Math.min(1, maxEdge / longest)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export interface ImageCanvas {
  width: number
  height: number
  getContext(kind: '2d'): { drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void } | null
  toDataURL(type: string, quality?: number): string
}

export interface ImageIo {
  /** Decodes a picked file. */
  decode(file: Blob): Promise<{ width: number; height: number; source: CanvasImageSource }>
  /** Creates the surface the image is re-drawn on. */
  createCanvas(): ImageCanvas
}

export const browserImageIo: ImageIo = {
  async decode(file) {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file)
      return { width: bitmap.width, height: bitmap.height, source: bitmap }
    }
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      return { width: image.naturalWidth, height: image.naturalHeight, source: image }
    } finally { URL.revokeObjectURL(url) }
  },
  createCanvas: () => document.createElement('canvas') as unknown as ImageCanvas,
}

/**
 * Reads a picked image into a stored data URL: downscaled, re-encoded, and always
 * inside `maxBytes`. PNG keeps transparency; JPEG is the fallback for photos.
 */
export async function readImageFile(file: File, maxBytes: number, io: ImageIo = browserImageIo): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) throw new Error(IMAGE_ERRORS.tooLarge)
  if (file.type && !(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) throw new Error(IMAGE_ERRORS.unsupported)
  let decoded: { width: number; height: number; source: CanvasImageSource }
  try { decoded = await io.decode(file) }
  catch { throw new Error(IMAGE_ERRORS.unreadable) }
  if (!decoded.width || !decoded.height) throw new Error(IMAGE_ERRORS.unreadable)

  const size = targetSize(decoded.width, decoded.height)
  const canvas = io.createCanvas()
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error(IMAGE_ERRORS.write)
  context.drawImage(decoded.source, 0, 0, size.width, size.height)

  const png = canvas.toDataURL('image/png')
  if (imageBytes(png) <= maxBytes) return png
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const jpeg = canvas.toDataURL('image/jpeg', quality)
    if (imageBytes(jpeg) <= maxBytes) return jpeg
  }
  throw new Error(IMAGE_ERRORS.tooLarge)
}

/** Stored image of a business record, or undefined when it is missing/invalid. */
export function storedImage(value: unknown, maxBytes: number): string | undefined {
  return isImageDataUrl(value, maxBytes) ? value as string : undefined
}
