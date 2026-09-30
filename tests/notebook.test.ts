import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'
import { createOrChangePin, lockVault, resetApp, unlockPin } from '../src/lib/vault'
import { readSnapshot } from '../src/lib/storage'
import { add, getAll, importBackup, exportBackup, remove, update, generateId } from '../src/lib/db'
import { BACKUP_VERSION, MAX_RECORDS_PER_STORE, migrateBackup, validateBackup } from '../src/lib/backup-format'
import {
  DEFAULT_FILTERS, MAX_NOTE_BODY, MAX_NOTE_TITLE, MAX_TAGS, MAX_TAG_LENGTH, NOTE_COLORS, REMINDER_CHOICES,
  asTask, emptyNote, filterNotes, noteCounts, noteExcerpt, noteReminderAt, noteTags, noteTitle, normalizeNote,
  normalizeTags, parseTags, sortNotes, validateNote,
} from '../src/lib/notes'
import { isNoteColor, noteColorHex } from '../src/lib/notes'
import type { Note } from '../src/store/types'
import { fixture } from './fixtures'

beforeEach(() => { lockVault(); globalThis.indexedDB = new IDBFactory() })

const note = (patch: Partial<Note> = {}): Note => ({
  id: 'note-1', body: 'Buy more paper', tags: [], pinned: false, archived: false, type: 'idea', done: false,
  createdAt: 1000, updatedAt: 1000, ...patch,
})

test('a note is valid only inside the documented caps', () => {
  assert.equal(validateNote({ body: '  ' }), 'Write something first')
  assert.equal(validateNote({ body: '', title: 'Only a title' }), null)
  assert.equal(validateNote({ body: 'x'.repeat(MAX_NOTE_BODY) }), null)
  assert.equal(validateNote({ body: 'x'.repeat(MAX_NOTE_BODY + 1) }), 'This note is too long')
  assert.equal(validateNote({ body: 'ok', title: 'x'.repeat(MAX_NOTE_TITLE + 1) }), 'This title is too long')
  assert.equal(validateNote({ body: 'ok', tags: Array.from({ length: MAX_TAGS + 1 }, (_, index) => `tag${index}`) }), 'Too many tags')
  // A time needs a date, because the calendar places notes by date only.
  assert.equal(validateNote({ body: 'ok', time: '09:30' }), 'Choose a date for the reminder')
  assert.equal(validateNote({ body: 'ok', time: '9:30' }), 'Enter a time like 09:30')
  assert.equal(validateNote({ body: 'ok', date: '2026-10-05', time: '09:30' }), null)
  assert.equal(validateNote({ body: 'ok', remindMinutesBefore: 5 }), 'Choose a reminder')
  assert.equal(validateNote({ body: 'ok', date: '2026-10-05', remindMinutesBefore: 5 }), 'Choose a reminder')
  assert.equal(validateNote({ body: 'ok', date: '2026-10-05', remindMinutesBefore: 15 }), null)
})

test('tags are trimmed, de-duplicated case-insensitively and capped', () => {
  assert.deepEqual(normalizeTags([' Work ', 'work', 'HOME', 'x'.repeat(40)]), ['Work', 'HOME', 'x'.repeat(MAX_TAG_LENGTH)])
  assert.deepEqual(normalizeTags('not an array'), [])
  assert.deepEqual(normalizeTags(Array.from({ length: MAX_TAGS + 4 }, (_, index) => `t${index}`)).length, MAX_TAGS)
  assert.deepEqual(parseTags('a, b\nc,, '), ['a', 'b', 'c'])
})

test('normalizeNote completes a row written by an older build and clamps everything', () => {
  const clean = normalizeNote({
    id: 'n1', body: 'x'.repeat(MAX_NOTE_BODY + 50), title: '  spaced  ', tags: ['ok', 'ok', 42],
    type: 'unknown', color: 'hotpink', date: '2026-10-05', time: '25:00', remindMinutesBefore: 3,
    pinned: 'yes', archived: 0, done: 1, linkedCustomerId: ' c1 ', linkedInvoiceId: '', linkedProjectId: 'x'.repeat(200),
    createdAt: 1, updatedAt: 2,
  })
  assert.equal((clean.body as string).length, MAX_NOTE_BODY)
  assert.equal(clean.title, 'spaced')
  assert.deepEqual(clean.tags, ['ok'])
  assert.equal(clean.type, 'idea')
  assert.equal(clean.color, undefined)
  assert.equal(clean.time, undefined)
  assert.equal(clean.remindMinutesBefore, undefined)
  assert.equal(clean.pinned, false)
  assert.equal(clean.archived, false)
  assert.equal(clean.done, false)
  assert.equal(clean.linkedCustomerId, 'c1')
  assert.equal(clean.linkedInvoiceId, undefined)
  assert.equal((clean.linkedProjectId as string).length, 64)
  // A time and a reminder without a date are dropped together.
  const undated = normalizeNote({ body: 'x', time: '09:30', remindMinutesBefore: 15 })
  assert.equal(undated.time, undefined)
  assert.equal(undated.remindMinutesBefore, undefined)
  // An empty title is removed rather than stored as an empty string.
  assert.equal(normalizeNote({ body: 'x', title: '   ' }).title, undefined)
})

test('the palette is closed, AA on white, and unknown colours fall back to none', () => {
  assert.equal(noteColorHex('none'), null)
  assert.equal(noteColorHex('blue'), '#1d4ed8')
  assert.equal(noteColorHex(undefined), null)
  assert.equal(isNoteColor('hotpink'), false)
  assert.equal(isNoteColor('teal'), true)
  assert.ok(NOTE_COLORS.length >= 10)
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  for (const color of NOTE_COLORS) {
    if (!color.hex) continue
    const [r, g, b] = [1, 3, 5].map(index => parseInt(color.hex!.slice(index, index + 2), 16))
    const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    assert.ok((1.05 / (luminance + 0.05)) >= 4.5, `${color.id} is below AA on white`)
  }
})

test('title and excerpt fall back to the first body line, and stay plain text', () => {
  assert.equal(noteTitle(note({ title: ' Shopping ' })), 'Shopping')
  assert.equal(noteTitle(note({ body: '\n\nSecond line is the title\nmore' })), 'Second line is the title')
  assert.equal(noteTitle({ title: '', body: '' }), '')
  // Markup is text, never rendered: the excerpt keeps the characters as typed.
  assert.equal(noteExcerpt({ body: '  <b>bold</b>\n   and   more  ' }), '<b>bold</b> and more')
  assert.equal(noteExcerpt({ body: 'x'.repeat(300) }).length, 140)
  assert.equal(emptyNote(5).body, '')
  assert.equal(emptyNote(5).type, 'idea')
})

test('search covers title, body and tags, ignoring case, accents and Arabic variants', () => {
  const rows = [
    note({ id: 'a', title: 'Café meeting', body: 'with the accountant' }),
    note({ id: 'b', body: 'Renew the insurance', tags: ['Urence'] }),
    note({ id: 'c', body: 'ملاحظة سريعة', tags: ['فكرة'] }),
  ]
  assert.deepEqual(filterNotes(rows, { ...DEFAULT_FILTERS, query: 'cafe' }).map(row => row.id), ['a'])
  assert.deepEqual(filterNotes(rows, { ...DEFAULT_FILTERS, query: 'CAFÉ' }).map(row => row.id), ['a'])
  assert.deepEqual(filterNotes(rows, { ...DEFAULT_FILTERS, query: 'urence' }).map(row => row.id), ['b'])
  assert.deepEqual(filterNotes(rows, { ...DEFAULT_FILTERS, query: 'accountant insurance' }).map(row => row.id), [])
  assert.deepEqual(filterNotes(rows, { ...DEFAULT_FILTERS, query: 'فكرة' }).map(row => row.id), ['c'])
  // Arabic alef variants and the ta-marbuta fold together, like the FAQ search.
  assert.deepEqual(filterNotes(rows, { ...DEFAULT_FILTERS, query: 'ملاحظه' }).map(row => row.id), ['c'])
  assert.deepEqual(filterNotes(rows, { ...DEFAULT_FILTERS, query: '' }).length, 3)
})

test('filters narrow by type, tag, date, task state and archive', () => {
  const rows = [
    note({ id: 'idea', type: 'idea' }),
    note({ id: 'open', type: 'task', done: false, date: '2026-10-05', tags: ['Work'] }),
    note({ id: 'done', type: 'task', done: true, date: '2026-10-06' }),
    note({ id: 'plain', type: 'note' }),
    note({ id: 'archived', archived: true }),
  ]
  const ids = (filters: Partial<typeof DEFAULT_FILTERS>) => filterNotes(rows, { ...DEFAULT_FILTERS, ...filters }).map(row => row.id)
  assert.deepEqual(ids({}), ['idea', 'open', 'done', 'plain'])
  assert.deepEqual(ids({ archived: true }), ['archived'])
  assert.deepEqual(ids({ type: 'task' }), ['open', 'done'])
  assert.deepEqual(ids({ tag: 'work' }), ['open'])
  assert.deepEqual(ids({ dated: 'dated' }), ['open', 'done'])
  assert.deepEqual(ids({ dated: 'undated' }), ['idea', 'plain'])
  assert.deepEqual(ids({ state: 'done' }), ['done'])
  // "Open" means an unfinished task, not every record that is not a task.
  assert.deepEqual(ids({ state: 'open' }), ['idea', 'open', 'plain'])
})

test('sorting keeps pinned notes first and puts undated notes last', () => {
  const rows = [
    note({ id: 'undated', updatedAt: 5000 }),
    note({ id: 'late', date: '2026-12-01', updatedAt: 100 }),
    note({ id: 'early', date: '2026-01-02', updatedAt: 200 }),
    note({ id: 'pinned', updatedAt: 50, pinned: true }),
  ]
  assert.deepEqual(sortNotes(rows, 'date').map(row => row.id), ['pinned', 'early', 'late', 'undated'])
  assert.deepEqual(sortNotes(rows, 'updated').map(row => row.id), ['pinned', 'undated', 'early', 'late'])
  assert.deepEqual(sortNotes(rows, 'created').map(row => row.id).length, 4)
  assert.deepEqual(sortNotes(rows, 'updated').map(row => row.id)[0], 'pinned')
  // The input array is never reordered in place.
  assert.equal(rows[0].id, 'undated')
})

test('tags, counts and idea-to-task conversion', () => {
  const rows = [
    note({ id: 'a', tags: ['Work', 'money'] }),
    note({ id: 'b', tags: ['work'] }),
    note({ id: 'c', type: 'task', done: true, date: '2026-10-05' }),
    note({ id: 'd', type: 'task', date: '2026-10-06' }),
    note({ id: 'e', archived: true }),
  ]
  assert.deepEqual(noteTags(rows), ['money', 'Work'])
  assert.deepEqual(noteCounts(rows), { total: 5, ideas: 3, openTasks: 1, done: 1, dated: 2, archived: 1 })
  const task = asTask(note({ type: 'idea' }))
  assert.equal(task.type, 'task')
  assert.equal(task.done, false)
  assert.equal(task.body, 'Buy more paper')
})

test('a date-only note reminds at 09:00 local, a timed note relative to its time', () => {
  const dateOnly = note({ date: '2026-10-05', remindMinutesBefore: 0 })
  assert.equal(noteReminderAt(dateOnly), new Date(2026, 9, 5, 9, 0, 0, 0).getTime())
  assert.equal(noteReminderAt(note({ date: '2026-10-05', remindMinutesBefore: 15 })), new Date(2026, 9, 5, 8, 45).getTime())
  const timed = note({ date: '2026-10-05', time: '14:30', remindMinutesBefore: 60 })
  assert.equal(noteReminderAt(timed), new Date(2026, 9, 5, 13, 30).getTime())
  assert.equal(noteReminderAt(note({ date: '2026-10-05', time: '14:30', remindMinutesBefore: 1440 })), new Date(2026, 9, 4, 14, 30).getTime())
  assert.equal(noteReminderAt(note({ remindMinutesBefore: 15 })), null)
  assert.equal(noteReminderAt(note({ date: '2026-10-05' })), null)
  assert.deepEqual([...REMINDER_CHOICES], [0, 15, 60, 1440])
})

test('notes are encrypted like every other record and appear in the encrypted backup only', async () => {
  await createOrChangePin('123456')
  await importBackup(fixture(), 'replace')
  const stored = await getAll<Note>('notes')
  assert.equal(stored.length, fixture().notes.length)
  const raw = await readSnapshot()
  const serialized = JSON.stringify(raw)
  assert.ok(!serialized.includes('Order the new labels'), 'note text leaked into the vault')
  assert.ok(!serialized.includes('supplier'))
  await unlockPin('123456')
  assert.equal((await exportBackup()).notes.length, 1)
})

test('adding, editing, archiving and deleting notes goes through the vault', async () => {
  await createOrChangePin('123456')
  await importBackup(fixture(), 'replace')
  const created = await add<Note>('notes', emptyNote())
  assert.ok(created.id)
  assert.equal((await getAll<Note>('notes')).length, 2)
  const archived = await update<Note>('notes', created.id, { archived: true })
  assert.equal(archived.archived, true)
  assert.equal((await getAll<Note>('notes')).find(row => row.id === created.id)!.archived, true)
  await remove('notes', created.id)
  assert.equal((await getAll<Note>('notes')).length, 1)
})

test('resetApp and the lock both clear the notebook', async () => {
  await createOrChangePin('123456')
  await importBackup(fixture(), 'replace')
  assert.equal((await getAll<Note>('notes')).length, 1)
  await resetApp()
  assert.equal((await getAll<Note>('notes').catch(() => [])).length, 0)
  await createOrChangePin('123456')
  await importBackup(fixture(), 'replace')
  lockVault()
  await assert.rejects(getAll<Note>('notes'), /locked/)
})

test('an older backup migrates with an empty notebook and everything else untouched', () => {
  const legacy = fixture() as unknown as Record<string, unknown>
  delete legacy.notes
  legacy.version = '3.1.0'
  const migrated = migrateBackup(JSON.parse(JSON.stringify(legacy)))
  assert.equal(migrated.version, BACKUP_VERSION)
  assert.deepEqual(migrated.notes, [])
  const original = fixture()
  for (const key of Object.keys(original)) {
    if (key === 'notes' || key === 'version') continue
    assert.deepEqual((migrated as unknown as Record<string, unknown>)[key], (original as unknown as Record<string, unknown>)[key], key)
  }
  assert.doesNotThrow(() => validateBackup(migrated))
  // A file that already carries notes keeps them exactly as they were.
  const withNotes = migrateBackup(JSON.parse(JSON.stringify(fixture())))
  assert.deepEqual(withNotes.notes, fixture().notes)
})

test('import rejects a note the editor could never produce', async () => {
  const cases: Record<string, unknown>[] = [
    { body: 'x'.repeat(MAX_NOTE_BODY + 1), tags: [], type: 'idea', pinned: false, archived: false, done: false },
    { body: 'ok', tags: [], type: 'reminder', pinned: false, archived: false, done: false },
    { body: 'ok', tags: [], type: 'idea', pinned: 'yes', archived: false, done: false },
    { body: 'ok', tags: ['x'.repeat(MAX_TAG_LENGTH + 1)], type: 'idea', pinned: false, archived: false, done: false },
    { body: 'ok', tags: Array.from({ length: MAX_TAGS + 1 }, () => 'tag'), type: 'idea', pinned: false, archived: false, done: false },
    { body: 'ok', tags: [], type: 'idea', pinned: false, archived: false, done: false, color: 'hotpink' },
    { body: 'ok', tags: [], type: 'idea', pinned: false, archived: false, done: false, date: '05/10/2026' },
    { body: 'ok', tags: [], type: 'idea', pinned: false, archived: false, done: false, date: '2026-10-05', time: '9:30' },
    { body: 'ok', tags: [], type: 'idea', pinned: false, archived: false, done: false, time: '09:30' },
    { body: 'ok', tags: [], type: 'idea', pinned: false, archived: false, done: false, date: '2026-10-05', remindMinutesBefore: 5 },
    { body: 'ok', tags: [], type: 'idea', pinned: false, archived: false, done: false, remindMinutesBefore: 15 },
    { body: 'ok', tags: [], type: 'idea', pinned: false, archived: false, done: false, linkedCustomerId: 'x'.repeat(65) },
    { body: 'ok', tags: [], type: 'idea', pinned: false, archived: false, done: false, title: 'x'.repeat(MAX_NOTE_TITLE + 1) },
  ]
  await createOrChangePin('123456')
  await importBackup(fixture(), 'replace')
  const before = await exportBackup()
  for (const [index, patch] of cases.entries()) {
    const incoming = { ...fixture(), notes: [{ id: `bad-${index}`, createdAt: 1, updatedAt: 1, ...patch }] } as unknown as ReturnType<typeof fixture>
    await assert.rejects(importBackup(incoming, 'replace'), /Invalid backup record/, `case ${index}`)
    assert.deepEqual((await exportBackup()).notes, before.notes, `case ${index} changed data`)
  }
})

test('a file with more notes than the cap is refused before anything is written', async () => {
  await createOrChangePin('123456')
  await importBackup(fixture(), 'replace')
  const many = Array.from({ length: MAX_RECORDS_PER_STORE + 1 }, (_, index) => ({
    id: `note-${index}`, body: 'x', tags: [] as string[], type: 'idea' as const, pinned: false, archived: false, done: false, createdAt: 1, updatedAt: 1,
  }))
  await assert.rejects(importBackup({ ...fixture(), notes: many }, 'replace'), /too many records/)
  assert.equal((await exportBackup()).notes.length, 1)
})

test('ids stay unique so two quick captures never overwrite each other', () => {
  const ids = new Set(Array.from({ length: 200 }, () => generateId()))
  assert.equal(ids.size, 200)
})
