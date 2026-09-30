import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * Translation keys the UI looks up through `errorText`. They live in the i18n
 * dictionaries, so the same failure is reported in all five languages.
 */
export const EXPORT_NO_SPACE = 'There is not enough free space to write the export file. Free some space and try again.'
export const EXPORT_WRITE_FAILED = 'The export file could not be written. Check the available storage and try again.'

const NO_SPACE = /(not enough space|no space|enospc|quota|insufficient storage|disk full|storage full|out of space)/i

/** Maps any staging failure to a message the user can act on and the app can translate. */
export function exportWriteError(error: unknown): Error {
  const text = error instanceof Error ? error.message : String(error ?? '')
  return new Error(NO_SPACE.test(text) ? EXPORT_NO_SPACE : EXPORT_WRITE_FAILED)
}

/** Best effort: a failed stage must not leave a half-written file in the cache. */
async function discardStaged(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path, directory: Directory.Cache })
  } catch {
    // The file may never have been created, or the folder may already be gone.
  }
}

/** Cache is FileProvider-accessible; never request external storage permissions. */
export async function shareFile(filename: string, content: string | Uint8Array<ArrayBuffer>, mime: string): Promise<void> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  if (Capacitor.isNativePlatform()) {
    // Separate cache folders prevent one share from overwriting another app's pending attachment.
    const path = `exports/${crypto.randomUUID()}/${safeName}`
    const { toBase64 } = await import('./backup-format')
    let uri: string
    try {
      const written = await Filesystem.writeFile({
        path, directory: Directory.Cache, recursive: true,
        data: typeof content === 'string' ? content : toBase64(content),
        ...(typeof content === 'string' ? { encoding: Encoding.UTF8 } : {}),
      })
      uri = written.uri
    } catch (error) {
      // Out of storage, a revoked directory or a failed write: report it and clean up.
      await discardStaged(path)
      throw exportWriteError(error)
    }
    // Do not delete immediately: receiving apps may read the URI after this resolves.
    await Share.share({ url: uri })
    return
  }
  let anchor: HTMLAnchorElement | null = null
  let url: string | null = null
  try {
    const blob = new Blob([content], { type: mime })
    url = URL.createObjectURL(blob)
    anchor = document.createElement('a')
    anchor.href = url
    anchor.download = safeName
    document.body.appendChild(anchor)
    anchor.click()
  } catch (error) {
    throw exportWriteError(error)
  } finally {
    anchor?.remove()
  }
  // Give the browser time to consume the download before revoking its URL.
  const objectUrl = url
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}
