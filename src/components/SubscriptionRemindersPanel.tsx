import { useEffect, useState } from 'react'
import { BellRing, BellOff } from 'lucide-react'
import { showAlert } from '../lib/dialogs'
import { useI18n, errorText } from '../i18n'
import { useFatorati } from '../store/useFatorati'
import { requestReminderPermission, reminderPermission, reminderSettings, nextReminderPreview, type ReminderPermission } from '../lib/notifications'
import { MAX_WARN_DAYS, MIN_WARN_DAYS } from '../lib/subscriptions'
import { Capacitor } from '@capacitor/core'

/**
 * Reminder settings. The notification permission is requested here, at the
 * moment the user turns reminders on, never at app start.
 */
export default function SubscriptionRemindersPanel() {
  const { t } = useI18n()
  const { settings, subscriptions, updateSettings } = useFatorati()
  const config = reminderSettings(settings)
  const [permission, setPermission] = useState<ReminderPermission>('prompt')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'
  const label = 'block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]'
  const preview = nextReminderPreview(subscriptions, config)

  useEffect(() => { void reminderPermission().then(setPermission).catch(() => setPermission('unsupported')) }, [])

  async function toggle(next: boolean) {
    setBusy(true); setMessage('')
    try {
      if (next) {
        const result = await requestReminderPermission()
        setPermission(result)
        if (result === 'denied') {
          setMessage(t('Notifications are blocked on this phone. The in-app banner still lists what is expiring.'))
          await updateSettings({ subscriptionReminders: true })
          return
        }
        if (result === 'unsupported') {
          setMessage(t('This platform has no local notifications. The in-app banner still lists what is expiring.'))
        }
      }
      await updateSettings({ subscriptionReminders: next })
      setMessage(t('Saved'))
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  return (
    <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
        {config.enabled ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}{t('Subscription reminders')}</h2>
      <div className="space-y-3.5">
        <p className="text-[12px] text-muted">{t('Reminders are scheduled on this phone only, at 09:00 local time. No exact alarms, no internet.')}</p>
        <label className="flex min-h-12 items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" checked={config.enabled} disabled={busy} onChange={e => void toggle(e.target.checked)} />
          {t('Remind me before a renewal')}
        </label>
        <div>
          <label className={label}>{t('Days before')}</label>
          <select aria-label={t('Days before')} disabled={busy || !config.enabled} value={config.warn} onChange={e => void updateSettings({ subscriptionWarnDays: Number(e.target.value) }).catch(error => void showAlert(errorText(error)))} className={inputClass}>
            {Array.from({ length: MAX_WARN_DAYS - MIN_WARN_DAYS + 1 }, (_, index) => MIN_WARN_DAYS + index).map(days => <option key={days} value={days}>{days}</option>)}
          </select>
        </div>
        <label className="flex min-h-12 items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" disabled={busy || !config.enabled} checked={config.dayOfReminder} onChange={e => void updateSettings({ subscriptionDayOfReminder: e.target.checked }).catch(error => void showAlert(errorText(error)))} />
          {t('Also remind me on the day')}
        </label>
        <label className="flex min-h-12 items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" disabled={busy} checked={config.hideNames} onChange={e => void updateSettings({ subscriptionHideNames: e.target.checked }).catch(error => void showAlert(errorText(error)))} />
          {t('Hide service names in notifications')}
        </label>
        <p className="text-[12px] text-muted">{t('A hidden reminder only says: A subscription needs your attention.')}</p>
        {preview && <p className="text-[12px] text-muted">{t('Next reminder')}: {preview.date}</p>}
        {config.enabled && permission === 'denied' && <p role="status" className="text-[12px] text-warn">{t('Notification permission is refused. Open the phone settings and allow notifications for Fatorati.')}</p>}
        {message && <p role="status" className="text-[12.5px] text-ink">{message}</p>}
        <p className="text-[12px] text-muted">{t('Some Android vendors delay or block notifications when battery optimization is on. The in-app banner does not depend on them.')}</p>
        {!Capacitor.isNativePlatform() && <p className="text-[12px] text-faint">{t('Local notifications are available in the Android app.')}</p>}
      </div>
    </div>
  )
}
