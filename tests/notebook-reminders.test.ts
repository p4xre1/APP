import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Note, Settings, Subscription } from '../src/store/types'

/**
 * The notebook uses the same local-notification plugin as the subscriptions, so it is
 * exercised the same way: a fake Android bridge is installed before the module is
 * imported and every plugin call is recorded, without stubbing anything else.
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
  HIDDEN_NOTE_BODY, HIDDEN_NOTE_TITLE, MAX_NOTIFICATION_TITLE, MAX_SCHEDULED_REMINDERS, NOTE_REMINDER_CHANNEL,
  noteReminderId, noteReminderText, planAllReminders, planNoteReminders, reminderSettings, syncReminders,
} = await import('../src/lib/notifications')

const settings = (patch: Partial<Settings> = {}): Settings => ({
  subscriptionReminders: false, subscriptionWarnDays: 7, subscriptionDayOfReminder: false, subscriptionHideNames: true,
  ...patch,
} as Settings)

const note = (patch: Partial<Note> = {}): Note => ({
  id: 'n1', body: 'Call the accountant', tags: [], pinned: false, archived: false, type: 'idea', done: false,
  date: '2026-10-05', remindMinutesBefore: 15, createdAt: 1, updatedAt: 1, ...patch,
})
const sub = (patch: Partial<Subscription> = {}): Subscription => ({
  id: 's1', serviceName: 'Netflix', category: 'Media', amountMinor: 1200, currency: 'USD', billingCycle: 'monthly',
  autoRenew: true, startDate: '2026-10-20', createdAt: 1, updatedAt: 1, ...patch,
} as Subscription)

const at = (value: string) => Date.parse(value)
const options = (patch: Record<string, unknown> = {}) => ({ now: at('2026-10-01T12:00:00Z'), language: 'en' as const, ...patch })

test('a note with a reminder plans a notification at the chosen moment', () => {
  const plans = planNoteReminders([note()], reminderSettings(settings()), options())
  assert.equal(plans.length, 1)
  assert.equal(plans[0].noteId, 'n1')
  assert.equal(plans[0].id, noteReminderId('n1'))
  assert.equal(plans[0].date, '2026-10-05')
  // 09:00 local for a date-only note, minus the 15 minutes the user chose.
  assert.equal(new Date(plans[0].at).getHours(), 8)
  assert.equal(new Date(plans[0].at).getMinutes(), 45)
  // The id family is distinct from the subscription one and stays in range.
  assert.ok(plans[0].id >= 1 && plans[0].id <= 2_147_483_646)
  assert.notEqual(noteReminderId('s1'), noteReminderId('n1'))
  assert.equal(noteReminderId('n1'), noteReminderId('n1'))
})

test('a note without a reminder, an archived note and a done task plan nothing', () => {
  assert.deepEqual(planNoteReminders([note({ remindMinutesBefore: undefined })], reminderSettings(settings()), options()), [])
  assert.deepEqual(planNoteReminders([note({ date: undefined })], reminderSettings(settings()), options()), [])
  assert.deepEqual(planNoteReminders([note({ archived: true })], reminderSettings(settings()), options()), [])
  assert.deepEqual(planNoteReminders([note({ type: 'task', done: true })], reminderSettings(settings()), options()), [])
  assert.equal(planNoteReminders([note()], reminderSettings(), options()).length, 1, 'a note reminder is a per-note choice')
})

test('a timed note reminds relative to its own time', () => {
  const plans = planNoteReminders([note({ time: '14:30', remindMinutesBefore: 60 })], reminderSettings(settings()), options())
  assert.equal(new Date(plans[0].at).getHours(), 13)
  assert.equal(new Date(plans[0].at).getMinutes(), 30)
})

test('a moment already behind us fires now, but a past note is not resurrected', () => {
  // The phone was off when the one-day-before reminder should have fired, but the note
  // itself is still ahead: the reminder is delivered immediately instead of being lost.
  const missed = note({ time: '14:00', remindMinutesBefore: 1440 })
  const late = planNoteReminders([missed], reminderSettings(settings()), options({ now: at('2026-10-05T12:00:00Z') }))
  assert.equal(late.length, 1)
  assert.equal(late[0].at, at('2026-10-05T12:00:00Z') + 5_000)
  assert.equal(late[0].date, '2026-10-05')
  // Once the note's own moment has passed too, it is history and stays out.
  assert.deepEqual(planNoteReminders([missed], reminderSettings(settings()), options({ now: at('2026-10-05T15:00:00Z') })), [])
})

test('reminder text never contains a word of the note unless the user turned hiding off', () => {
  const hidden = noteReminderText(note(), reminderSettings(settings()))
  assert.deepEqual(hidden, { title: HIDDEN_NOTE_TITLE, body: HIDDEN_NOTE_BODY })
  assert.ok(!JSON.stringify(hidden).includes('accountant'))
  const shown = noteReminderText(note({ title: 'Café renewal' }), reminderSettings(settings({ subscriptionHideNames: false })))
  assert.equal(shown.title, 'Café renewal')
  // Even with names shown, the body of a note is never copied to the shade.
  assert.equal(shown.body, HIDDEN_NOTE_BODY)
  assert.ok(!shown.body.includes('Call the accountant'))
  // A long title is cut, and a note without a title falls back to a translated label.
  const long = noteReminderText(note({ title: 'x'.repeat(200) }), reminderSettings(settings({ subscriptionHideNames: false })))
  assert.equal(long.title.length, MAX_NOTIFICATION_TITLE)
  assert.equal(noteReminderText(note({ title: '', body: '' }), reminderSettings(settings({ subscriptionHideNames: false })), 'fr').title, 'Note sans titre')
})

test('notes and subscriptions share one plan, sorted by time and capped at 60', () => {
  const notes = Array.from({ length: 80 }, (_, index) => note({ id: `n${index}`, date: `2026-10-${String((index % 28) + 1).padStart(2, '0')}` }))
  const subscriptions = [sub({ id: 's1', startDate: '2026-10-15' }), sub({ id: 's2', startDate: '2026-11-15' })]
  const plan = planAllReminders(notes, subscriptions, reminderSettings(settings({ subscriptionReminders: true, subscriptionDayOfReminder: true })), options({ now: at('2026-09-30T00:00:00Z') }))
  assert.equal(plan.length, MAX_SCHEDULED_REMINDERS)
  for (let index = 1; index < plan.length; index++) assert.ok(plan[index].at >= plan[index - 1].at, 'the soonest reminders win')
  assert.ok(plan.every(entry => [NOTE_REMINDER_CHANNEL, 'subscriptions'].includes(entry.channelId)))
  // The soonest note is always kept, even with far more notes than slots.
  assert.equal(plan[0].id, noteReminderId('n0'))
  assert.ok(plan.some(entry => entry.channelId === 'subscriptions'))
})

test('scheduling replaces the pending set, creates the notes channel and stays inexact', async () => {
  calls.length = 0
  pending = [{ id: 11 }, { id: 22 }, { id: 33 }]
  permission = 'granted'
  const result = await syncReminders([note()], [], reminderSettings(settings()), options())
  assert.deepEqual(result, { scheduled: 1, cancelled: 3, permission: 'granted' })
  assert.deepEqual(calls.find(call => call.method === 'cancel')!.options, { notifications: [{ id: 11 }, { id: 22 }, { id: 33 }] })
  const notifications = (calls.find(call => call.method === 'schedule')!.options as { notifications: Record<string, unknown>[] }).notifications
  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].channelId, NOTE_REMINDER_CHANNEL)
  assert.equal(notifications[0].title, HIDDEN_NOTE_TITLE)
  assert.equal(notifications[0].body, HIDDEN_NOTE_BODY)
  assert.equal(notifications[0].isExactNotification, false, 'no exact alarm is ever requested')
  const channels = calls.filter(call => call.method === 'createChannel').map(call => call.options as { id: string; importance: number; vibration: boolean })
  assert.deepEqual(channels.map(channel => channel.id).sort(), ['notes', 'subscriptions'])
  assert.ok(channels.every(channel => channel.importance === 3 && channel.vibration === false))
})

test('deleting, archiving or finishing a note cancels its reminder on the next sync', async () => {
  calls.length = 0
  pending = [{ id: noteReminderId('n1') }]
  permission = 'granted'
  // The user archived the note: the notebook calls the same sync with the new list.
  const archived = await syncReminders([note({ archived: true })], [], reminderSettings(settings()), options())
  assert.deepEqual(archived, { scheduled: 0, cancelled: 1, permission: 'granted' })
  assert.equal(calls.some(call => call.method === 'schedule'), false, 'an archived note leaves nothing behind')
  // Deleted is the same story: the note is simply gone from the list.
  calls.length = 0
  pending = [{ id: noteReminderId('n1') }]
  const deleted = await syncReminders([], [], reminderSettings(settings()), options())
  assert.deepEqual(deleted, { scheduled: 0, cancelled: 1, permission: 'granted' })
  // Marking a task done cancels it too.
  calls.length = 0
  pending = []
  const done = await syncReminders([note({ type: 'task', done: true })], [], reminderSettings(settings()), options())
  assert.equal(done.scheduled, 0)
})

test('a restored backup is re-planned from the restored notes', async () => {
  calls.length = 0
  pending = []
  permission = 'granted'
  const restored = [note({ id: 'r1', date: '2026-10-09' }), note({ id: 'r2', date: '2026-10-09', remindMinutesBefore: undefined })]
  const result = await syncReminders(restored, [], reminderSettings(settings()), options())
  assert.equal(result.scheduled, 1)
  const notifications = (calls.find(call => call.method === 'schedule')!.options as { notifications: { id: number }[] }).notifications
  assert.deepEqual(notifications.map(entry => entry.id), [noteReminderId('r1')])
})

test('a denied permission schedules nothing and the in-app banner still has its answer', async () => {
  calls.length = 0
  pending = [{ id: 5 }]
  permission = 'denied'
  const result = await syncReminders([note()], [], reminderSettings(settings()), options())
  assert.deepEqual(result, { scheduled: 0, cancelled: 1, permission: 'denied' })
  assert.equal(calls.some(call => call.method === 'schedule'), false)
})

test('a plugin failure surfaces instead of being swallowed by the store', async () => {
  calls.length = 0
  pending = []
  permission = 'granted'
  scheduleShouldFail = true
  await assert.rejects(() => syncReminders([note()], [], reminderSettings(settings()), options()))
  scheduleShouldFail = false
  pending = []
  // A non-native platform (the browser build) does nothing at all.
  const bridge = host.androidBridge
  host.androidBridge = undefined
  const isolated = await import(`../src/lib/notifications?browser=${Date.now()}`)
  assert.deepEqual(await isolated.syncReminders([note()], [], reminderSettings(settings()), options()), { scheduled: 0, cancelled: 0, permission: 'unsupported' })
  host.androidBridge = bridge
})
