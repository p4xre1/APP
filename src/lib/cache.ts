import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

/** Exports are staged in Cache/<EXPORT_DIR> before they are handed to the share sheet. */
export const EXPORT_DIR = 'exports'

/** Removes every cached export; called on lock and on app start. */
export async function clearExportCache(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try { await Filesystem.rmdir({ path: EXPORT_DIR, directory: Directory.Cache, recursive: true }) } catch { /* nothing cached */ }
}
