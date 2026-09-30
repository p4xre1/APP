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
import type { Settings, Subscription } from '../store/types'
import { DEFAULT_WARN_DAYS, dayNumber, subscribeEndOrRenewal, todayISO, warnDays as clampWarnDays } from './subscriptions'

/** Reminders land at 09:00 local time; a fixed hour survives DST shifts. */
export const REMINDER_HOUR = 9
export const REMINDER_CHANNEL = 'subscriptions'
export const MAX_REMINDERS = 200

export const HIDDEN_TITLE = 'Subscription reminder'
export const HIDDEN_BODY = 'A subscription needs your attention'

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

/**
 * Rebuilds the pending reminder set. Every pending notification is cancelled
 * first, so reminders for deleted or cancelled subscriptions disappear, then the
 * current plan is scheduled. Safe to call on launch and after every edit.
 */
export async function syncSubscriptionReminders(subscriptions: Subscription[], settings: ReminderSettings, options: { now?: number; language?: Language } = {}): Promise<ReminderSyncResult> {
  if (!Capacitor.isNativePlatform()) return { scheduled: 0, cancelled: 0, permission: 'unsupported' }
  let cancelled = 0
  try {
    const pending = await LocalNotifications.getPending()
    const ids = pending.notifications.map(entry => ({ id: entry.id }))
    if (ids.length) { await LocalNotifications.cancel({ notifications: ids }); cancelled = ids.length }
  } catch { /* Nothing pending, or the platform refused the read. */ }
  if (!settings.enabled) return { scheduled: 0, cancelled, permission: await reminderPermission() }
  const permission = await reminderPermission()
  if (permission !== 'granted') return { scheduled: 0, cancelled, permission }
  const plans = planReminders(subscriptions, settings, options)
  if (!plans.length) return { scheduled: 0, cancelled, permission }
  try {
    await LocalNotifications.createChannel({ id: REMINDER_CHANNEL, name: t('Subscription reminders'), importance: 3, vibration: false })
  } catch { /* Channels are Android 8+ only. */ }
  await LocalNotifications.schedule({
    notifications: plans.map(plan => ({
      id: plan.id,
      title: plan.title,
      body: plan.body,
      channelId: REMINDER_CHANNEL,
      // Inexact by design: no SCHEDULE_EXACT_ALARM, no exact-alarm prompt.
      isExactNotification: false,
      schedule: { at: new Date(plan.at) },
    })),
  })
  return { scheduled: plans.length, cancelled, permission }
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
