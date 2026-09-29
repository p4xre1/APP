import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, ShieldAlert, X } from 'lucide-react'
import { useI18n } from '../i18n'
import { useFatorati } from '../store/useFatorati'
import { useLastBackup } from '../lib/useLastBackup'
import {
  backupReminderState, countChangesSince, loadReminderSettings, nextDismissal, saveReminderSettings,
  type ReminderSettings, type ReminderState,
} from '../lib/backup-reminder'
import type { ModuleKey } from '../store/types'

export interface BackupReminderInfo {
  loaded: boolean
  state: ReminderState
  lastBackup: number | null
  settings: ReminderSettings
  dismiss: () => Promise<void>
  refresh: () => Promise<void>
}

/** Last-backup date, change count and reminder timing, shared by the banner and Settings. */
export function useBackupReminder(): BackupReminderInfo {
  const { customers, projects, invoices, estimates, expenses, products } = useFatorati()
  const { lastBackup, loaded, now } = useLastBackup()
  const [settings, setSettings] = useState<ReminderSettings | null>(null)

  const refresh = async () => { setSettings(await loadReminderSettings()) }
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 60_000)
    window.addEventListener('fatorati:backup', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('fatorati:backup', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const active = settings || { frequency: '7' as const, dismissedUntil: 0 }
  const changes = countChangesSince(lastBackup, [
    customers, projects, invoices, estimates, expenses, products,
  ])
  const state = backupReminderState({ lastBackup, now, settings: active, changes })
  return {
    loaded, state, lastBackup, settings: active,
    dismiss: async () => { const saved = await saveReminderSettings({ dismissedUntil: nextDismissal(Date.now()) }); setSettings(saved) },
    refresh,
  }
}

/**
 * Dismissible banner: shown when the last backup is older than the chosen frequency,
 * when there is no backup yet, or when many records changed since the last backup.
 * Dismissing hides it for several days.
 */
export default function BackupReminder({ onNavigate }: { onNavigate: (key: ModuleKey) => void }) {
  const { t } = useI18n()
  const { loaded, state, dismiss } = useBackupReminder()
  if (!loaded || !state.due) return null
  const icon = state.reason === 'changes' ? AlertTriangle : state.reason === 'never' ? ShieldAlert : CalendarClock
  const Icon = icon
  const message = state.reason === 'never'
    ? t('No backup has been recorded yet. Export a backup to protect your data.')
    : state.reason === 'changes'
      ? t('{count} records changed since your last backup. Export a backup to protect your data.', { count: state.changes })
      : t('Your last backup was {count} days ago. Export a backup to protect your data.', { count: state.daysSince ?? 0 })
  return <div role="status" className="flex items-start gap-3 rounded-xl border border-warn/20 bg-warn-50 p-4 text-[13px] text-warn">
    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="font-semibold">{t('Backup reminder')}</p>
      <p className="mt-0.5">{message}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => onNavigate('settings')} className="rounded-lg bg-warn px-3 py-1.5 text-[12.5px] font-semibold text-white">{t('Back up now')}</button>
        <button onClick={() => void dismiss()} className="rounded-lg bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-warn">{t('Dismiss')}</button>
      </div>
    </div>
    <button aria-label={t('Dismiss')} onClick={() => void dismiss()} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-warn/10"><X className="h-4 w-4" /></button>
  </div>
}
