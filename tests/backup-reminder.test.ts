import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  backupReminderState, countChangesSince, defaultReminderSettings, frequencyDays, nextDismissal,
  reminderFrequencies, validReminderSettings, CHANGES_THRESHOLD, DAY, SNOOZE_DAYS,
} from '../src/lib/backup-reminder'

const now = Date.UTC(2026, 8, 29, 12)
const settings = (patch: Partial<typeof defaultReminderSettings> = {}) => ({ ...defaultReminderSettings, ...patch })

test('the reminder appears after the chosen number of days and not before', () => {
  assert.equal(backupReminderState({ lastBackup: now - 6 * DAY, now, settings: settings() }).due, false)
  const due = backupReminderState({ lastBackup: now - 8 * DAY, now, settings: settings() })
  assert.equal(due.due, true)
  assert.equal(due.reason, 'age')
  assert.equal(due.daysSince, 8)
  assert.equal(backupReminderState({ lastBackup: now - 3 * DAY, now, settings: settings({ frequency: '3' }) }).due, true)
  assert.equal(backupReminderState({ lastBackup: now - 3 * DAY, now, settings: settings({ frequency: '30' }) }).due, false)
})

test('no backup yet is due; turning the reminder off is never due; many changes are due early', () => {
  const never = backupReminderState({ lastBackup: null, now, settings: settings() })
  assert.equal(never.due, true)
  assert.equal(never.reason, 'never')
  assert.equal(never.daysSince, null)
  assert.equal(backupReminderState({ lastBackup: null, now, settings: settings({ frequency: 'off' }) }).due, false)
  const changes = backupReminderState({ lastBackup: now - DAY, now, settings: settings(), changes: CHANGES_THRESHOLD })
  assert.equal(changes.due, true)
  assert.equal(changes.reason, 'changes')
  assert.equal(backupReminderState({ lastBackup: now - DAY, now, settings: settings(), changes: CHANGES_THRESHOLD - 1 }).due, false)
  assert.equal(backupReminderState({ lastBackup: now - DAY, now, settings: settings({ frequency: 'off' }), changes: 500 }).due, false)
})

test('dismissing hides the banner for several days, then it comes back', () => {
  const dismissedUntil = nextDismissal(now)
  assert.equal(dismissedUntil, now + SNOOZE_DAYS * DAY)
  assert.equal(backupReminderState({ lastBackup: now - 30 * DAY, now, settings: settings({ dismissedUntil }) }).due, false)
  assert.equal(backupReminderState({ lastBackup: now - 30 * DAY, now: dismissedUntil + 1, settings: settings({ dismissedUntil }) }).due, true)
})

test('only records touched after the last backup count as changes', () => {
  const rows = [{ updatedAt: now - DAY }, { updatedAt: now + 1 }, { updatedAt: now + 2 }]
  assert.equal(countChangesSince(now, [rows]), 2)
  assert.equal(countChangesSince(null, [rows]), 0)
  assert.equal(countChangesSince(now, []), 0)
})

test('reminder settings and frequencies stay valid', () => {
  assert.equal(frequencyDays('7'), 7)
  assert.equal(frequencyDays('off'), null)
  assert.deepEqual(reminderFrequencies, ['off', '3', '7', '14', '30'])
  assert.equal(validReminderSettings(defaultReminderSettings), true)
  assert.equal(validReminderSettings({ frequency: '7', dismissedUntil: Number.NaN }), false)
  assert.equal(validReminderSettings({ frequency: 'daily', dismissedUntil: 0 }), false)
})
