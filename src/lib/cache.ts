import { Directory, Filesystem } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'

/** Exports are staged in Cache/<EXPORT_DIR>/<share id>/ before the share sheet reads them. */
export const EXPORT_DIR = 'exports'

/**
 * Deletes every staged export. Plaintext CSV/PDF/backup files are business data
 * too, so they are removed at app start and after each unlock instead of being
 * left in the cache until the app is uninstalled.
 *
 * Nothing here runs while the app is locked, so a share sheet that is still
 * reading a URI it was handed keeps working.
 */
export async function clearExportCache(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0
  try {
    const { files } = await Filesystem.readdir({ path: EXPORT_DIR, directory: Directory.Cache })
    const folders = files.filter(entry => entry.type === 'directory').length
    if (files.length) await Filesystem.rmdir({ path: EXPORT_DIR, directory: Directory.Cache, recursive: true })
    return folders
  } catch {
    return 0 // Nothing staged, or the platform refused the read.
  }
}

/** Number of staged export folders; used by the Settings cleanup action. */
export async function exportCacheCount(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0
  try {
    const { files } = await Filesystem.readdir({ path: EXPORT_DIR, directory: Directory.Cache })
    return files.filter(entry => entry.type === 'directory').length
  } catch {
    return 0
  }
}
