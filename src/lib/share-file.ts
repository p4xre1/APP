import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/** Cache is FileProvider-accessible; never request external storage permissions. */
export async function shareFile(filename: string, content: string | Uint8Array<ArrayBuffer>, mime: string): Promise<void> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  if (Capacitor.isNativePlatform()) {
    // Separate cache folders prevent one share from overwriting another app's pending attachment.
    const path = `exports/${crypto.randomUUID()}/${safeName}`
    const { toBase64 } = await import('./backup-format')
    const { uri } = await Filesystem.writeFile({
      path, directory: Directory.Cache, recursive: true,
      data: typeof content === 'string' ? content : toBase64(content),
      ...(typeof content === 'string' ? { encoding: Encoding.UTF8 } : {}),
    })
    // Do not delete immediately: receiving apps may read the URI after this resolves.
    await Share.share({ url: uri })
    return
  }
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser time to consume the download before revoking its URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
