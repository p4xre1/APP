import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Settings, Subscription } from '../src/store/types'

/**
 * The plugin is exercised through the real Capacitor code path: a fake Android
 * bridge is installed on the global before the module is imported, so
 * `Capacitor.isNativePlatform()` is true and every plugin call lands on
 * `nativePromise`, which this file records. Nothing else is stubbed.
 */
type Call = { method: string; options: unknown }
const calls: Call[] = []
let pending: { id: number }[] = []
let permission = 'granted'
let scheduleShouldFail = false

const PLUGIN_METHODS = ['getPending', 'cancel', 'schedule', 'createChannel', 'requestPermissions', 'checkPermissions']

const host = globalThis as unknown as { androidBridge: unknown; Capacitor: unknown; window: unknown }
host.androidBridge = {}
host.window = { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } }
// @capacitor/core reads its platform from the global bridge, so this makes the
// module believe it runs inside the Android WebView.
host.Capacitor = {
  PluginHeaders: [{ name: 'LocalNotifications', methods: PLUGIN_METHODS.map(name => ({ name, rtype: 'promise' })) }],
  nativePromise: (plugin: string, method: string, options: unknown) => {
      assert.equal(plugin, 'LocalNotifications')
      calls.push({ method, options })
    switch (method) {
      case 'getPending': return Promise.resolve({ notifications: pending })
      case 'cancel': return Promise.resolve()
      case 'createChannel': return Promise.resolve()
      case 'schedule':
        if (scheduleShouldFail) return Promise.reject(new Error('boom'))
        return Promise.resolve()
      case 'requestPermissions':
      case 'checkPermissions': return Promise.resolve({ display: permission })
      default: return Promise.reject(new Error(`unexpected ${method}`))
    }
  },
}

const {
  planReminders, reminderSettings, reminderId, reminderTimestamp, reminderText, nextReminderPreview,
  syncSubscriptionReminders, cancelSubscriptionReminders, reminderPermission, requestReminderPermission,
  HIDDEN_TITLE, HIDDEN_BODY, MAX_REMINDERS, REMINDER_CHANNEL, REMINDER_HOUR,
} = await import('../src/lib/notifications')

const settings = (patch: Partial<Settings> = {}): Settings => ({
  subscriptionReminders: true, subscriptionWarnDays: 7, subscriptionDayOfReminder: false, subscriptionHideNames: true,
  ...patch,
} as Settings)

const sub = (patch: Partial<Subscription> = {}): Subscription => ({
  id: 'sub-1', serviceName: 'Netflix', category: 'Media', amountMinor: 12000, currency: 'USD', billingCycle: 'monthly',
  autoRenew: true, startDate: '2026-10-20', createdAt: 1, updatedAt: 1, ...patch,
})
const at = (day: string) => Date.parse(`${day}T12:00:00Z`)
const options = (patch: Record<string, unknown> = {}) => ({ now: at('2026-10-01'), timeZone: 'UTC', language: 'en' as const, ...patch })

test('settings default to private: reminders opt-in, hidden names opt-out', () => {
  assert.deepEqual(reminderSettings(undefined), { enabled: false, warn: 7, dayOfReminder: false, hideNames: true })
  assert.deepEqual(reminderSettings({} as Settings), { enabled: false, warn: 7, dayOfReminder: false, hideNames: true })
  assert.equal(reminderSettings(settings({ subscriptionReminders: false })).enabled, false)
  assert.equal(reminderSettings(settings({ subscriptionHideNames: false })).hideNames, false)
  // warn days are clamped to the configurable window 1..30
  assert.equal(reminderSettings(settings({ subscriptionWarnDays: 0 })).warn, 1)
  assert.equal(reminderSettings(settings({ subscriptionWarnDays: 99 })).warn, 30)
  assert.equal(reminderSettings(settings({ subscriptionWarnDays: 15 })).warn, 15)
})

test('nothing is planned while reminders are off', () => {
  assert.deepEqual(planReminders([sub()], reminderSettings(settings({ subscriptionReminders: false })), options()), [])
})

test('a reminder is planned warn-days ahead, at 09:00 local, and hidden by default', () => {
  const plans = planReminders([sub()], reminderSettings(settings()), options())
  assert.equal(plans.length, 1)
  const plan = plans[0]
  assert.equal(plan.date, '2026-10-13')
  assert.equal(plan.kind, 'before')
  assert.equal(plan.subscriptionId, 'sub-1')
  assert.equal(new Date(plan.at).getHours(), REMINDER_HOUR)
  assert.equal(new Date(plan.at).getMinutes(), 0)
  assert.equal(plan.title, HIDDEN_TITLE)
  assert.equal(plan.body, HIDDEN_BODY)
})

test('service names are shown only when the user turns hiding off', () => {
  const config = reminderSettings(settings({ subscriptionHideNames: false }))
  const [plan] = planReminders([sub()], config, options())
  assert.equal(plan.title, 'Netflix')
  assert.match(plan.body, /Renews on/)
  const oneOff = sub({ autoRenew: false, billingCycle: 'one_time_period', periodMonths: 1 })
  assert.match(planReminders([oneOff], config, options())[0].body, /Ends on/)
  assert.deepEqual(reminderText(sub(), 'day', '2026-10-20', config, 'en'), { title: 'Netflix', body: 'Renews today' })
  assert.deepEqual(reminderText(sub({ autoRenew: false }), 'day', '2026-10-20', config, 'en'), { title: 'Netflix', body: 'Ends today' })
})

test('the day-of reminder is optional and ids are stable per subscription and kind', () => {
  const withoutDay = planReminders([sub()], reminderSettings(settings()), options())
  assert.equal(withoutDay.length, 1)
  const withDay = planReminders([sub()], reminderSettings(settings({ subscriptionDayOfReminder: true })), options())
  assert.deepEqual(withDay.map(plan => plan.date), ['2026-10-13', '2026-10-20'])
  assert.equal(withDay[1].kind, 'day')
  assert.deepEqual(withDay.map(plan => plan.id), [reminderId('sub-1', 'before'), reminderId('sub-1', 'day')])
  assert.equal(reminderId('sub-1', 'before'), reminderId('sub-1', 'before'))
  assert.notEqual(reminderId('sub-1', 'before'), reminderId('sub-1', 'day'))
  assert.notEqual(reminderId('sub-1', 'before'), reminderId('sub-2', 'before'))
  assert.ok(withDay.every(plan => plan.id >= 1 && plan.id <= 2_147_483_646))
})

test('cancelled entries are skipped and past dates are dropped', () => {
  const cancelled = sub({ id: 'sub-2', cancelledAt: Date.parse('2026-09-01T00:00:00Z') })
  assert.deepEqual(planReminders([cancelled], reminderSettings(settings()), options()), [])
  // A device that was off through the whole reminder window must not fire a stale reminder.
  const ended = sub({ id: 'sub-3', autoRenew: false, billingCycle: 'one_time_period', periodMonths: 1, startDate: '2026-09-20' })
  assert.deepEqual(planReminders([ended], reminderSettings(settings()), options({ now: at('2026-10-25') })), [])
  assert.deepEqual(planReminders([ended], reminderSettings(settings({ subscriptionDayOfReminder: true })), options({ now: at('2026-10-25') })), [])
  // Exactly on the reminder day it still fires, at 09:00.
  const early = options({ now: Date.parse('2026-10-13T06:00:00Z') })
  const onTime = planReminders([sub()], reminderSettings(settings()), early)[0]
  assert.equal(onTime.date, '2026-10-13')
  assert.equal(onTime.at, Date.parse('2026-10-13T09:00:00Z'))
  // Later in the window the reminder is not lost: it is clamped to today and
  // becomes due immediately instead of waiting for the next morning.
  const late = planReminders([sub()], reminderSettings(settings()), options({ now: at('2026-10-14') }))[0]
  assert.equal(late.date, '2026-10-14')
  assert.equal(late.at, at('2026-10-14') + 5000)
})

test('the plan is sorted by time and capped', () => {
  const many = Array.from({ length: MAX_REMINDERS + 25 }, (_, index) => sub({
    id: `sub-${index}`, startDate: `2026-10-${String((index % 20) + 5).padStart(2, '0')}`,
  }))
  const plans = planReminders(many, reminderSettings(settings({ subscriptionDayOfReminder: true })), options({ now: at('2026-09-30') }))
  assert.equal(plans.length, MAX_REMINDERS)
  for (let index = 1; index < plans.length; index++) assert.ok(plans[index].at >= plans[index - 1].at)
  assert.deepEqual(nextReminderPreview(many, reminderSettings(settings()), options({ now: at('2026-09-30') })), plans[0])
})

test('an empty plan and an unsupported platform both do nothing', async () => {
  assert.equal(nextReminderPreview([], reminderSettings(settings()), options()), null)
  assert.equal(reminderTimestamp('2026-10-13'), new Date(2026, 9, 13, REMINDER_HOUR).getTime())
})

test('scheduling cancels the old set first and asks for nothing exact', async () => {
  calls.length = 0
  pending = [{ id: 11 }, { id: 22 }]
  permission = 'granted'
  const result = await syncSubscriptionReminders(
    [sub(), sub({ id: 'sub-2', serviceName: 'Hosting', startDate: '2026-11-05' })],
    reminderSettings(settings({ subscriptionDayOfReminder: true })),
    { now: at('2026-10-01'), language: 'en' },
  )
  assert.deepEqual(result, { scheduled: 4, cancelled: 2, permission: 'granted' })
  const cancelCall = calls.find(call => call.method === 'cancel')!
  assert.deepEqual(cancelCall.options, { notifications: [{ id: 11 }, { id: 22 }] })
  const scheduleCall = calls.find(call => call.method === 'schedule')!
  const notifications = (scheduleCall.options as { notifications: Record<string, unknown>[] }).notifications
  assert.deepEqual(notifications.map(entry => entry.id).sort((a, b) => Number(a) - Number(b)), [reminderId('sub-1', 'before'), reminderId('sub-1', 'day'), reminderId('sub-2', 'before'), reminderId('sub-2', 'day')].sort((a, b) => a - b))
  assert.equal(notifications.length, 4)
  assert.ok(notifications.every(entry => entry.isExactNotification === false))
  assert.ok(notifications.every(entry => entry.channelId === REMINDER_CHANNEL))
  assert.ok(notifications.every(entry => entry.title === HIDDEN_TITLE && entry.body === HIDDEN_BODY))
  const channel = calls.find(call => call.method === 'createChannel')!
  assert.deepEqual(channel.options, { id: REMINDER_CHANNEL, name: 'Subscription reminders', importance: 3, vibration: false })
})

test('a denied permission schedules nothing and reports itself', async () => {
  calls.length = 0
  pending = [{ id: 5 }]
  permission = 'denied'
  const result = await syncSubscriptionReminders([sub()], reminderSettings(settings()), { now: at('2026-10-01'), language: 'en' })
  assert.deepEqual(result, { scheduled: 0, cancelled: 1, permission: 'denied' })
  assert.equal(calls.some(call => call.method === 'schedule'), false)
  assert.equal(await reminderPermission(), 'denied')
  assert.equal(await requestReminderPermission(), 'denied')
})

test('turning reminders off clears every pending notification', async () => {
  calls.length = 0
  pending = [{ id: 7 }, { id: 8 }, { id: 9 }]
  permission = 'granted'
  const result = await syncSubscriptionReminders([sub()], reminderSettings(settings({ subscriptionReminders: false })), { now: at('2026-10-01'), language: 'en' })
  assert.deepEqual(result, { scheduled: 0, cancelled: 3, permission: 'granted' })
  assert.equal(calls.some(call => call.method === 'schedule'), false)
  // A deleted or cancelled subscription simply is not in the new set any more.
  calls.length = 0
  pending = []
  await syncSubscriptionReminders([sub({ cancelledAt: Date.now() })], reminderSettings(settings()), { now: at('2026-10-01'), language: 'en' })
  assert.equal(calls.some(call => call.method === 'schedule'), false)
})

test('a plugin failure is not fatal: the in-app banner still works', async () => {
  calls.length = 0
  pending = []
  permission = 'granted'
  scheduleShouldFail = true
  await assert.rejects(() => syncSubscriptionReminders([sub()], reminderSettings(settings()), { now: at('2026-10-01'), language: 'en' }))
  scheduleShouldFail = false
  assert.equal(await cancelSubscriptionReminders(), 0)
  pending = [{ id: 1 }]
  assert.equal(await cancelSubscriptionReminders(), 1)
})
