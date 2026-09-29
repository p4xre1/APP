let copied: string | null = null

/** The only way the app writes to the clipboard, so locking can undo exactly that. */
export async function copyToClipboard(value: string): Promise<void> {
  await navigator.clipboard.writeText(value)
  copied = value
}

export const appCopiedClipboard = () => copied !== null

/** Cleared on lock, but only text this app put there. */
export async function clearClipboardIfOurs(): Promise<void> {
  const value = copied
  if (value === null) return
  copied = null
  try {
    if (await navigator.clipboard.readText() !== value) return
  } catch { /* Android may refuse reads; the app still owns the last value it wrote */ }
  try { await navigator.clipboard.writeText('') } catch { /* clipboard unavailable */ }
}
