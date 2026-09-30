/**
 * Fatorati Offline - Notebook (ideas, tasks and notes)
 *
 * Everything here is pure and local. A note is plain text: no HTML, no markup and
 * no rendering of user input anywhere, so a body can only ever be shown as text.
 *
 * Dates are local calendar dates (YYYY-MM-DD) handled the same way as subscriptions:
 * parsed without going through Date, so no DST jump or time zone can move a note to
 * another day. A time (HH:mm) is optional, and a reminder is expressed as "minutes
 * before that moment" instead of an absolute instant, which is what keeps a note in
 * the right place after a phone changes time zone.
 */

import { isISODate, parseISODate } from './subscriptions'
import { normalizeSearch } from './text-search'
import type { Note, NoteColorId, NoteType } from '../store/types'

export const NOTE_TYPES: NoteType[] = ['idea', 'task', 'note']

/**
 * Note colours. Every one of them reaches at least 4.5:1 against white, so the same
 * value is readable as text and as a filled chip with white text on it
 * (`tests/notes.test.ts` checks the ratio for each one). `none` is the default and
 * means "no colour", not "white".
 */
export const NOTE_COLORS: { id: NoteColorId; label: string; hex: string | null }[] = [
  { id: 'none', label: 'No color', hex: null },
  { id: 'slate', label: 'Slate', hex: '#334155' },
  { id: 'blue', label: 'Blue', hex: '#1d4ed8' },
  { id: 'indigo', label: 'Indigo', hex: '#4f46e5' },
  { id: 'violet', label: 'Violet', hex: '#6d28d9' },
  { id: 'rose', label: 'Rose', hex: '#be123c' },
  { id: 'orange', label: 'Orange', hex: '#c2410c' },
  { id: 'amber', label: 'Amber', hex: '#a16207' },
  { id: 'green', label: 'Green', hex: '#15803d' },
  { id: 'teal', label: 'Teal', hex: '#0f766e' },
]

/** Length caps. The backup validator refuses anything above them. */
export const MAX_NOTE_TITLE = 120
export const MAX_NOTE_BODY = 2000
export const MAX_TAGS = 10
export const MAX_TAG_LENGTH = 24
export const MAX_NOTE_TEXT = 2000
export const MAX_LINK_ID = 64

/** Reminder offsets, in minutes before the note's own time. */
export const REMINDER_CHOICES = [0, 15, 60, 1440] as const
export const REMINDER_LABEL: Record<number, string> = {
  0: 'At the time',
  15: '15 minutes before',
  60: '1 hour before',
  1440: '1 day before',
}

/** A note with a date but no time reminds at 09:00 local, like subscriptions do. */
export const DEFAULT_REMINDER_HOUR = 9

export const NOTE_SORTS = ['updated', 'date', 'created'] as const
export type NoteSort = typeof NOTE_SORTS[number]
export const NOTE_STATES = ['all', 'open', 'done'] as const
export type NoteState = typeof NOTE_STATES[number]
export const DATED_FILTERS = ['all', 'dated', 'undated'] as const
export type DatedFilter = typeof DATED_FILTERS[number]

export const isNoteType = (value: unknown): value is NoteType => typeof value === 'string' && (NOTE_TYPES as string[]).includes(value)
export const isNoteColor = (value: unknown): value is NoteColorId => typeof value === 'string' && NOTE_COLORS.some(color => color.id === value)
export const isReminderChoice = (value: unknown): value is number => typeof value === 'number' && (REMINDER_CHOICES as readonly number[]).includes(value)
export const noteColorHex = (id: NoteColorId | undefined): string | null => NOTE_COLORS.find(color => color.id === id)?.hex ?? null

const TIME_PATTERN = /^([01][0-9]|2[0-3]):([0-5][0-9])$/
export const isNoteTime = (value: unknown): value is string => typeof value === 'string' && TIME_PATTERN.test(value)

/** Tags are trimmed, de-duplicated case-insensitively and capped. */
export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of value) {
    if (typeof raw !== 'string') continue
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
    if (tags.length >= MAX_TAGS) break
  }
  return tags
}

/** Splits a comma or newline separated tag field into clean tag values. */
export const parseTags = (value: string): string[] => normalizeTags(value.split(/[,\n]/))

export const formatTags = (tags: string[] | undefined): string => (tags ?? []).join(', ')

/**
 * The text a list row shows: the title, else the first non-empty line of the body.
 * The caller translates 'Untitled note' when the result is empty.
 */
export function noteTitle(note: Pick<Note, 'title' | 'body'>): string {
  const title = (note.title || '').trim()
  if (title) return title
  const line = (note.body || '').split(/\r?\n/).map(row => row.trim()).find(Boolean)
  return (line || '').slice(0, MAX_NOTE_TITLE)
}

/** First characters of the body, for the list preview. */
export function noteExcerpt(note: Pick<Note, 'body'>, length = 140): string {
  const flat = (note.body || '').replace(/\s+/g, ' ').trim()
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat
}

/** Validation shared by the editor and the tests. Returns an i18n key, or null. */
export function validateNote(input: { body: string; title?: string; tags?: string[]; time?: string; date?: string; remindMinutesBefore?: number }): string | null {
  if (!input.body.trim() && !(input.title || '').trim()) return 'Write something first'
  if ((input.body || '').length > MAX_NOTE_BODY) return 'This note is too long'
  if ((input.title || '').length > MAX_NOTE_TITLE) return 'This title is too long'
  if ((input.tags ?? []).length > MAX_TAGS) return 'Too many tags'
  if ((input.time || '') && !isNoteTime(input.time)) return 'Enter a time like 09:30'
  if (input.time && !isISODate(input.date)) return 'Choose a date for the reminder'
  if (input.remindMinutesBefore !== undefined && !isReminderChoice(input.remindMinutesBefore)) return 'Choose a reminder'
  if (input.remindMinutesBefore !== undefined && !isISODate(input.date)) return 'Choose a date for the reminder'
  return null
}

/**
 * Completes and clamps a stored or imported note. Used by the vault's write path and
 * by the backup migration, so a note that was written by an older build - or by a
 * hand-edited file that only passes the coarse checks - always lands in a valid shape.
 */
export function normalizeNote(row: Record<string, unknown>): Record<string, unknown> {
  const note = { ...row }
  note.body = String(note.body ?? '').slice(0, MAX_NOTE_BODY)
  const title = String(note.title ?? '').trim().slice(0, MAX_NOTE_TITLE)
  if (title) note.title = title
  else delete note.title
  note.tags = normalizeTags(note.tags)
  note.pinned = note.pinned === true
  note.archived = note.archived === true
  note.done = note.done === true
  note.type = isNoteType(note.type) ? note.type : 'idea'
  if (!isNoteColor(note.color)) delete note.color
  if (!isISODate(note.date)) delete note.date
  if (!isNoteTime(note.time) || !isISODate(note.date)) delete note.time
  if (!isReminderChoice(note.remindMinutesBefore) || !isISODate(note.date)) delete note.remindMinutesBefore
  for (const key of ['linkedCustomerId', 'linkedInvoiceId', 'linkedProjectId'] as const) {
    const value = typeof note[key] === 'string' ? (note[key] as string).trim().slice(0, MAX_LINK_ID) : ''
    if (value) note[key] = value
    else delete note[key]
  }
  return note
}

/** True when a note is scheduled: a date is what puts it on the calendar. */
export const isDated = (note: Note): boolean => isISODate(note.date)

export interface NoteFilters {
  query: string
  type: NoteType | 'all'
  tag: string | 'all'
  dated: DatedFilter
  state: NoteState
  archived: boolean
}

export const DEFAULT_FILTERS: NoteFilters = { query: '', type: 'all', tag: 'all', dated: 'all', state: 'all', archived: false }

/** Search covers the title, the body and the tags, ignoring case and accents. */
export function matchesQuery(note: Note, query: string): boolean {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = normalizeSearch(`${note.title || ''} ${note.body} ${(note.tags || []).join(' ')}`)
  return words.every(word => haystack.includes(word))
}

export function filterNotes(notes: Note[], filters: NoteFilters): Note[] {
  return notes.filter(note => {
    if ((note.archived === true) !== filters.archived) return false
    if (filters.type !== 'all' && note.type !== filters.type) return false
    if (filters.tag !== 'all' && !(note.tags || []).some(tag => tag.toLowerCase() === filters.tag.toLowerCase())) return false
    if (filters.dated === 'dated' && !isDated(note)) return false
    if (filters.dated === 'undated' && isDated(note)) return false
    if (filters.state === 'done' && !(note.type === 'task' && note.done)) return false
    if (filters.state === 'open' && note.type === 'task' && note.done) return false
    return matchesQuery(note, filters.query)
  })
}

/**
 * List order. Pinned notes always come first; then the chosen key. 'date' puts the
 * undated notes last (they have no place on a timeline) and sorts by day number, so
 * a DST day is neither skipped nor repeated.
 */
export function sortNotes(notes: Note[], sort: NoteSort): Note[] {
  const key = (note: Note) => {
    if (sort === 'date') return note.date ? parseISODate(note.date)!.year * 10000 + parseISODate(note.date)!.month * 100 + parseISODate(note.date)!.day : Number.MAX_SAFE_INTEGER
    if (sort === 'created') return note.createdAt
    return note.updatedAt
  }
  return [...notes].sort((a, b) => {
    const pinned = Number(b.pinned === true) - Number(a.pinned === true)
    if (pinned !== 0) return pinned
    // Only the "by date" order is a timeline; the other orders stay chronological in
    // their own key so "Last changed" really means the last one the user touched.
    if (sort === 'date') {
      const dated = Number(!a.date) - Number(!b.date)
      if (dated !== 0) return dated
      if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1
    }
    const difference = key(b) - key(a)
    if (difference !== 0) return difference
    return a.id.localeCompare(b.id)
  })
}

/** Tags in use, for the filter list. */
export function noteTags(notes: Note[]): string[] {
  const tags = new Map<string, string>()
  for (const note of notes) for (const tag of note.tags || []) if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag)
  return [...tags.values()].sort((a, b) => a.localeCompare(b))
}

/** Counts for the header line of the Notebook. */
export function noteCounts(notes: Note[]): { total: number; ideas: number; openTasks: number; done: number; dated: number; archived: number } {
  return {
    total: notes.length,
    ideas: notes.filter(note => note.type === 'idea').length,
    openTasks: notes.filter(note => note.type === 'task' && !note.done).length,
    done: notes.filter(note => note.type === 'task' && note.done).length,
    dated: notes.filter(isDated).length,
    archived: notes.filter(note => note.archived === true).length,
  }
}

/** Turning an idea into a task keeps the text and adds the task marker. */
export function asTask(note: Note): Note {
  return { ...note, type: 'task', done: false, updatedAt: Date.now() }
}

/**
 * When a note should remind, as epoch milliseconds built in the device's local
 * calendar. Returns null when the note has no date or no reminder chosen. A note
 * with a time reminds relative to that time; a date-only note reminds at 09:00.
 */
export function noteReminderAt(note: Note, hour = DEFAULT_REMINDER_HOUR): number | null {
  if (!isISODate(note.date) || !isReminderChoice(note.remindMinutesBefore)) return null
  const [year, month, day] = note.date.split('-').map(Number)
  const [hours, minutes] = isNoteTime(note.time) ? note.time.split(':').map(Number) : [hour, 0]
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime() - note.remindMinutesBefore * 60_000
}

/** "HH:mm" of a note, or null for a date-only note. */
export const noteTime = (note: Note): string | null => (isNoteTime(note.time) ? note.time : null)

/** Empty note used by the quick capture and the editor. */
export function emptyNote(now = Date.now()): Omit<Note, 'id' | 'createdAt' | 'updatedAt'> {
  void now
  return { body: '', tags: [], pinned: false, archived: false, type: 'idea', done: false }
}
