import { useI18n } from '../i18n'
import { formatDate } from '../lib/format'
import { daySummary, type CalendarDay } from '../lib/calendar'

/**
 * The month grid, kept presentational for the same reason as the list components: the
 * screen supplies the days and the counts, this draws them. Every cell carries a
 * sentence for screen readers ("3 items"), never a bare dot, and the arrows that move
 * between months flip under `[dir="rtl"]` through the shared `directional` class.
 */
export default function MonthGrid({ days, counts, firstDay, today, selected, columns, label, onSelect }: {
  days: CalendarDay[]
  counts: Map<string, number>
  firstDay: 0 | 1 | 6
  today: string
  selected: string
  columns: string[]
  label: string
  onSelect: (date: string) => void
}) {
  const { t, language } = useI18n()
  return <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-bold text-ink" aria-live="polite">{label}</h2>
      <p className="text-[12px] text-muted">{t('Week starts on {day}', { day: t(`firstDay.${firstDay}`) })}</p>
    </div>
    <table className="w-full table-fixed border-collapse" aria-label={label}>
      <thead>
        <tr>{columns.map(column => <th key={column} scope="col" className="pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{column}</th>)}</tr>
      </thead>
      <tbody>
        {Array.from({ length: Math.ceil(days.length / 7) }, (_, week) => <tr key={week}>
          {days.slice(week * 7, week * 7 + 7).map(day => {
            const count = counts.get(day.date) ?? 0
            const summary = daySummary(count)
            const isToday = day.date === today
            const isSelected = day.date === selected
            return <td key={day.date} className="p-0.5 align-top">
              <button onClick={() => onSelect(day.date)}
                aria-label={`${formatDate(day.date, false, language)}: ${t(summary.key, { count: summary.count })}`}
                aria-current={isToday ? 'date' : undefined}
                className={`flex h-16 w-full flex-col items-center justify-center gap-1 rounded-lg border text-[13px] transition-colors ${isSelected ? 'border-brand bg-brand-50 text-brand-700' : isToday ? 'border-brand/40 bg-surface text-ink' : day.inMonth ? 'border-line bg-surface text-ink' : 'border-transparent bg-canvas text-faint'}`}>
                <span className={isToday ? 'font-bold' : ''}>{day.day}</span>
                {count > 0 && <span className="flex items-center gap-1">
                  <span aria-hidden="true" className="flex gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }, (_, dot) => <span key={dot} className="h-1.5 w-1.5 rounded-full bg-brand" />)}
                  </span>
                  <span className="text-[10.5px] font-semibold text-muted">{count}</span>
                </span>}
              </button>
            </td>
          })}
        </tr>)}
      </tbody>
    </table>
    <p className="mt-3 text-[12px] text-muted">{t('Each day shows its number of items, and every row is labelled for screen readers.')}</p>
  </div>
}
