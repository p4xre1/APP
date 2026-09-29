import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, FileText, Wallet } from 'lucide-react'
import { useI18n, usePreferences } from '../i18n'
import { useFatorati } from '../store/useFatorati'
import { formatDate, money, number as formatNumber } from '../lib/format'
import { addMonths, calendarEvents, dayTotals, eventsByDate, monthGrid, monthLabel, type CalendarEvent, type CalendarEventKind } from '../lib/calendar'
import { fieldInputClass, fieldLabelClass } from '../components/Field'

const kindIcon: Record<CalendarEventKind, typeof FileText> = {
  'invoice-due': FileText, 'estimate-expiry': ClipboardList, payment: Wallet,
}
const kindLabel: Record<CalendarEventKind, string> = {
  'invoice-due': 'Due date', 'estimate-expiry': 'Expiry date', payment: 'Payment date',
}

/** Month view of invoice due dates, estimate expiry dates and payment dates. Works offline. */
export default function Calendar() {
  const { t } = useI18n()
  const prefs = usePreferences()
  const { invoices, estimates, customers, projects } = useFatorati()
  const today = new Date().toISOString().slice(0, 10)
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [selected, setSelected] = useState<string | null>(today)
  const [expanded, setExpanded] = useState<string | null>(null)

  const events = useMemo(() => calendarEvents({
    invoices, estimates, customers, projects, defaultCurrency: prefs.defaultCurrency, today, timeZone: prefs.timeZone,
  }), [invoices, estimates, customers, projects, prefs.defaultCurrency, prefs.timeZone, today])
  const byDate = useMemo(() => eventsByDate(events), [events])
  const grid = monthGrid(month, prefs.firstDay)
  const weekdayLabels = useMemo(() => Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(prefs.language, { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2026, 0, 4 + (prefs.firstDay + index) % 7))), [prefs.language, prefs.firstDay])
  const dayEvents = selected ? byDate.get(selected) || [] : []
  const dayCounts = useMemo(() => { const counts = new Map<string, { total: number; overdue: number }>(); for (const event of events) { const row = counts.get(event.date) || { total: 0, overdue: 0 }; row.total++; if (event.overdue) row.overdue++; counts.set(event.date, row) } return counts }, [events])
  const monthEvents = events.filter(event => event.date.startsWith(month))
  const overdueCount = monthEvents.filter(event => event.overdue).length

  return <div className="space-y-6">
    <div>
      <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Calendar')}</h1>
      <p className="text-[13px] text-muted mt-1">{t('Due dates, estimate expiry dates and payment dates')} • {t('100% Local • Offline')}</p>
    </div>

    <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <button type="button" aria-label={t('Previous month')} onClick={() => setMonth(addMonths(month, -1))} className="grid h-11 w-11 place-items-center rounded-lg border border-line-strong text-ink hover:bg-canvas"><ChevronLeft className="directional h-5 w-5" /></button>
        <div className="text-center">
          <p className="text-[15px] font-bold text-ink">{monthLabel(month, prefs.language, prefs.digits)}</p>
          <p className="text-[12px] text-muted">{t('{count} items', { count: monthEvents.length })}{overdueCount ? ` • ${t('{count} overdue', { count: overdueCount })}` : ''}</p>
        </div>
        <button type="button" aria-label={t('Next month')} onClick={() => setMonth(addMonths(month, 1))} className="grid h-11 w-11 place-items-center rounded-lg border border-line-strong text-ink hover:bg-canvas"><ChevronRight className="directional h-5 w-5" /></button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => { setMonth(today.slice(0, 7)); setSelected(today) }} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-[12.5px] font-semibold text-brand-700"><CalendarDays className="h-4 w-4" />{t('Today')}</button>
        <label className="block">
          <span className={fieldLabelClass}>{t('Jump to date')}</span>
          <input type="date" aria-label={t('Jump to date')} value={selected || today} onChange={event => { setSelected(event.target.value); setMonth(event.target.value.slice(0, 7)) }} className={`${fieldInputClass} max-w-[190px]`} />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {weekdayLabels.map(label => <span key={label} className="pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</span>)}
        {grid.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />
          const counts = dayCounts.get(date)
          const isToday = date === today
          const isSelected = date === selected
          const total = dayTotals(byDate.get(date) || [])
          return <button
            key={date}
            type="button"
            onClick={() => { setSelected(date); setExpanded(null) }}
            aria-pressed={isSelected}
            aria-label={`${formatDate(date, false, prefs.language)}${counts ? ` — ${counts.total}` : ''}`}
            className={`flex min-h-12 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-[13px] transition-colors ${
              isSelected ? 'border-brand bg-brand-50 text-brand-700'
              : counts?.overdue ? 'border-serious/30 bg-serious-50 text-serious'
              : 'border-transparent text-ink hover:bg-canvas'
            } ${isToday && !isSelected ? 'ring-1 ring-inset ring-brand/40' : ''}`}
          >
            <span className={`tnum font-semibold ${isToday ? 'underline decoration-2 underline-offset-2' : ''}`}>{formatNumber(Number(date.slice(8, 10)), prefs.language)}</span>
            <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
              {counts ? Array.from({ length: Math.min(counts.total - counts.overdue, 3) }, (_, dot) => <span key={`ok-${dot}`} className="h-1.5 w-1.5 rounded-full bg-brand" />) : null}
              {counts?.overdue ? Array.from({ length: Math.min(counts.overdue, 3) }, (_, dot) => <span key={`late-${dot}`} className="h-1.5 w-1.5 rounded-full bg-serious" />) : null}
            </span>
            {total.length > 0 && <span className="tnum mt-0.5 text-[10px] text-muted">{money(total[0].total, total[0].currency, true, prefs.language)}</span>}
          </button>
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" />{t('Due dates')} · {t('Expiry date')} · {t('Payment date')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-serious" />{t('Overdue')}</span>
      </div>
    </div>

    <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold text-ink">{selected ? formatDate(selected, false, prefs.language) : t('Pick a day')}</h2>
        <span className="text-[12px] text-muted">{t('{count} items', { count: dayEvents.length })}</span>
      </div>
      {dayEvents.length === 0
        ? <p className="py-8 text-center text-[13px] text-muted">{t('Nothing on this day')}</p>
        : <ul className="mt-3 divide-y divide-line">
            {dayEvents.map(event => {
              const Icon = kindIcon[event.kind]
              const isOpen = expanded === event.id
              return <li key={event.id}>
                <button onClick={() => setExpanded(isOpen ? null : event.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 py-3 text-start text-[13px] hover:bg-canvas">
                  <Icon className={`h-4 w-4 shrink-0 ${event.overdue ? 'text-serious' : 'text-brand'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${event.overdue ? 'text-serious' : 'text-ink'}`}>{event.number}</p>
                    <p className="truncate text-[12px] text-muted">{[t(kindLabel[event.kind]), event.party, event.project, t(event.status)].filter(Boolean).join(' • ')}</p>
                  </div>
                  <span className={`tnum shrink-0 font-bold ${event.overdue ? 'text-serious' : 'text-ink'}`}>{money(event.amount, event.currency, false, event.language)}</span>
                </button>
                {isOpen && <div className="mb-3 space-y-1.5 rounded-lg bg-canvas p-3 text-[12.5px]">
                  <div className="flex justify-between gap-3"><span className="text-muted">{t('Type')}</span><span>{t(kindLabel[event.kind])}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted">{t('Date')}</span><span>{formatDate(event.date, false, event.language)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted">{t('Customer')}</span><span>{event.party || t('Unknown')}</span></div>
                  {event.project && <div className="flex justify-between gap-3"><span className="text-muted">{t('Project')}</span><span>{event.project}</span></div>}
                  <div className="flex justify-between gap-3"><span className="text-muted">{t('Status')}</span><span className={event.overdue ? 'font-semibold text-serious' : ''}>{t(event.status)}</span></div>
                  <div className="flex justify-between gap-3 font-bold"><span>{t('Amount')}</span><span className="tnum">{money(event.amount, event.currency, false, event.language)}</span></div>
                </div>}
              </li>
            })}
          </ul>}
      {dayEvents.length > 0 && <div className="mt-3 space-y-1 border-t border-line pt-3">
        {dayTotals(dayEvents).map(row => <p key={row.currency} className="flex justify-between text-[13px] font-semibold text-ink">
          <span>{t('Day total')} ({row.currency})</span><span className="tnum">{money(row.total, row.currency, false, prefs.language)}</span>
        </p>)}
      </div>}
    </div>

    <p className="text-[12px] text-muted">{t('Payment dates come from invoices marked as Paid.')}</p>
  </div>
}
