/**
 * Fatorati Offline - subscription reminders
 *
 * Local notifications only: nothing here talks to a server, and the app still
 * ships without the INTERNET permission. Reminders are deliberately inexact
 * (`isExactNotification: false`) and the merged manifest removes
 * SCHEDULE_EXACT_ALARM, so no exact-alarm permission is ever requested.
 */

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { t } from '../i18n'
import { formatDate } from './format'
import { getPreferences, type Language } from './preferences'
import type { Note, Settings, Subscription } from '../store/types'
import { DEFAULT_WARN_DAYS, dayNumber, subscribeEndOrRenewal, todayISO, warnDays as clampWarnDays } from './subscriptions'
import { noteReminderAt, noteTitle } from './notes'

/** Reminders land at 09:00 local time; a fixed hour survives DST shifts. */
export const REMINDER_HOUR = 9
export const REMINDER_CHANNEL = 'subscriptions'
export const MAX_REMINDERS = 200

export const HIDDEN_TITLE = 'Subscription reminder'
export const HIDDEN_BODY = 'A subscription needs your attention'
export const HIDDEN_NOTE_TITLE = 'Note reminder'
export const HIDDEN_NOTE_BODY = 'A note needs your attention'
/** Notes with a reminder use their own channel, so the two can be told apart. */
export const NOTE_REMINDER_CHANNEL = 'notes'
/**
 * Android keeps a limited number of pending alarms per app. The merged set (notes
 * plus subscriptions) is therefore capped at the soonest 60 and topped up on every
 * launch, instead of pushing a large backlog into the platform.
 */
export const MAX_SCHEDULED_REMINDERS = 60
/** Longest note title inside a visible notification, so the shade stays readable. */
export const MAX_NOTIFICATION_TITLE = 60

export interface ReminderSettings {
  enabled: boolean
  warn: number
  dayOfReminder: boolean
  hideNames: boolean
}

/** Reminders are opt-in; hiding service names is opt-out (private by default). */
export function reminderSettings(settings?: Pick<Settings, 'subscriptionReminders' | 'subscriptionWarnDays' | 'subscriptionDayOfReminder' | 'subscriptionHideNames'> | null): ReminderSettings {
  return {
    enabled: settings?.subscriptionReminders === true,
    warn: clampWarnDays(settings?.subscriptionWarnDays ?? DEFAULT_WARN_DAYS),
    dayOfReminder: settings?.subscriptionDayOfReminder === true,
    hideNames: settings?.subscriptionHideNames !== false,
  }
}

/** Deterministic 32-bit id: the same subscription and kind always map to one notification. */
export function reminderId(subscriptionId: string, kind: 'before' | 'day'): number {
  let hash = 0x811c9dc5
  const input = `fatorati:${subscriptionId}:${kind}`
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % 2_147_483_646 + 1
}

export interface ReminderPlan {
  id: number
  subscriptionId: string
  kind: 'before' | 'day'
  /** Local calendar date the notification fires. */
  date: string
  title: string
  body: string
  /** Epoch milliseconds for the notification, built in the device's local time. */
  at: number
}

function addDays(value: string, days: number): string {
  const start = new Date(`${value}T00:00:00Z`)
  return new Date(start.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

/** Local 09:00 on a calendar date, as epoch milliseconds. */
export function reminderTimestamp(date: string, hour = REMINDER_HOUR): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime()
}

export interface ReminderText { title: string; body: string }

export function reminderText(subscription: Subscription, kind: 'before' | 'day', date: string, settings: ReminderSettings, language: Language = getPreferences().language): ReminderText {
  if (settings.hideNames) return { title: t(HIDDEN_TITLE, {}, language), body: t(HIDDEN_BODY, {}, language) }
  const renewing = subscription.autoRenew && subscription.billingCycle !== 'one_time_period'
  const human = formatDate(date, false, language)
  const body = kind === 'day'
    ? t(renewing ? 'Renews today' : 'Ends today', {}, language)
    : t(renewing ? 'Renews on {date}' : 'Ends on {date}', { date: human }, language)
  return { title: subscription.serviceName, body }
}

/**
 * Pure planning step: which reminders should exist right now.
 *
 * A target date that already passed is dropped (an app opened a week later must
 * not fire a stale alarm), and cancelled entries never produce one. When the
 * warning window already opened - a subscription added late, or a phone that was
 * off - the reminder is clamped to today instead of being lost, and a time that
 * has already passed today becomes "as soon as the platform allows" so the user
 * still hears about a renewal happening now.
 */
export function planReminders(subscriptions: Subscription[], settings: ReminderSettings, options: { now?: number; timeZone?: string; language?: Language } = {}): ReminderPlan[] {
  if (!settings.enabled) return []
  const now = options.now ?? Date.now()
  const today = todayISO(now, options.timeZone)
  const todayDay = dayNumber(today)
  const plans: ReminderPlan[] = []
  // 09:00 today may already be behind us; then the reminder is due immediately.
  const stamp = (date: string) => {
    const value = reminderTimestamp(date)
    return value > now ? value : now + 5_000
  }
  for (const subscription of subscriptions) {
    if (subscription.cancelledAt) continue
    const target = subscribeEndOrRenewal(subscription, { now: options.now, timeZone: options.timeZone, warn: settings.warn })
    if (!target || dayNumber(target) < todayDay) continue
    const opened = addDays(target, -settings.warn)
    const before = dayNumber(opened) < todayDay ? today : opened
    if (dayNumber(target) >= todayDay) {
      plans.push({ id: reminderId(subscription.id, 'before'), subscriptionId: subscription.id, kind: 'before', date: before, at: stamp(before), ...reminderText(subscription, 'before', before, settings, options.language) })
    }
    if (settings.dayOfReminder) {
      plans.push({ id: reminderId(subscription.id, 'day'), subscriptionId: subscription.id, kind: 'day', date: target, at: stamp(target), ...reminderText(subscription, 'day', target, settings, options.language) })
    }
  }
  return plans.sort((a, b) => a.at - b.at).slice(0, MAX_REMINDERS)
}

/**
 * Deterministic 32-bit id for a note reminder. The prefix differs from the
 * subscription one, so the two families can never collide inside the platform's id
 * space even when a note and a subscription share a record id.
 */
export function noteReminderId(noteId: string): number {
  let hash = 0x811c9dc5
  const input = `fatorati:note:${noteId}`
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % 2_147_483_646 + 1
}

export interface NoteReminderPlan {
  id: number
  noteId: string
  /** Local calendar date the notification fires. */
  date: string
  title: string
  body: string
  /** Epoch milliseconds for the notification, built in the device's local time. */
  at: number
}

/**
 * Notification text. With "Hide names" on (the default) it is a generic line that
 * never contains a word of the note. With it off, only the title is shown: the body
 * of a note is never copied into the notification shade.
 */
export function noteReminderText(note: Note, settings: ReminderSettings, language: Language = getPreferences().language): ReminderText {
  if (settings.hideNames) return { title: t(HIDDEN_NOTE_TITLE, {}, language), body: t(HIDDEN_NOTE_BODY, {}, language) }
  return { title: noteTitle(note).slice(0, MAX_NOTIFICATION_TITLE) || t('Untitled note', {}, language), body: t(HIDDEN_NOTE_BODY, {}, language) }
}

/**
 * Which note reminders should exist right now. A note that is archived, done or has no
 * reminder chosen produces nothing, and a moment that is already behind us is dropped
 * unless the note itself is still ahead - then it fires immediately, so a reminder is
 * never silently lost just because the phone was off.
 */
export function planNoteReminders(notes: Note[], settings: ReminderSettings, options: { now?: number; language?: Language } = {}): NoteReminderPlan[] {
  const now = options.now ?? Date.now()
  const plans: NoteReminderPlan[] = []
  for (const note of notes) {
    if (note.archived === true || note.done === true) continue
    const at = noteReminderAt(note)
    if (at === null) continue
    // The moment the note itself is about: its own time, or 09:00 for a date-only note.
    const moment = noteReminderAt({ ...note, remindMinutesBefore: 0 })!
    if (at <= now) {
      if (moment <= now) continue
      plans.push({ id: noteReminderId(note.id), noteId: note.id, date: todayISO(now), ...noteReminderText(note, settings, options.language), at: now + 5_000 })
      continue
    }
    plans.push({ id: noteReminderId(note.id), noteId: note.id, date: note.date!, ...noteReminderText(note, settings, options.language), at })
  }
  return plans.sort((a, b) => a.at - b.at)
}

export type ReminderPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

/** Permission is requested when the user turns reminders on, never at app start. */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (!Capacitor.isNativePlatform()) return 'unsupported'
  try {
    const status = await LocalNotifications.requestPermissions()
    return status.display as ReminderPermission
  } catch {
    return 'unsupported'
  }
}

export async function reminderPermission(): Promise<ReminderPermission> {
  if (!Capacitor.isNativePlatform()) return 'unsupported'
  try {
    const status = await LocalNotifications.checkPermissions()
    return status.display as ReminderPermission
  } catch {
    return 'unsupported'
  }
}

export interface ReminderSyncResult {
  scheduled: number
  cancelled: number
  permission: ReminderPermission
}

/** One scheduled notification, whatever produced it. */
interface ScheduledReminder {
  id: number
  title: string
  body: string
  channelId: string
  at: number
}

/**
 * Replaces every pending reminder with the given set. The whole app shares this one
 * path, so switching between the notebook, the calendar and Settings can never leave
 * a stale alarm behind: everything pending is cancelled first, then the plan is
 * scheduled with the platform's inexact flag (no exact-alarm permission).
 */
async function scheduleReminders(reminders: ScheduledReminder[]): Promise<{ scheduled: number; cancelled: number }> {
  let cancelled = 0
  try {
    const pending = await LocalNotifications.getPending()
    const ids = pending.notifications.map(entry => ({ id: entry.id }))
    if (ids.length) { await LocalNotifications.cancel({ notifications: ids }); cancelled = ids.length }
  } catch { /* Nothing pending, or the platform refused the read. */ }
  if (!reminders.length) return { scheduled: 0, cancelled }
  try {
    await LocalNotifications.createChannel({ id: REMINDER_CHANNEL, name: t('Subscription reminders'), importance: 3, vibration: false })
    await LocalNotifications.createChannel({ id: NOTE_REMINDER_CHANNEL, name: t('Note reminders'), importance: 3, vibration: false })
  } catch { /* Channels are Android 8+ only. */ }
  await LocalNotifications.schedule({
    notifications: reminders.map(reminder => ({
      id: reminder.id,
      title: reminder.title,
      body: reminder.body,
      channelId: reminder.channelId,
      // Inexact by design: no SCHEDULE_EXACT_ALARM, no exact-alarm prompt.
      isExactNotification: false,
      schedule: { at: new Date(reminder.at) },
    })),
  })
  return { scheduled: reminders.length, cancelled }
}

/**
 * Merged plan: notes with a reminder chosen plus the subscription reminders, sorted by
 * time and cut to the platform-safe ceiling. A note reminder is a per-note decision,
 * so it does not depend on the subscription toggle; the subscription reminders still
 * respect theirs.
 */
export function planAllReminders(notes: Note[], subscriptions: Subscription[], settings: ReminderSettings, options: { now?: number; language?: Language } = {}): ScheduledReminder[] {
  const notes$ = planNoteReminders(notes, settings, options).map(plan => ({ id: plan.id, title: plan.title, body: plan.body, channelId: NOTE_REMINDER_CHANNEL, at: plan.at }))
  const subscriptions$ = planReminders(subscriptions, settings, options).map(plan => ({ id: plan.id, title: plan.title, body: plan.body, channelId: REMINDER_CHANNEL, at: plan.at }))
  return [...notes$, ...subscriptions$].sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED_REMINDERS)
}

/**
 * Rebuilds the pending reminder set. Every pending notification is cancelled first,
 * so reminders for deleted, archived, done or cancelled entries disappear, then the
 * current plan is scheduled. Safe to call on launch and after every edit.
 */
export async function syncReminders(notes: Note[], subscriptions: Subscription[], settings: ReminderSettings, options: { now?: number; language?: Language } = {}): Promise<ReminderSyncResult> {
  if (!Capacitor.isNativePlatform()) return { scheduled: 0, cancelled: 0, permission: 'unsupported' }
  const permission = await reminderPermission()
  const reminders = permission === 'granted' ? planAllReminders(notes, subscriptions, settings, options) : []
  const result = await scheduleReminders(reminders)
  return { ...result, permission }
}

/**
 * Subscription-only sync, kept for callers that manage nothing else. It shares the
 * same cancel-then-schedule path as the merged one.
 */
export async function syncSubscriptionReminders(subscriptions: Subscription[], settings: ReminderSettings, options: { now?: number; language?: Language } = {}): Promise<ReminderSyncResult> {
  if (!Capacitor.isNativePlatform()) return { scheduled: 0, cancelled: 0, permission: 'unsupported' }
  const permission = await reminderPermission()
  if (permission !== 'granted') {
    const empty = await scheduleReminders([])
    return { ...empty, permission }
  }
  const reminders = planReminders(subscriptions, settings, options)
    .map(plan => ({ id: plan.id, title: plan.title, body: plan.body, channelId: REMINDER_CHANNEL, at: plan.at }))
  const result = await scheduleReminders(settings.enabled ? reminders : [])
  return { ...result, permission }
}

export async function cancelSubscriptionReminders(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0
  try {
    const pending = await LocalNotifications.getPending()
    const ids = pending.notifications.map(entry => ({ id: entry.id }))
    if (!ids.length) return 0
    await LocalNotifications.cancel({ notifications: ids })
    return ids.length
  } catch {
    return 0
  }
}

/** Exposed for tests and for the "next reminder" preview in Settings. */
export function nextReminderPreview(subscriptions: Subscription[], settings: ReminderSettings, options: { now?: number; timeZone?: string; language?: Language } = {}): ReminderPlan | null {
  return planReminders(subscriptions, settings, options)[0] || null
}
