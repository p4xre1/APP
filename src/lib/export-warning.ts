import { Preferences } from '@capacitor/preferences'
import { askWarning } from './dialogs'
import { t } from '../i18n'

/** Thrown when the one-time warning is declined, so callers stay silent. */
export const EXPORT_CANCELED = 'Export canceled'

/** Shown once before the first plaintext export, never again once dismissed. */
const WARNING_KEY = 'fatorati.exportWarning.v1'

export async function confirmPlaintextExport(): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: WARNING_KEY })
    if (value === 'off') return
  } catch { /* preference store unavailable: ask anyway */ }
  const answer = await askWarning(
    t('Exports are not encrypted'),
    t('Continue'),
    t("Don't show this again"),
  )
  if (!answer.confirmed) throw new Error(EXPORT_CANCELED)
  if (answer.dontShow) await Preferences.set({ key: WARNING_KEY, value: 'off' }).catch(() => {})
}
