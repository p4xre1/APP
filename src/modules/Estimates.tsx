import { Plus, Share2, Pencil, FilePlus2 } from 'lucide-react'
import { showAlert, askConfirm } from '../lib/dialogs'
import { useMemo, useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { money, number as formatNumber, documentTotals, lineTotal, formatDate } from '../lib/format'
import { nextDocumentNumber } from '../lib/fatorati'
import { assistantRegion, assistantStartsOpen, assistantVisible, hintsFor, TAX_REGION_LABEL } from '../lib/taxGuide'
import { getPreferences } from '../lib/preferences'
import { shareInvoicePdf } from '../lib/invoice-pdf'
import { useI18n, usePreferences, errorText } from '../i18n'
import DocumentOptions, { type DocumentPreferences } from '../components/DocumentOptions'
import TaxAssistantPanel, { ShowTaxAssistantButton } from '../components/TaxAssistant'
import NumberInput from '../components/NumberInput'
import type { Estimate } from '../store/types'

type Status = Estimate['status']
const STATUSES: Status[] = ['draft', 'sent', 'accepted', 'declined']

export default function Estimates() {
  const { t } = useI18n()
  const prefs = usePreferences()
  const { estimates, invoices, customers, business, settings, addEstimate, updateEstimate, deleteEstimate, addInvoice, updateSettings } = useFatorati()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Estimate | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(() => ({
    customerId: '', description: '', quantity: 1, unitPrice: 0, notes: '',
    taxRate: settings?.taxRate || 0,
    currency: getPreferences().defaultCurrency, language: getPreferences().language,
    pdfColor: getPreferences().pdfColor,
    exchangeRate: undefined as number | undefined, rateCurrency: undefined as string | undefined,
  }))
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

  const prefix = settings?.estimatePrefix || 'EST'
  const nextNumber = useMemo(() => nextDocumentNumber(estimates.map(row => row.number), prefix, 'EST'), [estimates, prefix])
  const totals = documentTotals([{ quantity: form.quantity, unitPrice: form.unitPrice }], form.taxRate, form.currency)
  const assistant = assistantVisible(settings)
  const region = assistantRegion(settings)
  const hints = hintsFor(region)

  function openCreate() {
    setForm({
      customerId: '', description: '', quantity: 1, unitPrice: 0, notes: '',
      taxRate: settings?.taxRate || 0,
      currency: prefs.defaultCurrency, language: prefs.language, pdfColor: prefs.pdfColor,
      exchangeRate: undefined, rateCurrency: undefined,
    })
    setEditing(null); setShowForm(true)
  }
  function openEdit(estimate: Estimate) {
    const item = estimate.items[0]
    setForm({
      customerId: estimate.customerId,
      description: item?.description || '',
      quantity: item?.quantity ?? 1,
      unitPrice: item?.unitPrice ?? 0,
      notes: estimate.notes,
      taxRate: estimate.taxRate || 0,
      currency: estimate.currency || prefs.defaultCurrency,
      language: estimate.language || prefs.language,
      pdfColor: estimate.pdfColor ?? prefs.pdfColor,
      exchangeRate: estimate.exchangeRate, rateCurrency: estimate.rateCurrency,
    })
    setEditing(estimate); setShowForm(true)
  }

  async function save() {
    if (!form.customerId || !form.description.trim()) { await showAlert(t('Choose a customer and a description')); return }
    setBusy(true)
    try {
      const item = { id: editing?.items[0]?.id || crypto.randomUUID(), description: form.description.trim(), quantity: form.quantity, unitPrice: form.unitPrice, total: lineTotal(form.quantity, form.unitPrice, form.currency) }
      const payload = {
        customerId: form.customerId, currency: form.currency, language: form.language, pdfColor: form.pdfColor,
        exchangeRate: form.exchangeRate, rateCurrency: form.rateCurrency, taxRate: form.taxRate,
        items: [item], subtotal: totals.subtotal, tax: totals.tax, total: totals.total, notes: form.notes,
      }
      if (editing) await updateEstimate(editing.id, payload)
      else await addEstimate({
        ...payload, number: nextNumber, status: 'draft',
        issueDate: new Date().toISOString().slice(0, 10),
        expiryDate: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
      })
      setShowForm(false); setEditing(null)
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  async function changeStatus(estimate: Estimate, status: Status) {
    try { await updateEstimate(estimate.id, { status }) } catch (error) { await showAlert(errorText(error)) }
  }

  async function updateOptions(estimate: Estimate, patch: DocumentPreferences) {
    try {
      const currency = patch.currency || estimate.currency || prefs.defaultCurrency
      const recalculated = documentTotals(estimate.items, estimate.taxRate || 0, currency)
      await updateEstimate(estimate.id, { ...patch, currency, ...recalculated })
    } catch (error) { await showAlert(errorText(error)) }
  }

  async function remove(estimate: Estimate) {
    if (!await askConfirm(t('Delete estimate {number}? This cannot be undone.', { number: estimate.number }))) return
    try { await deleteEstimate(estimate.id) } catch (error) { await showAlert(errorText(error)) }
  }

  /** Accepted estimates become a draft invoice with the next sequential number. */
  async function convert(estimate: Estimate) {
    if (!await askConfirm(t('Create a draft invoice from estimate {number}?', { number: estimate.number }))) return
    setBusy(true)
    try {
      await addInvoice({
        number: nextDocumentNumber(invoices.map(row => row.number), settings?.invoicePrefix || 'INV', 'INV'),
        customerId: estimate.customerId,
        currency: estimate.currency, language: estimate.language, pdfColor: estimate.pdfColor,
        exchangeRate: estimate.exchangeRate, rateCurrency: estimate.rateCurrency, taxRate: estimate.taxRate,
        items: estimate.items.map(item => ({ ...item, id: crypto.randomUUID() })),
        subtotal: estimate.subtotal, tax: estimate.tax, total: estimate.total, status: 'draft',
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
        notes: estimate.notes,
      })
      await updateEstimate(estimate.id, { status: 'accepted' })
      await showAlert(t('Draft invoice created'))
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  async function share(estimate: Estimate) {
    setBusy(true)
    try { await shareInvoicePdf(estimate, business, customers.find(c => c.id === estimate.customerId), estimate.currency) }
    catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Estimates')}</h1>
        <p className="text-[13px] text-muted mt-1">{formatNumber(estimates.length)} {t('estimates • 100% offline')}</p>
      </div>
      <button onClick={openCreate} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm"><Plus className="w-4 h-4" />{t('Create Estimate')}</button>
    </div>

    {showForm && <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold text-ink">{editing ? `${t('Edit estimate')} ${editing.number}` : t('Create Estimate')}</h2>
        {!editing && <span className="text-[12px] text-muted">{t('Next number')}: <span className="font-semibold text-ink">{nextNumber}</span></span>}
      </div>
      <div className="space-y-4">
        <DocumentOptions value={form} onChange={patch => setForm({ ...form, ...patch })} />
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Customer')}</span>
          <select aria-label={t('Customer')} value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className={inputClass}><option value="">{t('Select customer')}</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Description')}</span>
          <input aria-label={t('Description')} placeholder={t('Description')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Quantity')}</span>
            <NumberInput aria-label={t('Quantity')} value={form.quantity} onChange={quantity => setForm({ ...form, quantity })} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Unit price')}</span>
            <NumberInput aria-label={t('Unit price')} value={form.unitPrice} onChange={unitPrice => setForm({ ...form, unitPrice })} className={inputClass} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Tax rate')} (%)</span>
          <NumberInput aria-label={t('Tax rate')} value={form.taxRate} onChange={taxRate => setForm({ ...form, taxRate: Math.min(taxRate, 1000) })} className={inputClass} />
          {assistant && <span className="mt-1 block text-[11.5px] text-muted">{t(hints.taxRate)}</span>}
        </label>

        {assistant ? (
          <TaxAssistantPanel
            region={region}
            onRegionChange={next => void updateSettings({ taxAssistantRegion: next }).catch(() => undefined)}
            onApplyRegion={next => void updateSettings({ taxRegion: next, taxAssistantRegion: next }).catch(() => undefined)}
            onHide={() => void updateSettings({ taxAssistantVisible: false }).catch(() => undefined)}
            startOpen={assistantStartsOpen(settings)}
            onFirstView={() => { if (settings?.taxAssistantSeen !== true) void updateSettings({ taxAssistantSeen: true }).catch(() => undefined) }}
          />
        ) : (
          <ShowTaxAssistantButton onShow={() => void updateSettings({ taxAssistantVisible: true }).catch(() => undefined)} />
        )}
        {assistant && <p className="text-[12px] text-muted">{t('{region} guidance is on for this form.', { region: t(TAX_REGION_LABEL[region]) })}</p>}
        {assistant && region === 'MA' && <p className="text-[12px] text-muted">{t(hints.customerTax)}</p>}
        <div className="bg-canvas p-4 rounded-lg space-y-2">
          <div className="flex justify-between text-[13px]"><span>{t('Subtotal:')}</span><span className="font-medium">{money(totals.subtotal, form.currency, false, form.language)}</span></div>
          <div className="flex justify-between text-[13px]"><span>{t('Tax')}:</span><span className="font-medium">{money(totals.tax, form.currency, false, form.language)}</span></div>
          <div className="flex justify-between text-[13px] font-bold pt-2 border-t border-line"><span>{t('Total:')}</span><span>{money(totals.total, form.currency, false, form.language)}</span></div>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Notes')}</span>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass} rows={2} />
        </label>
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => void save()} className="bg-brand hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{editing ? t('Save changes') : t('Save')}</button>
          <button disabled={busy} onClick={() => { setShowForm(false); setEditing(null) }} className="bg-canvas text-ink px-5 py-2 rounded-lg text-[13px]">{t('Cancel')}</button>
        </div>
      </div>
    </div>}

    <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {estimates.length === 0 ? <div className="text-center py-12">
        <p className="text-muted text-[13px]">{t('No estimates yet')}</p>
        <p className="text-[12px] text-faint mt-1">{t('Estimates will appear here')}</p>
      </div> : <div className="divide-y divide-line">
        {estimates.map(estimate => <div key={estimate.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-[13px] text-ink">{estimate.number}</p>
              <p className="text-[12px] text-muted mt-0.5">{customers.find(c => c.id === estimate.customerId)?.name || t('Unknown')} • {formatDate(estimate.occurredAt || estimate.createdAt, true, estimate.language)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-[13px]">{money(estimate.total, estimate.currency, false, estimate.language)}</p>
              <select aria-label={`${t('Status')} ${estimate.number}`} value={estimate.status} onChange={e => void changeStatus(estimate, e.target.value as Status)} className="text-[12px] rounded-lg border border-line-strong bg-surface text-ink px-2 py-1">
                {STATUSES.map(status => <option key={status} value={status}>{t(status)}</option>)}
              </select>
              <button disabled={busy} onClick={() => void convert(estimate)} title={t('Convert to invoice')} aria-label={`${t('Convert to invoice')} ${estimate.number}`} className="p-2 hover:bg-canvas rounded-lg"><FilePlus2 className="w-4 h-4 text-muted" /></button>
              <button disabled={busy} onClick={() => openEdit(estimate)} title={t('Edit')} aria-label={`${t('Edit')} ${estimate.number}`} className="p-2 hover:bg-canvas rounded-lg"><Pencil className="w-4 h-4 text-muted" /></button>
              <button disabled={busy} onClick={() => void share(estimate)} title={t('Share PDF')} aria-label={`${t('Share PDF')} ${estimate.number}`} className="p-2 hover:bg-canvas rounded-lg"><Share2 className="w-4 h-4 text-muted" /></button>
              <button onClick={() => void remove(estimate)} className="text-[12px] text-serious px-2 py-1">{t('Delete')}</button>
            </div>
          </div>
          <details className="mt-2"><summary className="text-[12px] cursor-pointer text-muted">{t('Document options')}</summary><div className="mt-3"><DocumentOptions value={estimate} onChange={patch => void updateOptions(estimate, patch)} /></div></details>
        </div>)}
      </div>}
    </div>
  </div>
}
