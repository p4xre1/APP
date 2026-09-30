import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, CheckCircle2, ListTodo, Pencil, Plus, Search, X } from 'lucide-react'
import { showAlert, askConfirm } from '../lib/dialogs'
import NoteList, { TYPE_LABEL } from '../components/NoteList'
import { errorText, useI18n } from '../i18n'
import { useFatorati } from '../store/useFatorati'
import { requestReminderPermission, reminderPermission } from '../lib/notifications'
import { clearDraft, createDraftSaver, draftOf, readDraft, saveDraft, type NoteDraft } from '../lib/notes-draft'
import { takeIntent } from '../lib/navigation-intent'
import {
  DEFAULT_FILTERS, MAX_NOTE_BODY, MAX_NOTE_TITLE, MAX_TAGS, NOTE_COLORS, NOTE_STATES, NOTE_TYPES, REMINDER_CHOICES, REMINDER_LABEL,
  asTask, filterNotes, formatTags, isNoteColor, noteCounts, noteTags, parseTags, sortNotes, validateNote,
  type DatedFilter, type NoteFilters, type NoteSort, type NoteState,
} from '../lib/notes'
import { isISODate } from '../lib/subscriptions'
import type { ModuleKey, Note, NoteColorId, NoteType } from '../store/types'

const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'
const labelClass = 'block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]'

/** Editor state: everything the note editor owns, with the numbers kept as text. */
interface EditorState {
  id?: string
  title: string
  body: string
  tags: string
  color: NoteColorId
  type: NoteType
  done: boolean
  pinned: boolean
  archived: boolean
  date: string
  time: string
  remind: string
  linkedCustomerId: string
  linkedInvoiceId: string
  linkedProjectId: string
}

const emptyEditor: EditorState = {
  title: '', body: '', tags: '', color: 'none', type: 'idea', done: false, pinned: false, archived: false,
  date: '', time: '', remind: 'none', linkedCustomerId: '', linkedInvoiceId: '', linkedProjectId: '',
}

function editorOf(note: Note): EditorState {
  return {
    id: note.id,
    title: note.title || '',
    body: note.body,
    tags: formatTags(note.tags),
    color: isNoteColor(note.color) ? note.color : 'none',
    type: note.type,
    done: note.done === true,
    pinned: note.pinned === true,
    archived: note.archived === true,
    date: note.date || '',
    time: note.time || '',
    remind: note.remindMinutesBefore === undefined ? 'none' : String(note.remindMinutesBefore),
    linkedCustomerId: note.linkedCustomerId || '',
    linkedInvoiceId: note.linkedInvoiceId || '',
    linkedProjectId: note.linkedProjectId || '',
  }
}

/** The stored shape of the editor: trimmed, capped, and without empty optional fields. */
function payloadOf(editor: EditorState) {
  const tags = parseTags(editor.tags)
  const remind = editor.remind === 'none' ? undefined : Number(editor.remind)
  return {
    ...(editor.title.trim() ? { title: editor.title.trim().slice(0, MAX_NOTE_TITLE) } : { title: undefined }),
    body: editor.body.slice(0, MAX_NOTE_BODY),
    tags,
    ...(editor.color !== 'none' ? { color: editor.color } : { color: undefined }),
    type: editor.type,
    done: editor.type === 'task' ? editor.done : false,
    pinned: editor.pinned,
    archived: editor.archived,
    ...(isISODate(editor.date) ? { date: editor.date } : { date: undefined }),
    ...(isISODate(editor.date) && editor.time ? { time: editor.time } : { time: undefined }),
    ...(isISODate(editor.date) && remind !== undefined ? { remindMinutesBefore: remind } : { remindMinutesBefore: undefined }),
    ...(editor.linkedCustomerId ? { linkedCustomerId: editor.linkedCustomerId } : { linkedCustomerId: undefined }),
    ...(editor.linkedInvoiceId ? { linkedInvoiceId: editor.linkedInvoiceId } : { linkedInvoiceId: undefined }),
    ...(editor.linkedProjectId ? { linkedProjectId: editor.linkedProjectId } : { linkedProjectId: undefined }),
  }
}

const draftOfEditor = (editor: EditorState, now = Date.now()): NoteDraft => draftOf({
  ...(editor.id ? { noteId: editor.id } : {}),
  title: editor.title, body: editor.body, tags: parseTags(editor.tags),
  ...(editor.color !== 'none' ? { color: editor.color } : {}),
  type: editor.type, done: editor.done,
  ...(isISODate(editor.date) ? { date: editor.date } : {}),
  ...(editor.time ? { time: editor.time } : {}),
  ...(editor.remind !== 'none' ? { remindMinutesBefore: Number(editor.remind) } : {}),
  ...(editor.linkedCustomerId ? { linkedCustomerId: editor.linkedCustomerId } : {}),
  ...(editor.linkedInvoiceId ? { linkedInvoiceId: editor.linkedInvoiceId } : {}),
  ...(editor.linkedProjectId ? { linkedProjectId: editor.linkedProjectId } : {}),
}, now)

function editorOfDraft(draft: NoteDraft): EditorState {
  return {
    ...emptyEditor,
    ...(draft.noteId ? { id: draft.noteId } : {}),
    title: draft.title || '',
    body: draft.body,
    tags: formatTags(draft.tags),
    ...(draft.color ? { color: draft.color } : {}),
    ...(draft.type ? { type: draft.type } : {}),
    done: draft.done === true,
    date: draft.date || '',
    time: draft.time || '',
    remind: draft.remindMinutesBefore === undefined ? 'none' : String(draft.remindMinutesBefore),
    linkedCustomerId: draft.linkedCustomerId || '',
    linkedInvoiceId: draft.linkedInvoiceId || '',
    linkedProjectId: draft.linkedProjectId || '',
  }
}

export default function Notebook({ onNavigate }: { onNavigate?: (key: ModuleKey) => void }) {
  const { t, language } = useI18n()
  const { notes, customers, invoices, projects, addNote, updateNote, deleteNote, resyncReminders } = useFatorati()
  const [filters, setFilters] = useState<NoteFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<NoteSort>('updated')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [capture, setCapture] = useState('')
  const [notice, setNotice] = useState('')
  const [draftOffer, setDraftOffer] = useState<NoteDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const saver = useRef<ReturnType<typeof createDraftSaver> | null>(null)
  if (!saver.current) saver.current = createDraftSaver(saveDraft)

  const visible = useMemo(() => sortNotes(filterNotes(notes, filters), sort), [notes, filters, sort])
  const tags = useMemo(() => noteTags(notes), [notes])
  const counts = useMemo(() => noteCounts(notes), [notes])
  // Linked record names by note id: a deleted target simply has no entry.
  const links = useMemo(() => {
    const names = new Map<string, string>()
    for (const note of notes) {
      const linked = customers.find(row => row.id === note.linkedCustomerId)?.name
        || invoices.find(row => row.id === note.linkedInvoiceId)?.number
        || projects.find(row => row.id === note.linkedProjectId)?.name
      if (linked) names.set(note.id, linked)
    }
    return names
  }, [notes, customers, invoices, projects])

  /** Autosave: a debounced write, plus a flush when the app goes to the background. */
  const queueDraft = useCallback((next: EditorState) => { saver.current?.push(draftOfEditor(next)) }, [])
  useEffect(() => {
    const flush = () => { void saver.current?.flush() }
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); flush() }
  }, [])

  // A note opened from the calendar: the intent is consumed once, then dropped.
  useEffect(() => {
    const id = takeIntent('notebook')
    if (!id) return
    const note = notes.find(row => row.id === id)
    if (note) setEditor(editorOf(note))
  }, [notes])

  function openEditor(note: Note) { setEditor(editorOf(note)); setDraftOffer(null) }

  /** A new note. An unfinished draft is offered again instead of being overwritten. */
  async function openCapture(full = false) {
    let draft: NoteDraft | null = null
    try { draft = await readDraft() } catch { draft = null }
    if (draft) { setDraftOffer(draft); setEditor(editorOfDraft(draft)) }
    else setEditor({ ...emptyEditor, ...(full ? { type: 'note' as NoteType } : {}) })
    setNotice('')
    window.setTimeout(() => bodyRef.current?.focus(), 60)
  }

  async function save(editorState: EditorState) {
    const payload = payloadOf(editorState)
    const invalid = validateNote({ body: payload.body, title: payload.title, tags: payload.tags, time: payload.time, date: payload.date, remindMinutesBefore: payload.remindMinutesBefore })
    if (invalid) { await showAlert(t(invalid)); return false }
    setBusy(true)
    try {
      if (editorState.id) await updateNote(editorState.id, payload)
      else await addNote(payload)
      saver.current?.cancel()
      await clearDraft()
      setDraftOffer(null)
      setEditor(null)
      setCapture('')
      if (payload.remindMinutesBefore !== undefined) {
        // The permission is asked here, when the user chooses a reminder, never at start.
        const permission = await reminderPermission()
        if (permission === 'prompt') {
          const next = await requestReminderPermission()
          if (next !== 'granted') setNotice(t('Notification permission is refused. Open the phone settings and allow notifications for Fatorati.'))
          // Granted in the middle of the save: the plan is rebuilt now, otherwise the
          // reminder would only appear at the next launch.
          else void resyncReminders()
        } else if (permission === 'denied') setNotice(t('Notification permission is refused. Open the phone settings and allow notifications for Fatorati.'))
      }
      return true
    } catch (error) { await showAlert(errorText(error)); return false } finally { setBusy(false) }
  }

  async function quickSave() {
    const body = capture.trim()
    if (!body) { await openCapture(true); return }
    const ok = await save({ ...emptyEditor, body })
    if (ok) setCapture('')
  }

  async function togglePin(note: Note) {
    try { await updateNote(note.id, { pinned: !note.pinned }) } catch (error) { await showAlert(errorText(error)) }
  }

  async function setArchived(note: Note, archived: boolean) {
    try { await updateNote(note.id, { archived }) } catch (error) { await showAlert(errorText(error)) }
  }

  async function remove(note: Note) {
    if (!await askConfirm(t('Delete this note? This cannot be undone.'))) return
    try { await deleteNote(note.id) } catch (error) { await showAlert(errorText(error)) }
  }

  async function toggleDone(note: Note) {
    if (note.type !== 'task') { await convert(note); return }
    try { await updateNote(note.id, { done: !note.done }) } catch (error) { await showAlert(errorText(error)) }
  }

  async function convert(note: Note) {
    try { await updateNote(note.id, asTask(note)) } catch (error) { await showAlert(errorText(error)) }
  }

  const filterRow = <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg bg-canvas ps-3">
        <Search className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
        <input type="search" aria-label={t('Search notes...')} placeholder={t('Search notes...')} value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} className="min-h-12 flex-1 bg-transparent text-[13.5px] outline-none" />
      </div>
      <select aria-label={t('Type')} value={filters.type} onChange={event => setFilters({ ...filters, type: event.target.value as NoteType | 'all' })} className={`${inputClass} w-auto`}>
        <option value="all">{t('All types')}</option>
        {NOTE_TYPES.map(type => <option key={type} value={type}>{t(TYPE_LABEL[type])}</option>)}
      </select>
      <select aria-label={t('Tag')} value={filters.tag} onChange={event => setFilters({ ...filters, tag: event.target.value })} className={`${inputClass} w-auto`}>
        <option value="all">{t('All tags')}</option>
        {tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
      </select>
      <select aria-label={t('Date')} value={filters.dated} onChange={event => setFilters({ ...filters, dated: event.target.value as DatedFilter })} className={`${inputClass} w-auto`}>
        <option value="all">{t('All dates')}</option>
        <option value="dated">{t('With a date')}</option>
        <option value="undated">{t('Without a date')}</option>
      </select>
      <select aria-label={t('Tasks')} value={filters.state} onChange={event => setFilters({ ...filters, state: event.target.value as NoteState })} className={`${inputClass} w-auto`}>
        {NOTE_STATES.map(state => <option key={state} value={state}>{t(state === 'all' ? 'All tasks' : state === 'open' ? 'Open' : 'Done')}</option>)}
      </select>
      <select aria-label={t('Sort by')} value={sort} onChange={event => setSort(event.target.value as NoteSort)} className={`${inputClass} w-auto`}>
        <option value="updated">{t('Last changed')}</option>
        <option value="date">{t('Date')}</option>
        <option value="created">{t('Created')}</option>
      </select>
      <label className="flex min-h-12 items-center gap-2 text-[13px] text-ink">
        <input type="checkbox" checked={filters.archived} onChange={event => setFilters({ ...filters, archived: event.target.checked })} />
        {t('Archive')}
      </label>
    </div>
  </div>

  const editorView = editor && <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas p-4 sm:p-6">
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold text-ink">{editor.id ? t('Edit note') : t('New note')}</h2>
        <button onClick={() => { void saver.current?.flush(); setEditor(null) }} aria-label={t('Close')} className="grid h-12 w-12 place-items-center rounded-lg text-muted hover:bg-ink/5"><X className="h-5 w-5" /></button>
      </div>
      {draftOffer && <p role="status" className="rounded-lg bg-warn-50 p-3 text-[12.5px] text-warn">{t('An unsaved draft was restored. Save it or replace it.')}</p>}

      <div className="space-y-3.5 rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <label className="block">
          <span className={labelClass}>{t('Title (optional)')}</span>
          <input aria-label={t('Title (optional)')} maxLength={MAX_NOTE_TITLE} value={editor.title} onChange={event => { const next = { ...editor, title: event.target.value }; setEditor(next); queueDraft(next) }} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>{t('Note')}</span>
          <textarea ref={bodyRef} aria-label={t('Note')} rows={8} maxLength={MAX_NOTE_BODY} value={editor.body}
            onChange={event => { const next = { ...editor, body: event.target.value }; setEditor(next); queueDraft(next) }} className={`${inputClass} min-h-[8rem]`} />
          <span className="mt-1 block text-[11.5px] text-muted">{t('Plain text only. {count} characters left.', { count: MAX_NOTE_BODY - editor.body.length })}</span>
        </label>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{t('Type')}</span>
            <select aria-label={t('Type')} value={editor.type} onChange={event => { const next = { ...editor, type: event.target.value as NoteType }; setEditor(next); queueDraft(next) }} className={inputClass}>
              {NOTE_TYPES.map(type => <option key={type} value={type}>{t(TYPE_LABEL[type])}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>{t('Tags')}</span>
            <input aria-label={t('Tags')} list="note-tags" value={editor.tags} onChange={event => { const next = { ...editor, tags: event.target.value }; setEditor(next); queueDraft(next) }} className={inputClass} />
            <datalist id="note-tags">{tags.map(tag => <option key={tag} value={tag} />)}</datalist>
            <span className="mt-1 block text-[11.5px] text-muted">{t('Separate tags with commas. Up to {count}.', { count: MAX_TAGS })}</span>
          </label>
        </div>

        <div>
          <span className={labelClass}>{t('Color')}</span>
          <div className="flex flex-wrap gap-2">
            {NOTE_COLORS.map(color => <button key={color.id} type="button" aria-label={`${t('Color')} ${t(color.label)}`} aria-pressed={color.id === editor.color}
              onClick={() => { const next = { ...editor, color: color.id }; setEditor(next); queueDraft(next) }}
              className={`h-12 w-12 rounded-lg border transition-all active:scale-[0.98] ${color.id === editor.color ? 'border-ink ring-2 ring-brand/25' : 'border-line-strong'}`}
              style={color.hex ? { backgroundColor: color.hex } : { backgroundImage: 'linear-gradient(135deg,#ffffff 45%,#cbd5e1 45%,#cbd5e1 55%,#ffffff 55%)' }} />)}
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>{t('Date')}</span>
            <input aria-label={t('Date')} type="date" value={editor.date} onChange={event => { const next = { ...editor, date: event.target.value, ...(event.target.value ? {} : { time: '', remind: 'none' }) }; setEditor(next); queueDraft(next) }} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>{t('Time')}</span>
            <input aria-label={t('Time')} type="time" value={editor.time} disabled={!isISODate(editor.date)} onChange={event => { const next = { ...editor, time: event.target.value }; setEditor(next); queueDraft(next) }} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>{t('Reminder')}</span>
            <select aria-label={t('Reminder')} value={editor.remind} disabled={!isISODate(editor.date)} onChange={event => { const next = { ...editor, remind: event.target.value }; setEditor(next); queueDraft(next) }} className={inputClass}>
              <option value="none">{t('No reminder')}</option>
              {REMINDER_CHOICES.map(choice => <option key={choice} value={choice}>{t(REMINDER_LABEL[choice])}</option>)}
            </select>
          </label>
        </div>
        <p className="text-[12px] text-muted">{t('A note with a date but no time reminds at 09:00. A reminder without a date is not scheduled.')}</p>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>{t('Customer')}</span>
            <select aria-label={t('Customer')} value={editor.linkedCustomerId} onChange={event => { const next = { ...editor, linkedCustomerId: event.target.value }; setEditor(next); queueDraft(next) }} className={inputClass}>
              <option value="">—</option>
              {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>{t('Invoice')}</span>
            <select aria-label={t('Invoice')} value={editor.linkedInvoiceId} onChange={event => { const next = { ...editor, linkedInvoiceId: event.target.value }; setEditor(next); queueDraft(next) }} className={inputClass}>
              <option value="">—</option>
              {invoices.map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.number}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>{t('Project')}</span>
            <select aria-label={t('Project')} value={editor.linkedProjectId} onChange={event => { const next = { ...editor, linkedProjectId: event.target.value }; setEditor(next); queueDraft(next) }} className={inputClass}>
              <option value="">—</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
        </div>
        <p className="text-[12px] text-muted">{t('A link is optional and disappears from the screen if the record is deleted; the note itself stays.')}</p>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex min-h-12 items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={editor.pinned} onChange={event => { const next = { ...editor, pinned: event.target.checked }; setEditor(next); queueDraft(next) }} />{t('Pin to the top')}
          </label>
          <label className="flex min-h-12 items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={editor.archived} onChange={event => { const next = { ...editor, archived: event.target.checked }; setEditor(next); queueDraft(next) }} />{t('Archive')}
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => void save(editor)} className="min-h-12 rounded-lg bg-brand px-5 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-40">{t('Save')}</button>
          {editor.id && editor.type !== 'task' && <button disabled={busy} onClick={() => { const next = { ...editor, type: 'task' as NoteType, done: false }; setEditor(next); queueDraft(next) }} className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-canvas px-4 py-2 text-[13px] text-ink"><ListTodo className="h-4 w-4" />{t('Convert idea to task')}</button>}
          {editor.id && editor.type === 'task' && <button disabled={busy} onClick={() => { const next = { ...editor, done: !editor.done }; setEditor(next); queueDraft(next) }} className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-canvas px-4 py-2 text-[13px] text-ink"><CheckCircle2 className="h-4 w-4" />{editor.done ? t('Mark as open') : t('Mark done')}</button>}
          <button disabled={busy} onClick={() => { void saver.current?.flush(); setEditor(null) }} className="min-h-12 rounded-lg bg-canvas px-5 py-2 text-[13px] text-ink">{t('Cancel')}</button>
        </div>
        <p className="text-[12px] text-muted">{t('Everything is stored encrypted on this phone. The editor keeps a draft while you type, so nothing is lost if the app is closed.')}</p>
      </div>
    </div>
  </div>

  return <div className="space-y-5 pb-24">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Notebook')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('Ideas, notes and tasks • 100% Local • Offline')}</p>
        <p className="mt-1 text-[12px] text-muted">{t('{total} notes · {open} open tasks · {dated} with a date', { total: counts.total, open: counts.openTasks, dated: counts.dated })}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => void openCapture(true)} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink"><Pencil className="h-4 w-4" />{t('New note')}</button>
        <button onClick={() => onNavigate?.('calendar')} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink"><BellRing className="h-4 w-4" />{t('Calendar')}</button>
        <button onClick={() => void openCapture()} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98]"><Plus className="h-4 w-4" />{t('Quick idea')}</button>
      </div>
    </div>

    {notice && <p role="status" className="rounded-xl border border-warn/40 bg-warn-50 p-3 text-[12.5px] text-warn">{notice}</p>}

    <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <label className={labelClass}>{t('Quick idea')}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label={t('Quick idea')} value={capture} placeholder={t('Write it down before it is gone...')} onChange={event => setCapture(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') void quickSave() }} className={`${inputClass} min-w-[12rem] flex-1`} />
        <button disabled={busy} onClick={() => void quickSave()} className="min-h-12 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-40">{t('Save')}</button>
        <button onClick={() => void openCapture(true)} className="min-h-12 rounded-lg bg-canvas px-4 py-2 text-[13px] text-ink">{t('More options')}</button>
      </div>
      <p className="mt-2 text-[12px] text-muted">{t('Type the idea and tap Save: it becomes an idea you can turn into a task later.')}</p>
    </div>

    {notes.length > 0 && filterRow}

    <NoteList
      notes={visible}
      links={links}
      handlers={{ onOpen: openEditor, onToggleDone: note => void toggleDone(note), onConvert: note => void convert(note), onTogglePin: note => void togglePin(note), onArchive: note => void setArchived(note, !note.archived), onDelete: note => void remove(note) }}
      disabled={busy}
      variant={notes.length === 0 ? 'empty' : 'none'}
      archivedView={filters.archived}
      onQuickIdea={() => void openCapture()}
    />

    <p className="text-[12px] text-muted">{t('Notes are encrypted like every other record and travel in the encrypted backup. They are never added to the CSV or PDF exports.')}</p>

    {/* Quick capture: one tap to open, one to save. */}
    <button onClick={() => void openCapture()} aria-label={t('Quick idea')}
      className="fixed bottom-6 end-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-lg transition-all hover:bg-brand-700 active:scale-95">
      <Plus className="h-6 w-6" aria-hidden="true" />
    </button>

    {editorView}
  </div>
}
