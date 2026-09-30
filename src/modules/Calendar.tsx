import { useMemo, useState } from 'react'
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import EventRow, { GROUP_LABEL } from '../components/EventRow'
import MonthGrid from '../components/MonthGrid'
import { useI18n, usePreferences } from '../i18n'
import { useFatorati } from '../store/useFatorati'
import { formatDate, locale } from '../lib/format'
import { moduleForGroup, setIntent } from '../lib/navigation-intent'
import {
  CALENDAR_GROUPS, DEFAULT_FILTERS, collectCalendarItems, dayCounts, daySummary, gridRange, groupByDate, itemsInRange, itemsOn,
  monthGrid, shiftMonth, weekdayLabels, type CalendarGroup, type CalendarItem,
} from '../lib/calendar'
import { reminderSettings } from '../lib/notifications'
import { todayISO } from '../lib/subscriptions'
import type { ModuleKey } from '../store/types'

export default function Calendar({ onNavigate }: { onNavigate?: (key: ModuleKey) => void }) {
  const { t, language } = useI18n()
  const { notes, invoices, subscriptions, estimates, settings, addNote } = useFatorati()
  const today = todayISO()
  const [cursor, setCursor] = useState(() => {
    const parsed = today.split('-').map(Number)
    return { year: parsed[0], month: parsed[1] }
  })
  const [selected, setSelected] = useState(today)
  const [groups, setGroups] = useState<CalendarGroup[]>(DEFAULT_FILTERS)
  const [adding, setAdding] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  // The week starts on the day chosen in Settings (Monday by default).
  const firstDay = usePreferences().firstDay
  const days = useMemo(() => monthGrid(cursor.year, cursor.month, firstDay), [cursor, firstDay])
  const range = useMemo(() => gridRange(cursor.year, cursor.month, firstDay), [cursor, firstDay])
  const items = useMemo(() => collectCalendarItems({ notes, invoices, subscriptions, estimates }, { today, warn: reminderSettings(settings).warn }), [notes, invoices, subscriptions, estimates, today, settings])
  // Only the visible window is computed, so a large notebook stays responsive.
  const visible = useMemo(() => itemsInRange(items, range.from, range.to, groups), [items, range, groups])
  const byDate = useMemo(() => groupByDate(visible), [visible])
  const counts = useMemo(() => dayCounts(visible), [visible])
  const selectedItems = useMemo(() => itemsOn(itemsInRange(items, selected, selected, groups), selected), [items, selected, groups])
  const columns = useMemo(() => weekdayLabels(locale(language), firstDay), [language, firstDay])
  const label = new Intl.DateTimeFormat(locale(language), { month: 'long', year: 'numeric' }).format(new Date(cursor.year, cursor.month - 1, 1))

  function move(delta: number) {
    setCursor(current => shiftMonth(current.year, current.month, delta))
  }

  function open(item: CalendarItem) {
    setIntent(item.group === 'notes' ? 'notebook' : item.group === 'invoices' ? 'invoices' : item.group === 'estimates' ? 'estimates' : 'subscriptions', item.id)
    onNavigate?.(moduleForGroup(item.group))
  }

  async function addOn(date: string) {
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    try {
      await addNote({ body, tags: [], pinned: false, archived: false, type: 'idea', done: false, date })
      setDraft('')
      setAdding(null)
      setSelected(date)
    } finally { setBusy(false) }
  }

  const todayDay = today.split('-').map(Number)

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Calendar')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('Notes, due invoices, renewals and estimate expiries in one month view.')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => move(-1)} aria-label={t('Previous month')} className="grid h-12 w-12 place-items-center rounded-lg border border-line-strong bg-surface text-muted transition-colors hover:text-ink"><ChevronLeft className="h-5 w-5 directional" /></button>
        <button onClick={() => { setCursor({ year: todayDay[0], month: todayDay[1] }); setSelected(today) }} className="min-h-12 rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-medium text-ink">{t('Today')}</button>
        <button onClick={() => move(1)} aria-label={t('Next month')} className="grid h-12 w-12 place-items-center rounded-lg border border-line-strong bg-surface text-muted transition-colors hover:text-ink"><ChevronRight className="h-5 w-5 directional" /></button>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      {CALENDAR_GROUPS.map(group => <label key={group} className="flex min-h-12 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[12.5px] text-ink">
        <input type="checkbox" checked={groups.includes(group)} onChange={event => setGroups(current => event.target.checked ? [...current, group] : current.filter(entry => entry !== group))} />
        {t(GROUP_LABEL[group])}
      </label>)}
    </div>

    <MonthGrid days={days} counts={counts} firstDay={firstDay} today={today} selected={selected} columns={columns} label={label} onSelect={date => { setSelected(date); setAdding(null) }} />

    <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold text-ink">{formatDate(selected, false, language)}</h2>
        <button onClick={() => { setAdding(selected); setDraft('') }} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98]">
          <CalendarPlus className="h-4 w-4" />{t('Add note on this date')}
        </button>
      </div>

      {adding === selected && <div className="mb-3 space-y-2 rounded-lg bg-canvas p-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Note')}</span>
          <input autoFocus aria-label={t('Note')} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void addOn(selected) }} placeholder={t('Write it down before it is gone...')} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy || !draft.trim()} onClick={() => void addOn(selected)} className="min-h-12 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40">{t('Add')}</button>
          <button onClick={() => { setAdding(null); setDraft('') }} className="min-h-12 rounded-lg bg-surface px-4 py-2 text-[13px] text-ink">{t('Cancel')}</button>
          <button onClick={() => { setIntent('notebook', ''); onNavigate?.('notebook') }} className="min-h-12 rounded-lg bg-surface px-4 py-2 text-[13px] text-ink">{t('Open the notebook')}</button>
        </div>
      </div>}

      {selectedItems.length === 0
        ? <p className="py-6 text-center text-[13px] text-muted">{t('Nothing on this day.')}</p>
        : <ul className="divide-y divide-line">
          {selectedItems.map(item => <li key={item.key}><EventRow item={item} onOpen={open} /></li>)}
        </ul>}
    </div>

    <p className="text-[12px] text-muted">{t('Paid invoices and cancelled subscriptions are not listed. Estimate expiries only appear while an estimate is still open.')}</p>
    <p className="text-[12px] text-muted">{t('Dates are local calendar dates: a change of time zone or a daylight-saving day never moves an item.')}</p>

    {groups.length === 0 && <p role="status" className="rounded-xl border border-warn/40 bg-warn-50 p-3 text-[12.5px] text-warn">{t('Every type is switched off, so the calendar is empty.')}</p>}
    <button onClick={() => setGroups(DEFAULT_FILTERS)} className={`${groups.length === DEFAULT_FILTERS.length ? 'hidden' : ''} min-h-12 rounded-lg bg-canvas px-4 py-2 text-[13px] text-ink`}>{t('Show all types')}</button>
  </div>
}

export { GROUP_LABEL }
