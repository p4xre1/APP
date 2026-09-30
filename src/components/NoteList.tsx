import { Archive, ArchiveRestore, CheckCircle2, Lightbulb, ListTodo, Pin, PinOff, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n'
import { formatDate } from '../lib/format'
import { REMINDER_LABEL, formatTags, isNoteColor, noteColorHex, noteExcerpt, noteTitle } from '../lib/notes'
import type { Note, NoteType } from '../store/types'

/**
 * The notebook list, kept apart from the screen so it can be rendered with fixture data
 * in a server render (the screen itself reads the zustand store, whose server snapshot
 * is always the empty initial state). Everything here is presentational: the screen
 * owns the storage calls.
 */

export const TYPE_LABEL: Record<NoteType, string> = { idea: 'Idea', task: 'Task', note: 'Note' }

/** Row icon per type. The written label always sits next to it, never colour alone. */
export function TypeIcon({ type, className }: { type: NoteType; className?: string }) {
  if (type === 'task') return <ListTodo className={className} />
  if (type === 'note') return <StickyNote className={className} />
  return <Lightbulb className={className} />
}

export interface NoteHandlers {
  onOpen: (note: Note) => void
  onToggleDone: (note: Note) => void
  onConvert: (note: Note) => void
  onTogglePin: (note: Note) => void
  onArchive: (note: Note) => void
  onDelete: (note: Note) => void
}

export interface NoteListProps {
  notes: Note[]
  /** Linked-record names by note id; a deleted target simply has no entry. */
  links?: Map<string, string>
  handlers: NoteHandlers
  disabled?: boolean
  /** 'empty' is the first-run explanation, 'none' is a filter that matched nothing. */
  variant?: 'empty' | 'none'
  archivedView?: boolean
  onQuickIdea?: () => void
  className?: string
}

export function NoteRow({ note, link, handlers, disabled }: { note: Note; link?: string; handlers: NoteHandlers; disabled?: boolean }) {
  const { t, language } = useI18n()
  const color = isNoteColor(note.color) ? noteColorHex(note.color) : null
  const reminder = note.remindMinutesBefore === undefined ? null : t(REMINDER_LABEL[note.remindMinutesBefore] || 'Reminder')
  const action = 'grid h-12 w-12 place-items-center rounded-lg hover:bg-canvas'
  return <li className="p-4 hover:bg-canvas">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <button onClick={() => handlers.onOpen(note)} className="min-w-0 flex-1 text-start">
        <span className="flex items-center gap-2">
          {color && <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
          <TypeIcon type={note.type} className="h-4 w-4 shrink-0 text-brand" />
          <span className={`truncate text-[13.5px] font-semibold text-ink ${note.done ? 'line-through' : ''}`}>{noteTitle(note) || t('Untitled note')}</span>
          {note.pinned === true && <Pin className="h-3.5 w-3.5 shrink-0 text-warn" aria-label={t('Pinned')} />}
        </span>
        {noteExcerpt(note) && <span className="mt-1 block text-[12.5px] text-muted">{noteExcerpt(note)}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-faint">
          <span>{t(TYPE_LABEL[note.type])}{note.type === 'task' ? ` · ${note.done ? t('Done') : t('Open')}` : ''}</span>
          {note.date && <span>· {formatDate(note.date, false, language)}{note.time ? ` ${note.time}` : ''}</span>}
          {reminder && <span>· {t('Reminder')}: {reminder}</span>}
          {formatTags(note.tags).split(', ').filter(Boolean).map(tag => <span key={tag} className="rounded-full bg-canvas px-2 py-0.5">#{tag}</span>)}
          {link && <span>· {link}</span>}
        </span>
      </button>
      <div className="flex items-center gap-1">
        {note.type === 'task' && <button disabled={disabled} onClick={() => handlers.onToggleDone(note)} aria-label={note.done ? t('Mark as open') : t('Mark done')} className={action}><CheckCircle2 className={`h-4 w-4 ${note.done ? 'text-emerald-brand' : 'text-muted'}`} /></button>}
        {note.type !== 'task' && <button disabled={disabled} onClick={() => handlers.onConvert(note)} aria-label={t('Convert idea to task')} className={action}><ListTodo className="h-4 w-4 text-muted" /></button>}
        <button disabled={disabled} onClick={() => handlers.onTogglePin(note)} aria-label={note.pinned === true ? t('Unpin') : t('Pin to the top')} className={action}>{note.pinned === true ? <PinOff className="h-4 w-4 text-warn" /> : <Pin className="h-4 w-4 text-muted" />}</button>
        <button disabled={disabled} onClick={() => handlers.onArchive(note)} aria-label={note.archived === true ? t('Restore from archive') : t('Archive')} className={action}>{note.archived === true ? <ArchiveRestore className="h-4 w-4 text-muted" /> : <Archive className="h-4 w-4 text-muted" />}</button>
        <button disabled={disabled} onClick={() => handlers.onDelete(note)} aria-label={t('Delete')} className={action}><Trash2 className="h-4 w-4 text-serious" /></button>
      </div>
    </div>
  </li>
}

export default function NoteList({ notes, links, handlers, disabled, variant = 'none', archivedView = false, onQuickIdea, className = '' }: NoteListProps) {
  const { t } = useI18n()
  if (notes.length === 0) {
    return <div className={`overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      <div className="px-5 py-12 text-center">
        {variant === 'empty' ? <>
          <StickyNote className="mx-auto h-8 w-8 text-faint" aria-hidden="true" />
          <p className="mt-3 text-[13.5px] font-semibold text-ink">{t('Nothing in the notebook yet')}</p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-muted">{t('Keep ideas, notes and tasks on this phone. Write a line with the quick box, give it a date and it also appears in the calendar next to your invoices and renewals. Everything stays encrypted on this device.')}</p>
          {onQuickIdea && <button onClick={onQuickIdea} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98]"><Plus className="h-4 w-4" />{t('Quick idea')}</button>}
        </> : <p className="text-[13px] text-muted">{archivedView ? t('Nothing in the archive') : t('No results')}</p>}
      </div>
    </div>
  }
  return <div className={`overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
    <ul className="divide-y divide-line">
      {notes.map(note => <NoteRow key={note.id} note={note} link={links?.get(note.id)} handlers={handlers} disabled={disabled} />)}
    </ul>
  </div>
}
