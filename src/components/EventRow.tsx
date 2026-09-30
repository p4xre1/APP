import { useI18n } from '../i18n'
import { formatDate } from '../lib/format'
import type { CalendarItem } from '../lib/calendar'
import EventIcon from './EventIcon'

/** The written label of every group, printed next to the icon in each row. */
export const GROUP_LABEL: Record<CalendarItem['group'], string> = {
  notes: 'Notes and tasks', invoices: 'Invoices', subscriptions: 'Subscriptions', estimates: 'Estimates',
}

/**
 * One calendar row, shared by the month view, the day agenda and the dashboard card so
 * the three can never drift apart. The kind is always spelled out: icon *and* label.
 */
export default function EventRow({ item, onOpen, showDate = false, className = '' }: {
  item: CalendarItem
  onOpen: (item: CalendarItem) => void
  showDate?: boolean
  className?: string
}) {
  const { t, language } = useI18n()
  return <button onClick={() => onOpen(item)} className={`flex w-full min-h-12 items-center gap-3 p-3 text-start hover:bg-canvas ${className}`}>
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.overdue ? 'bg-serious-50 text-serious' : 'bg-brand-50 text-brand-700'}`}>
      <EventIcon item={item} className="h-4 w-4" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className={`text-[13px] font-semibold ${item.done ? 'text-muted line-through' : 'text-ink'}`}>{t(item.label)}</span>
        {item.overdue && <span className="rounded-full bg-serious-50 px-2 py-0.5 text-[11px] font-semibold text-serious">{t('Overdue')}</span>}
        {item.time && <span className="text-[11.5px] text-muted">{item.time}</span>}
      </span>
      <span className="mt-0.5 block truncate text-[12px] text-muted">
        {item.detail}{showDate ? ` · ${formatDate(item.date, false, language)}` : ''}
      </span>
    </span>
    <span className="text-[11.5px] text-faint">{t(GROUP_LABEL[item.group])}</span>
  </button>
}
