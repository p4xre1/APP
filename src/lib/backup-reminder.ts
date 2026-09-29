import { Preferences } from '@capacitor/preferences'

export type ReminderFrequency = 'off' | '3' | '7' | '14' | '30'
export const reminderFrequencies: ReminderFrequency[] = ['off', '3', '7', '14', '30']
export interface ReminderSettings { frequency: ReminderFrequency; dismissedUntil: number }

export const REMINDER_KEY = 'fatorati.backupReminder.v1'
export const defaultReminderSettings: ReminderSettings = { frequency: '7', dismissedUntil: 0 }
/** How many changed records make a backup feel overdue even before the time is up. */
export const CHANGES_THRESHOLD = 25
/** A dismissed banner stays hidden for this long. */
export const SNOOZE_DAYS = 3
export const DAY = 86_400_000

export function frequencyDays(frequency: ReminderFrequency): number | null {
  return frequency === 'off' ? null : Number(frequency)
}

export function validReminderSettings(value: unknown): value is ReminderSettings {
  if (!value || typeof value !== 'object') return false
  const settings = value as ReminderSettings
  return reminderFrequencies.includes(settings.frequency)
    && Number.isFinite(settings.dismissedUntil) && settings.dismissedUntil >= 0
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  const { value } = await Preferences.get({ key: REMINDER_KEY })
  if (!value) return { ...defaultReminderSettings }
  try { const parsed: unknown = JSON.parse(value); return validReminderSettings(parsed) ? parsed : { ...defaultReminderSettings } }
  catch { return { ...defaultReminderSettings } }
}

export async function saveReminderSettings(patch: Partial<ReminderSettings>): Promise<ReminderSettings> {
  const next = { ...(await loadReminderSettings()), ...patch }
  if (!validReminderSettings(next)) throw new Error('Invalid settings')
  await Preferences.set({ key: REMINDER_KEY, value: JSON.stringify(next) })
  return next
}

export function nextDismissal(now: number, days = SNOOZE_DAYS) {
  return now + days * DAY
}

export type ReminderReason = 'never' | 'age' | 'changes' | null
export interface ReminderState {
  due: boolean
  reason: ReminderReason
  daysSince: number | null
  changes: number
  frequency: ReminderFrequency
  dismissedUntil: number
}

/** Records touched after the last successful backup handoff. */
export function countChangesSince(since: number | null, recordSets: { updatedAt: number }[][]) {
  if (since === null) return 0
  return recordSets.reduce((total, records) => total + records.filter(record => record.updatedAt > since).length, 0)
}

/**
 * Banner state: due when the last backup is older than the chosen frequency, when there
 * is no backup at all, or when many records changed since the last backup.
 * A dismissal hides it for a few days; turning the reminder off hides it for good.
 */
export function backupReminderState(options: {
  lastBackup: number | null
  now: number
  settings: ReminderSettings
  changes?: number
}): ReminderState {
  const { lastBackup, now, settings, changes = 0 } = options
  const days = frequencyDays(settings.frequency)
  const base = { daysSince: lastBackup === null ? null : Math.floor((now - lastBackup) / DAY), changes, frequency: settings.frequency, dismissedUntil: settings.dismissedUntil }
  if (days === null) return { ...base, due: false, reason: null }
  if (now < settings.dismissedUntil) return { ...base, due: false, reason: null }
  if (lastBackup === null) return { ...base, due: true, reason: 'never' }
  if (now - lastBackup >= days * DAY) return { ...base, due: true, reason: 'age' }
  if (changes >= CHANGES_THRESHOLD) return { ...base, due: true, reason: 'changes' }
  return { ...base, due: false, reason: null }
}
