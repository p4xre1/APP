import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DRAFT_DELAY, DRAFT_KEY, DRAFT_MAX_AGE, createDraftSaver, draftHasContent, draftOf, readDraft, saveDraft,
  type DraftIo, type NoteDraft,
} from '../src/lib/notes-draft'

/**
 * The draft lives outside the vault, so the tests use a small in-memory backend with
 * the same shape as the real one: what is "stored" is the sealed blob, and the key
 * that opens it disappears with the session - exactly what a reset does.
 */
function memoryIo(store: Record<string, string> = {}) {
  let key = 'session-key'
  const io: DraftIo = {
    async read() { return store[DRAFT_KEY] ?? null },
    async write(value) { store[DRAFT_KEY] = value },
    async clear() { delete store[DRAFT_KEY] },
    // A reversible "cipher" that is visibly not the plain text.
    async seal(plain) { return `sealed:${key}:${Buffer.from(plain, 'utf8').toString('base64')}` },
    async open(sealed) {
      const [, sealedKey, payload] = sealed.split(':')
      if (sealedKey !== key) throw new Error('wrong key')
      return Buffer.from(payload, 'base64').toString('utf8')
    },
  }
  return { io, store, rotateKey() { key = 'other-session' } }
}

const draft: NoteDraft = { body: 'Call the supplier', tags: ['work'], type: 'idea', savedAt: 1_000 }

test('a draft round-trips through storage and is stored sealed, never as plain text', async () => {
  const { io, store } = memoryIo()
  await saveDraft(draft, io)
  assert.ok(store[DRAFT_KEY].startsWith('sealed:'))
  assert.ok(!store[DRAFT_KEY].includes('supplier'))
  const read = await readDraft(io, 2_000)
  assert.equal(read?.body, 'Call the supplier')
  assert.deepEqual(read?.tags, ['work'])
})

test('an empty draft clears the stored value instead of saving blanks', async () => {
  const { io, store } = memoryIo()
  await saveDraft(draft, io)
  await saveDraft({ body: '   ', savedAt: 2 }, io)
  assert.equal(store[DRAFT_KEY], undefined)
  assert.equal(await readDraft(io, 3_000), null)
  assert.equal(draftHasContent({ body: '', savedAt: 1 }), false)
  assert.equal(draftHasContent({ body: '', title: 'T', savedAt: 1 }), true)
})

test('a draft written under another key is dropped quietly, not shown as garbage', async () => {
  const { io, store, rotateKey } = memoryIo()
  await saveDraft(draft, io)
  rotateKey()
  assert.equal(await readDraft(io, 2_000), null)
  assert.equal(store[DRAFT_KEY], undefined, 'the unreadable draft stays on disk')
})

test('a damaged or hand-edited value is dropped instead of breaking the editor', async () => {
  const { io, store } = memoryIo()
  store[DRAFT_KEY] = 'not even json'
  assert.equal(await readDraft(io, 2_000), null)
  store[DRAFT_KEY] = JSON.stringify({ body: 42, savedAt: 1 })
  assert.equal(await readDraft(io, 2_000), null)
})

test('a stale draft is dropped, a recent one is offered', async () => {
  const { io } = memoryIo()
  await saveDraft(draft, io)
  assert.equal(await readDraft(io, draft.savedAt + DRAFT_MAX_AGE - 1) !== null, true)
  assert.equal(await readDraft(io, draft.savedAt + DRAFT_MAX_AGE + 1), null)
})

test('only the fields the editor owns survive a draft write', () => {
  const clean = draftOf({
    body: 'b'.repeat(4_000), title: '  T  ', tags: ['x', 'x'], color: 'hotpink',
    date: '05/10/2026', time: '09:30', remindMinutesBefore: 5, id: 'note-9', createdAt: 1,
    noteId: 'note-1', savedAt: 0,
  } as never, 777)
  assert.equal(clean.body.length, 2_000)
  assert.equal(clean.title, 'T')
  assert.deepEqual(clean.tags, ['x'])
  assert.equal(clean.color, undefined)
  // A time without a date cannot survive, because the calendar could not place it.
  assert.equal(clean.date, undefined)
  assert.equal(clean.time, undefined)
  assert.equal(clean.remindMinutesBefore, undefined)
  assert.equal(clean.noteId, 'note-1')
  assert.equal(clean.savedAt, 777)
  assert.equal((clean as unknown as Record<string, unknown>).id, undefined)
})

test('typing bursts collapse into one write and flush() makes the last value durable', async () => {
  const writes: NoteDraft[] = []
  const timers: (() => void)[] = []
  const clock = {
    setTimeout: (fn: () => void) => { timers.push(fn); return timers.length as unknown as ReturnType<typeof setTimeout> },
    clearTimeout: (handle: ReturnType<typeof setTimeout>) => { timers[(handle as unknown as number) - 1] = () => undefined },
  }
  const saver = createDraftSaver(async value => { writes.push(value) }, DRAFT_DELAY, clock as never)
  saver.push({ body: 'a', savedAt: 1 })
  saver.push({ body: 'ab', savedAt: 2 })
  saver.push({ body: 'abc', savedAt: 3 })
  assert.equal(writes.length, 0, 'nothing is written while the user keeps typing')
  for (const timer of timers) timer()
  await saver.flush()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].body, 'abc')
  // The screen is hidden: the pending value must be written now, not in 400 ms.
  saver.push({ body: 'abcd', savedAt: 4 })
  await saver.flush()
  assert.equal(writes.length, 2)
  assert.equal(writes[1].body, 'abcd')
  // Re-writing the same value is a no-op, so a flush loop cannot hammer storage.
  await saver.flush()
  assert.equal(writes.length, 2)
  // Cancel drops what was pending: a saved note must not come back as a draft.
  saver.push({ body: 'gone', savedAt: 5 })
  saver.cancel()
  await saver.flush()
  assert.equal(writes.length, 2)
})

test('a storage failure never breaks typing', async () => {
  const saver = createDraftSaver(async () => { throw new Error('quota') }, 0)
  saver.push({ body: 'still typed', savedAt: 1 })
  await assert.doesNotReject(() => saver.flush())
})
