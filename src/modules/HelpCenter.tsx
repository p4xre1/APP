import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, ClipboardCopy, Mail, Wrench } from 'lucide-react'
import { useI18n } from '../i18n'
import { supportEmail } from '../lib/appConfig'
import { appInfo, appInfoLines, copyText, problemReportHref, showsUnconfiguredSupportNotice } from '../lib/help'
import { reminderPermission, type ReminderPermission } from '../lib/notifications'
import { Capacitor } from '@capacitor/core'
import type { ModuleKey } from '../store/types'

/** Question and answer keys of the troubleshooting checklist. */
const TROUBLESHOOTING = [
  { question: 'Notifications are not arriving', answer: 'Check that notifications are allowed for Fatorati in the phone settings, remove the app from battery restrictions, then open the app once so the pending reminders are rebuilt. Reminders are not exact alarms, so Android may deliver them a few minutes late.' },
  { question: 'An exported file does not open', answer: 'Exports are staged in the cache of the app and handed to the Android share sheet. If nothing offers to open the file, save it first and open it from the Files app. If the app reported that the file could not be written, free some space and try again.' },
  { question: 'The app is locked', answer: 'The app locks when it goes to the background and after the auto-lock delay you chose. Unlock with the 6-digit PIN, or with biometrics if you enabled them. After five wrong PINs the app waits before accepting another try, and the wait grows each time.' },
  { question: 'A backup will not restore', answer: 'Check that the file is an unmodified .fatorati backup, that the password is exactly the one used when it was exported, and that the file is not larger than 25 MB. A backup written by a newer version of the app is refused; a file exported without a password carries no encryption at all.' },
] as const

const PERMISSION_KEY: Record<ReminderPermission, string> = {
  granted: 'Notification permission: allowed',
  denied: 'Notification permission: blocked',
  prompt: 'Notification permission: not asked yet',
  unsupported: 'Local notifications are available in the Android app.',
}

const row = 'flex min-h-12 items-center justify-between gap-3 rounded-lg bg-canvas px-3.5 py-2 text-start text-[13px]'
const rowLink = `${row} font-medium text-brand-700 transition-colors hover:bg-brand-50`

/**
 * Get help: everything here is bundled and offline. The screen never reads a record
 * from the vault, and the problem report carries only non-sensitive app information.
 */
export default function HelpCenter({ onBack, onNavigate }: { onBack: () => void; onNavigate: (key: ModuleKey) => void }) {
  const { t, language } = useI18n()
  const email = supportEmail()
  const info = appInfo(language)
  const [permission, setPermission] = useState<ReminderPermission>('prompt')
  const [message, setMessage] = useState('')

  useEffect(() => { void reminderPermission().then(setPermission).catch(() => setPermission('unsupported')) }, [])

  const openBackup = () => {
    onNavigate('settings')
    // Settings renders after this navigation; bring the backup card into view.
    requestAnimationFrame(() => document.getElementById('backup-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const copyInfo = async () => {
    const copied = await copyText(appInfoLines(info).join('\n'))
    setMessage(t(copied ? 'Copied to the clipboard.' : 'Could not copy. The clipboard is not available.'))
  }

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Get help')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('Offline help: the FAQ, the checklist and the legal texts are bundled in the app.')}</p>
      </div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4 directional" />{t('Back to settings')}
      </button>
    </div>

    <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[14px] font-bold text-ink">{t('FAQ')}</h2>
      <p className="mt-1 text-[13px] text-muted">{t('Searchable answers about data, backups, invoices, taxes and subscriptions.')}</p>
      <button onClick={() => onNavigate('faq')} className={`${rowLink} mt-3`}>
        <span>{t('Read the FAQ')}</span>
        <ChevronRight className="h-4 w-4 shrink-0 directional" aria-hidden="true" />
      </button>
    </div>

    <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="flex items-center gap-2 text-[14px] font-bold text-ink"><Wrench className="h-5 w-5" />{t('Troubleshooting')}</h2>
      <ul className="mt-2 divide-y divide-line">
        {TROUBLESHOOTING.map(item => <li key={item.question}>
          <details className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 text-[13.5px] font-medium text-ink">
              <span>{t(item.question)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:-rotate-90" aria-hidden="true" />
            </summary>
            <p className="pb-3 pe-3 text-[13px] leading-relaxed text-muted">{t(item.answer)}</p>
          </details>
        </li>)}
      </ul>
    </div>

    <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="flex items-center gap-2 text-[14px] font-bold text-ink"><Mail className="h-5 w-5" />{t('Contact and problem reports')}</h2>
      <div className="mt-3 space-y-2">
        {email && <a href={`mailto:${email}`} className={rowLink}>
          <span>{t('Contact support')}</span>
          <span className="truncate text-[12px] font-normal text-muted">{email}</span>
        </a>}
        <a href={problemReportHref(info, email)} className={rowLink}>
          <span>{t('Report a problem')}</span>
          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
        <button onClick={() => void copyInfo()} className={rowLink}>
          <span>{t('Copy app info')}</span>
          <ClipboardCopy className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-3 text-[12px] text-muted">{t('The message contains only the app version, the Android version, the device model and the language you are reading. Do not add invoices, customers or any other business data.')}</p>
      <dl className="mt-3 space-y-1 rounded-lg bg-canvas p-3 text-[12px] text-muted">
        {appInfoLines(info).map(line => {
          const [label, ...rest] = line.split(': ')
          return <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-medium text-ink">{rest.join(': ')}</dd></div>
        })}
      </dl>
      <p className="mt-2 text-[12px] text-muted">{t('The copied text is not secret: it contains no business data, and the clipboard is shared with other apps.')}</p>
      {/* Owner notice: hidden in every release build, where it would be noise for the user. */}
      {showsUnconfiguredSupportNotice(email) && <p role="status" className="mt-3 rounded-lg bg-warn-50 p-3 text-[12.5px] text-warn">{t('Support contact not configured yet. Set SUPPORT_EMAIL in src/lib/appConfig.ts. This notice only appears in development builds.')}</p>}
      {message && <p role="status" className="mt-2 text-[12.5px] text-ink">{message}</p>}
    </div>

    <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[14px] font-bold text-ink">{t('Do it yourself now')}</h2>
      <button onClick={openBackup} className={`${rowLink} mt-3`}>
        <span>{t('Make a backup now')}</span>
        <ChevronRight className="h-4 w-4 shrink-0 directional" aria-hidden="true" />
      </button>
      <p className="mt-2 text-[12px] text-muted">{t('Open Settings → Backup & Restore, export an encrypted backup and store it outside this phone.')}</p>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-canvas px-3.5 py-2 text-[13px]">
        <span className="text-ink">{t('Notification permission')}</span>
        <span className="text-muted">{t(PERMISSION_KEY[permission])}</span>
      </div>
      {/* The app has no shortcut into the Android settings screen, so this stays text. */}
      {permission === 'denied' && <p role="status" className="mt-2 text-[12px] text-warn">{t('Notification permission is refused. Open the phone settings and allow notifications for Fatorati.')}</p>}
      {!Capacitor.isNativePlatform() && <p className="mt-1 text-[12px] text-faint">{t('Local notifications are available in the Android app.')}</p>}
    </div>
  </div>
}
