import { useEffect, useMemo, useRef, useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { useI18n, usePreferences } from '../i18n'
import { formatDate, money, number as formatNumber, sumMoney } from '../lib/format'
import { groupInvoices, groupModes, type GroupMode } from '../lib/revenue'
import type { Customer, Expense, Invoice, Project } from '../store/types'

export interface MoneyDetailsProps {
  open: boolean
  onClose: () => void
  title: string
  /** Small text explaining exactly what the number counts. */
  definition: string
  currency: string
  invoices?: Invoice[]
  expenses?: Expense[]
  customers: Customer[]
  projects: Project[]
}

const statusClass = (status: string) => status === 'paid' ? 'bg-good-50 text-emerald-700'
  : status === 'overdue' ? 'bg-serious-50 text-serious'
  : status === 'sent' ? 'bg-brand-100 text-brand-700'
  : 'bg-canvas text-ink'

/**
 * The list behind a revenue/expense number: every record with its client, project, date,
 * amount and status, the total at the bottom, and a Client / Project / Month grouping switch.
 */
export default function MoneyDetails(props: MoneyDetailsProps) {
  const { open, onClose, title, definition, currency, invoices, expenses, customers, projects } = props
  const { t } = useI18n()
  const prefs = usePreferences()
  const ref = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<GroupMode>('client')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  useEffect(() => { if (open) { setExpanded(null); setMode('client') } }, [open])

  const rows = invoices || []
  const modes = groupModes(rows)
  const groups = useMemo(() => groupInvoices(rows, mode, {
    currency, defaultCurrency: prefs.defaultCurrency, customers, projects,
    language: prefs.language, timeZone: prefs.timeZone,
    otherLabel: t('No customer'), noProjectLabel: t('No project'),
  }), [rows, mode, currency, customers, projects, prefs.language, prefs.timeZone, prefs.defaultCurrency, t])
  const list = invoices || expenses || []
  const total = sumMoney(invoices ? invoices.map(row => row.total) : (expenses || []).map(row => row.amount), currency)
  const tabClass = 'flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 py-1.5 text-[13px] font-semibold'

  return <dialog
    ref={ref}
    aria-label={title}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === ref.current) onClose() }}
    className="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/60"
  >
    <div className="flex max-h-[92dvh] flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold tracking-tight text-ink">{title}</h2>
          <p className="mt-0.5 text-[12px] text-muted">{definition}</p>
        </div>
        <button autoFocus aria-label={t('Close')} onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5"><X className="h-4 w-4" /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {invoices && rows.length > 0 && <div className="mb-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Group by')}</p>
          <div className="flex gap-1 rounded-lg bg-canvas p-1">
            {modes.map(item => <button key={item} onClick={() => setMode(item)} aria-pressed={mode === item}
              className={`${tabClass} ${mode === item ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>
              {t(item === 'client' ? 'Client' : item === 'project' ? 'Project' : 'Month')}
            </button>)}
          </div>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {groups.map(group => <li key={group.key} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
              <span className="min-w-0 truncate font-medium text-ink">{group.label}</span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="tnum text-muted">{formatNumber(Math.round(group.percent * 1000) / 10, prefs.language)}%</span>
                <span className="tnum font-semibold text-ink">{money(group.total, currency, false, prefs.language)}</span>
              </span>
            </li>)}
          </ul>
        </div>}

        {!list.length && <p className="py-8 text-center text-[13px] text-muted">{t('Nothing to show here yet')}</p>}

        <ul className="divide-y divide-line">
          {invoices?.map(invoice => {
            const customer = customers.find(row => row.id === invoice.customerId)
            const project = projects.find(row => row.id === invoice.projectId)
            const isOpen = expanded === invoice.id
            return <li key={invoice.id}>
              <button onClick={() => setExpanded(isOpen ? null : invoice.id)} aria-expanded={isOpen}
                className="flex w-full items-center gap-3 py-3 text-start text-[13px] hover:bg-canvas">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{invoice.number}</p>
                  <p className="truncate text-[12px] text-muted">
                    {customer?.name || t('Unknown')}{project ? ` • ${project.name}` : ''} • {formatDate(invoice.occurredAt ?? invoice.createdAt, false, invoice.language)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted">{t('Due date')}: {formatDate(invoice.dueDate, false, invoice.language)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tnum font-bold text-ink">{money(invoice.total, invoice.currency || currency, false, invoice.language)}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(invoice.status)}`}>{t(invoice.status)}</span>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && <div className="mb-3 space-y-2 rounded-lg bg-canvas p-3 text-[12.5px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Items')}</p>
                <ul className="space-y-1">
                  {invoice.items.map(item => <li key={item.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words text-ink">{item.description}</span>
                    <span className="tnum shrink-0 text-muted">{formatNumber(item.quantity, invoice.language)} × {money(item.unitPrice, invoice.currency || currency, false, invoice.language)}</span>
                  </li>)}
                </ul>
                <div className="flex justify-between border-t border-line pt-2"><span className="text-muted">{t('Subtotal')}</span><span className="tnum">{money(invoice.subtotal, invoice.currency || currency, false, invoice.language)}</span></div>
                {invoice.tax > 0 && <div className="flex justify-between"><span className="text-muted">{t('Tax')}</span><span className="tnum">{money(invoice.tax, invoice.currency || currency, false, invoice.language)}</span></div>}
                <div className="flex justify-between font-bold"><span>{t('Total')}</span><span className="tnum">{money(invoice.total, invoice.currency || currency, false, invoice.language)}</span></div>
                <div className="flex justify-between"><span className="text-muted">{t('Issue date')}</span><span>{formatDate(invoice.issueDate, false, invoice.language)}</span></div>
                <div className="flex justify-between"><span className="text-muted">{t('Status')}</span><span>{t(invoice.status)}</span></div>
                {invoice.notes && <p className="border-t border-line pt-2 text-muted">{invoice.notes}</p>}
              </div>}
            </li>
          })}
          {expenses?.map(expense => <li key={expense.id} className="flex items-center justify-between gap-3 py-3 text-[13px]">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{expense.description}</p>
              <p className="truncate text-[12px] text-muted">{[expense.category, expense.vendor, formatDate(expense.occurredAt || expense.date, true, expense.language)].filter(Boolean).join(' • ')}</p>
            </div>
            <span className="tnum shrink-0 font-bold text-ink">{money(expense.amount, expense.currency || currency, false, expense.language)}</span>
          </li>)}
        </ul>
      </div>

      <footer className="border-t border-line px-5 py-4">
        <div className="flex items-center justify-between gap-3 text-[14px] font-bold">
          <span>{t('Total')}</span>
          <span className="tnum">{money(total, currency, false, prefs.language)}</span>
        </div>
        <p className="mt-1 text-[12px] text-muted">{definition}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onClose} className="rounded-lg bg-canvas px-3.5 py-2 text-[13px] font-semibold text-ink">{t('Close')}</button>
        </div>
      </footer>
    </div>
  </dialog>
}
