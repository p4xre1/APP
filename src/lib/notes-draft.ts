/**
 * Fatorati Offline - Notebook draft autosave
 *
 * Typing in the notebook must never be lost, not even when Android kills the WebView
 * while the user is in another app. The editor therefore keeps a draft outside the
 * screen: it is written shortly after typing stops, flushed when the screen goes to
 * the background, and offered again the next time the editor opens.
 *
 * The draft holds note text, so it is sealed with the same vault key as every other
 * record before it is stored: what Preferences holds is ciphertext, and a draft
 * written before an app reset cannot be read afterwards because the key is gone.
 */

import { Preferences } from '@capacitor/preferences'
import { decryptRecord, encryptRecord } from './vault'
import { normalizeNote } from './notes'
import type { NoteColorId, NoteType } from '../store/types'

export const DRAFT_KEY = 'fatorati.notes.draft.v1'
/** A draft older than this is not worth interrupting the user with. */
export const DRAFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000
/** Typing pause before a draft is written, in milliseconds. */
export const DRAFT_DELAY = 400

export interface NoteDraft {
  /** Absent for a new note. */
  noteId?: string
  title?: string
  body: string
  tags?: string[]
  color?: NoteColorId
  type?: NoteType
  done?: boolean
  date?: string
  time?: string
  remindMinutesBefore?: number
  linkedCustomerId?: string
  linkedInvoiceId?: string
  linkedProjectId?: string
  /** When the draft was last written; a stale one is dropped instead of offered. */
  savedAt: number
}

/** Storage plus the sealing function, injectable so the tests need no vault. */
export interface DraftIo {
  read(): Promise<string | null>
  write(value: string): Promise<void>
  clear(): Promise<void>
  seal(plain: string): Promise<string>
  open(sealed: string): Promise<string>
}

const VAULT_DRAFT_ID = 'note-draft'

/** Seals the draft with the session key: the stored value is ciphertext, never text. */
export const vaultDraftIo: DraftIo = {
  async read() { const { value } = await Preferences.get({ key: DRAFT_KEY }); return value ?? null },
  async write(value) { await Preferences.set({ key: DRAFT_KEY, value }) },
  async clear() { await Preferences.remove({ key: DRAFT_KEY }) },
  async seal(plain) {
    const record = await encryptRecord('notes', { id: VAULT_DRAFT_ID, createdAt: 0, updatedAt: Date.now(), payload: plain })
    return JSON.stringify(record)
  },
  async open(sealed) {
    const record = JSON.parse(sealed) as { id: string; payload?: string }
    const plain = await decryptRecord('notes', record as unknown as Parameters<typeof decryptRecord>[1])
    return String((plain as unknown as { payload?: string }).payload ?? '')
  },
}

/** Only the fields the editor owns survive: nothing else can be smuggled into a draft. */
export function draftOf(note: Partial<NoteDraft> & { body: string }, now = Date.now()): NoteDraft {
  const clean = normalizeNote({ ...note, id: 'draft', createdAt: now, updatedAt: now }) as unknown as Record<string, unknown>
  return {
    ...(typeof clean.title === 'string' ? { title: clean.title } : {}),
    body: String(clean.body ?? ''),
    ...(clean.color ? { color: clean.color as NoteColorId } : {}),
    ...(clean.type ? { type: clean.type as NoteType } : {}),
    ...(clean.date ? { date: String(clean.date) } : {}),
    ...(clean.time ? { time: String(clean.time) } : {}),
    ...(typeof clean.remindMinutesBefore === 'number' ? { remindMinutesBefore: clean.remindMinutesBefore } : {}),
    tags: (clean.tags as string[]) ?? [],
    done: clean.done === true,
    ...(typeof clean.linkedCustomerId === 'string' ? { linkedCustomerId: clean.linkedCustomerId } : {}),
    ...(typeof clean.linkedInvoiceId === 'string' ? { linkedInvoiceId: clean.linkedInvoiceId } : {}),
    ...(typeof clean.linkedProjectId === 'string' ? { linkedProjectId: clean.linkedProjectId } : {}),
    ...(note.noteId ? { noteId: note.noteId } : {}),
    savedAt: now,
  }
}

/** True when the draft carries something worth keeping. */
export const draftHasContent = (draft: NoteDraft): boolean => Boolean(draft.body.trim() || (draft.title || '').trim())

export async function saveDraft(draft: NoteDraft, io: DraftIo = vaultDraftIo): Promise<void> {
  if (!draftHasContent(draft)) { await clearDraft(io); return }
  await io.write(await io.seal(JSON.stringify(draft)))
}

/**
 * Reads the stored draft. A value that is damaged, older than the cap or empty is
 * dropped rather than shown, so a half-written blob can never block the editor.
 */
export async function readDraft(io: DraftIo = vaultDraftIo, now = Date.now()): Promise<NoteDraft | null> {
  let sealed: string | null = null
  try { sealed = await io.read() } catch { return null }
  if (!sealed) return null
  try {
    const draft = JSON.parse(await io.open(sealed)) as NoteDraft
    if (!draft || typeof draft.body !== 'string' || !draftHasContent(draft)) { await clearDraft(io); return null }
    if (!Number.isFinite(draft.savedAt) || now - draft.savedAt > DRAFT_MAX_AGE) { await clearDraft(io); return null }
    return draft
  } catch {
    // A draft written under an older key, or a damaged value: discard it quietly.
    await clearDraft(io).catch(() => undefined)
    return null
  }
}

export async function clearDraft(io: DraftIo = vaultDraftIo): Promise<void> {
  try { await io.clear() } catch { /* Nothing stored, or the platform refused. */ }
}

export interface DraftSaver {
  /** Queues a write; typing again simply moves the deadline. */
  push(draft: NoteDraft): void
  /** Writes immediately - used when the screen is hidden or closed. */
  flush(): Promise<void>
  cancel(): void
}

/**
 * Debounced writer: a burst of keystrokes produces one write, and `flush()` makes the
 * pending value durable. The timers are injectable so the tests can run without waiting.
 */
export function createDraftSaver(save: (draft: NoteDraft) => Promise<void>, delay = DRAFT_DELAY, clock = { setTimeout, clearTimeout }): DraftSaver {
  let pending: NoteDraft | null = null
  let handle: ReturnType<typeof setTimeout> | null = null
  let lastWritten = ''
  const run = async () => {
    if (handle) { clock.clearTimeout(handle); handle = null }
    const draft = pending
    pending = null
    if (!draft) return
    const serialized = JSON.stringify(draft)
    if (serialized === lastWritten) return
    lastWritten = serialized
    try { await save(draft) } catch { /* A draft is best effort; the editor keeps the text. */ }
  }
  return {
    push(draft) {
      pending = draft
      if (handle) clock.clearTimeout(handle)
      handle = clock.setTimeout(() => { void run() }, delay)
    },
    flush: run,
    cancel() { if (handle) clock.clearTimeout(handle); handle = null; pending = null },
  }
}
