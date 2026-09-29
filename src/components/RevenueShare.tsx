import { useEffect, useMemo, useRef, useState } from 'react'
import { Share2, X } from 'lucide-react'
import { useI18n, usePreferences, errorText } from '../i18n'
import { money } from '../lib/format'
import { periodRange, periodIsValid, revenueCardData, type PeriodKind, type PeriodRange } from '../lib/revenue-period'
import { shareRevenueCard } from '../lib/revenue-card'
import { fieldInputClass, fieldLabelClass } from './Field'
import type { Business, Invoice } from '../store/types'

const kinds: PeriodKind[] = ['this-month', 'last-month', 'this-year', 'custom']
const kindLabels: Record<PeriodKind, string> = {
  'this-month': 'This month', 'last-month': 'Last month', 'this-year': 'This year', custom: 'Custom period',
}

/**
 * "Share" on the revenue screen: choose a period and hand a PNG card to the Android
 * share sheet (WhatsApp, Instagram, ...). Follows the app language and Arabic RTL.
 */
export default function RevenueShare({ invoices, business, currency, defaultCurrency, className = '' }: {
  invoices: Invoice[]
  business: Business | null
  currency: string
  defaultCurrency: string
  className?: string
}) {
  const { t } = useI18n()
  const prefs = usePreferences()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<PeriodKind>('this-month')
  const [custom, setCustom] = useState<{ from: string; to: string }>(() => {
    const range = periodRange('this-month')
    return { from: range.from, to: range.to }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const range: PeriodRange = kind === 'custom' ? periodRange('custom', custom) : periodRange(kind)
  const data = useMemo(() => revenueCardData(invoices, range, {
    currency, defaultCurrency, businessName: business?.name || t('Your Business'),
    language: prefs.language, digits: prefs.digits, timeZone: prefs.timeZone,
  }), [invoices, range.from, range.to, range.kind, currency, defaultCurrency, business?.name, prefs.language, prefs.digits, prefs.timeZone, t])

  async function handleShare() {
    if (!periodIsValid(range)) { setError(t('Choose a valid period')); return }
    setBusy(true); setError('')
    try {
      await shareRevenueCard(data, { language: prefs.language, digits: prefs.digits, logo: business?.logo, accent: prefs.accent })
      setOpen(false)
    } catch (cause) {
      setError(t('Revenue card not shared') + ': ' + errorText(cause))
    } finally { setBusy(false) }
  }

  const preview = <div className="rounded-xl border border-line bg-canvas p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{t('Revenue card preview')}</p>
    <p className="mt-2 text-[13px] font-semibold text-ink">{business?.name || t('Your Business')}</p>
    <p className="text-[12px] text-muted">{t('Revenue card')} · {data.periodLabel} · {currency}</p>
    <p className="tnum mt-2 text-[22px] font-bold text-ink">{money(data.total, currency, false, prefs.language)}</p>
    <p className="text-[12px] text-muted">{t('{count} invoices', { count: data.invoiceCount })}</p>
    {data.total === 0 && <p className="mt-2 text-[12px] text-warn">{t('No paid invoices in this period yet')}</p>}
  </div>

  return <div className={className}>
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-all active:scale-[0.98] hover:bg-brand-700">
      <Share2 className="h-4 w-4" />{t('Share revenue card')}
    </button>

    <dialog
      ref={ref}
      aria-label={t('Share revenue card')}
      onCancel={event => { event.preventDefault(); if (!busy) setOpen(false) }}
      onClick={event => { if (event.target === ref.current && !busy) setOpen(false) }}
      className="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[16px] font-bold tracking-tight">{t('Share revenue card')}</h2>
          <button aria-label={t('Close')} disabled={busy} onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-ink/5"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            {kinds.map(item => <button key={item} onClick={() => setKind(item)} aria-pressed={kind === item}
              className={`min-h-12 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors ${kind === item ? 'border-brand bg-brand-50 text-brand-700' : 'border-line-strong bg-surface text-ink'}`}>
              {t(kindLabels[item])}
            </button>)}
          </div>
          {kind === 'custom' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabelClass}>{t('From date')}</span>
              <input type="date" value={custom.from} onChange={event => setCustom({ ...custom, from: event.target.value })} className={fieldInputClass} />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>{t('To date')}</span>
              <input type="date" value={custom.to} onChange={event => setCustom({ ...custom, to: event.target.value })} className={fieldInputClass} />
            </label>
          </div>}
          {preview}
          <p className="text-[12px] text-muted">{t('The card is created on this phone and shared through Android. Nothing is uploaded.')}</p>
          {error && <p role="alert" className="text-[12px] text-serious">{error}</p>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-4">
          <span className="text-[12px] text-muted">{t('{count} invoices', { count: data.invoiceCount })}</span>
          <div className="flex gap-2">
            <button onClick={() => void handleShare()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all active:scale-[0.98] hover:bg-brand-700 disabled:opacity-40">
              <Share2 className="h-4 w-4" />{busy ? t('Creating card...') : t('Share')}
            </button>
            <button onClick={() => setOpen(false)} disabled={busy} className="rounded-lg bg-canvas px-4 py-2 text-[13px] font-semibold text-ink">{t('Cancel')}</button>
          </div>
        </footer>
      </div>
    </dialog>
  </div>
}
