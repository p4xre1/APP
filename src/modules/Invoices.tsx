import { showAlert, askConfirm } from '../lib/dialogs'
import { number, documentTotals, lineTotal, money, formatDate } from '../lib/format'
import { t, useI18n, usePreferences, errorText } from '../i18n'
import DocumentOptions, { type DocumentPreferences } from '../components/DocumentOptions'
import TaxAssistantPanel, { ShowTaxAssistantButton } from '../components/TaxAssistant'
import NumberInput from '../components/NumberInput'
import { getPreferences } from '../lib/preferences'
import { shareInvoicePdf } from '../lib/invoice-pdf'
import type { Invoice } from '../store/types'
import ExportCsvButton from '../components/ExportCsvButton'
import { useEffect, Suspense, lazy, useMemo, useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { nextDocumentNumber } from '../lib/fatorati'
import { assistantRegion, assistantStartsOpen, assistantVisible, hintsFor, settingsRegion, TAX_REGION_LABEL } from '../lib/taxGuide'
import { Plus, Download, Share2, X, Pencil, Search } from 'lucide-react'
import TemplateFields, { LineExtras, type FormLine } from '../components/TemplateFields'
import { COLUMN_LABEL, PRESETS, documentTemplate, presetIsTaxExempt, presetLabels, presetRateHint, templateColumns, templateDefaults, type DocumentTemplate } from '../lib/templates'
import { mandatoryFields } from '../lib/template-render'
import { takeIntent } from '../lib/navigation-intent'

const TemplatePicker = lazy(() => import('./TemplatePicker').then(module => ({ default: module.TemplatePicker })))

type Line = FormLine
type Status = Invoice['status']
const STATUSES: Status[] = ['draft', 'sent', 'paid', 'overdue']

function emptyForm(defaults: { currency: string; language: Invoice['language']; pdfColor: boolean; taxRate: number; template: DocumentTemplate }) {
  const today = new Date().toISOString().slice(0, 10)
  return {
    currency: defaults.currency,
    language: defaults.language,
    pdfColor: defaults.pdfColor,
    exchangeRate: undefined as number | undefined,
    rateCurrency: undefined as string | undefined,
    taxRate: defaults.taxRate,
    customerId: '',
    items: [{ description: '', quantity: 1, unitPrice: 0 }] as Line[],
    notes: '',
    paymentMethod: '',
    template: defaults.template,
    issueDate: today,
    dueDate: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
  }
}

export default function Invoices() {
  const { t: tr } = useI18n()
  const prefs = usePreferences()
  const { invoices, customers, business, settings, addInvoice, deleteInvoice, updateInvoice, updateSettings } = useFatorati()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [preview, setPreview] = useState(false)
  const [form, setForm] = useState(() => emptyForm({
    currency: getPreferences().defaultCurrency, language: getPreferences().language,
    pdfColor: getPreferences().pdfColor, taxRate: settings?.taxRate || 0,
    template: templateDefaults(settings, settingsRegion(settings)),
  }))
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

  const prefix = settings?.invoicePrefix || 'INV'
  const nextNumber = useMemo(
    () => nextDocumentNumber(invoices.map(row => row.number), prefix, 'INV'),
    [invoices, prefix],
  )
  const exempt = presetIsTaxExempt(form.template)
  const effectiveRate = exempt ? 0 : form.taxRate
  const totals = documentTotals(form.items, effectiveRate, form.currency)
  const assistant = assistantVisible(settings)
  const region = settingsRegion(settings)
  const assistantRegionValue = assistantRegion(settings)
  const hints = hintsFor(assistantRegionValue)
  const selectedCustomer = customers.find(c => c.id === form.customerId)
  const columns = templateColumns(form.template)
  const preset = PRESETS[form.template.presetId]
  // The same rule the renderer uses: an empty mandatory field prints a dash and is
  // reported here, never silently dropped.
  const missing = mandatoryFields({ region, business, customer: selectedCustomer, template: form.template, paymentMethod: form.paymentMethod, language: form.language || prefs.language }).missing
  const markAssistantSeen = () => { if (settings?.taxAssistantSeen !== true) void updateSettings({ taxAssistantSeen: true }).catch(() => undefined) }

  // A row tapped in the calendar leaves its id here; it is consumed exactly once.
  useEffect(() => {
    const id = takeIntent('invoices')
    if (!id) return
    const invoice = invoices.find(row => row.id === id)
    if (invoice) openEdit(invoice)
  }, [invoices])

  function openCreate() {
    setForm(emptyForm({
      currency: prefs.defaultCurrency, language: prefs.language, pdfColor: prefs.pdfColor,
      taxRate: settings?.taxRate || 0, template: templateDefaults(settings, region),
    }))
    setEditing(null); setShowForm(true)
  }
  function openEdit(invoice: Invoice) {
    setForm({
      currency: invoice.currency || prefs.defaultCurrency,
      language: invoice.language || prefs.language,
      pdfColor: invoice.pdfColor ?? prefs.pdfColor,
      exchangeRate: invoice.exchangeRate,
      rateCurrency: invoice.rateCurrency,
      taxRate: invoice.taxRate || 0,
      customerId: invoice.customerId,
      items: invoice.items.map(item => ({
        description: item.description, quantity: item.quantity, unitPrice: item.unitPrice,
        unit: item.unit, section: item.section, discount: item.discount,
      })),
      notes: invoice.notes,
      paymentMethod: invoice.paymentMethod || '',
      template: documentTemplate(invoice.template, region),
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
    })
    setEditing(invoice); setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditing(null) }

  async function save() {
    if (!form.customerId) { await showAlert(tr('Select a customer first')); return }
    const items = form.items.filter(item => item.description.trim())
    if (!items.length) { await showAlert(tr('Add at least one item')); return }
    setBusy(true)
    try {
      const rate = presetIsTaxExempt(form.template) ? 0 : form.taxRate
      const { subtotal, tax, total } = documentTotals(items, rate, form.currency)
      const payload = {
        currency: form.currency, language: form.language, pdfColor: form.pdfColor,
        exchangeRate: form.exchangeRate, rateCurrency: form.rateCurrency, taxRate: rate,
        customerId: form.customerId,
        paymentMethod: form.paymentMethod,
        template: form.template,
        items: items.map(item => ({
          id: crypto.randomUUID(),
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          ...(item.unit ? { unit: item.unit } : {}),
          ...(item.section ? { section: item.section } : {}),
          ...(item.discount ? { discount: item.discount } : {}),
          total: lineTotal(item.quantity, item.unitPrice, form.currency, item.discount),
        })),
        subtotal, tax, total,
        issueDate: form.issueDate, dueDate: form.dueDate, notes: form.notes,
      }
      if (editing) {
        // Item identities are regenerated above, so keep the stored ones when the lines match.
        const keptItems = payload.items.map((item, index) => ({ ...item, id: editing.items[index]?.id || item.id }))
        await updateInvoice(editing.id, { ...payload, items: keptItems })
      } else {
        await addInvoice({ ...payload, number: nextNumber, status: 'draft' })
      }
      closeForm()
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  /** Changing the document currency must re-round every amount to that currency. */
  async function updateOptions(invoice: Invoice, patch: DocumentPreferences) {
    try {
      const currency = patch.currency || invoice.currency || prefs.defaultCurrency
      const totals = documentTotals(invoice.items, invoice.taxRate || 0, currency)
      await updateInvoice(invoice.id, { ...patch, currency, ...totals })
    } catch (error) { await showAlert(errorText(error)) }
  }

  async function changeStatus(invoice: Invoice, status: Status) {
    try {
      await updateInvoice(invoice.id, { status, paidAt: status === 'paid' ? (invoice.paidAt || Date.now()) : undefined })
    } catch (error) { await showAlert(errorText(error)) }
  }

  async function remove(invoice: Invoice) {
    if (!await askConfirm(tr('Delete invoice {number}? This cannot be undone.', { number: invoice.number }))) return
    try { await deleteInvoice(invoice.id) } catch (error) { await showAlert(errorText(error)) }
  }

  async function share(invoice: Invoice) {
    setBusy(true)
    try {
      await shareInvoicePdf(invoice, business, customers.find(c => c.id === invoice.customerId), invoice.currency || settings?.currency, settings)
    } catch (error) {
      await showAlert(tr('PDF share not completed') + ': ' + errorText(error))
    } finally { setBusy(false) }
  }

  const visible = invoices.filter(invoice => {
    if (filter !== 'all' && invoice.status !== filter) return false
    if (!search.trim()) return true
    const customer = customers.find(row => row.id === invoice.customerId)?.name || ''
    const needle = search.trim().toLowerCase()
    return invoice.number.toLowerCase().includes(needle) || customer.toLowerCase().includes(needle)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Invoices")}</h1>
          <p className="text-[13px] text-muted mt-1">{number(invoices.length)} {t("invoices • Create invoice → PDF → Share")}</p>
        </div>
        <button onClick={openCreate} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4" />{t("New Invoice")}</button>
      </div>

      <ExportCsvButton store="invoices" />

      {showForm && (
        <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-ink">{editing ? t('Edit invoice') + ` ${editing.number}` : t('Create Invoice')}</h2>
            {!editing && <span className="text-[12px] text-muted">{t('Next number')}: <span className="font-semibold text-ink">{nextNumber}</span>{assistant && <span className="ms-2 text-faint">{t(hints.documentNumber)}</span>}</span>}
          </div>
          <DocumentOptions value={form} onChange={patch => setForm({ ...form, ...patch })} />

          <div className="mt-4 rounded-lg border border-line bg-canvas/40 p-4">
            <h3 className="mb-3 text-[13px] font-bold text-ink">{t('Template')}</h3>
            <TemplateFields
              value={form.template}
              rateHint={presetRateHint(form.template)}
              missing={missing}
              onChange={patch => setForm(current => ({
                ...current,
                template: { ...current.template, ...patch },
                ...(patch.presetId !== undefined && presetIsTaxExempt({ ...current.template, ...patch }) ? { taxRate: 0 } : {}),
              }))}
              onPreview={() => setPreview(true)}
            />
            <label className="mt-3.5 block">
              <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Payment method')}</span>
              <select aria-label={t('Payment method')} value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className={inputClass}>
                <option value="">—</option>
                {['Bank transfer', 'Cash', 'Cheque', 'Card', 'Other'].map(method => <option key={method} value={method}>{t(method)}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Customer *")}</label>
              <select aria-label={t('Customer')} value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className={inputClass}>
                <option value="">{t("Select customer")}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink mb-2">{t("Items")}</label>
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
                  <input aria-label={t('Description')} placeholder={t("Description")} value={item.description} onChange={e => {
                    const items = [...form.items]; items[idx] = { ...item, description: e.target.value }; setForm({ ...form, items })
                  }} className={`col-span-6 ${inputClass}`} />
                  <NumberInput aria-label={t(presetLabels(form.template.presetId).quantity || COLUMN_LABEL.quantity)} placeholder={t(COLUMN_LABEL.quantity)} value={item.quantity} onChange={quantity => {
                    const items = [...form.items]; items[idx] = { ...item, quantity }; setForm({ ...form, items })
                  }} className={`col-span-2 ${inputClass}`} />
                  <NumberInput aria-label={t('Price')} placeholder={t("Price")} value={item.unitPrice} onChange={unitPrice => {
                    const items = [...form.items]; items[idx] = { ...item, unitPrice }; setForm({ ...form, items })
                  }} className={`col-span-3 ${inputClass}`} />
                  <button onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })} aria-label={t("Remove item")} className="col-span-1 text-serious text-[13px]"><X className="w-4 h-4 mx-auto" /></button>
                  <LineExtras line={item} columns={columns} groupBy={preset.groupBy} units={preset.unitSuggestions}
                    onChange={patch => { const items = [...form.items]; items[idx] = { ...item, ...patch }; setForm({ ...form, items }) }} />
                </div>
              ))}
              <button onClick={() => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unitPrice: 0 }] })} className="text-[13px] text-brand hover:text-brand-700">{t("+ Add item")}</button>
            </div>

            {assistant ? (
              <TaxAssistantPanel
                region={assistantRegionValue}
                onRegionChange={next => void updateSettings({ taxAssistantRegion: next }).catch(() => undefined)}
                onApplyRegion={next => { void updateSettings({ taxRegion: next, taxAssistantRegion: next }).catch(() => undefined) }}
                onHide={() => void updateSettings({ taxAssistantVisible: false }).catch(() => undefined)}
                startOpen={assistantStartsOpen(settings)}
                onFirstView={markAssistantSeen}
              />
            ) : (
              <ShowTaxAssistantButton onShow={() => void updateSettings({ taxAssistantVisible: true }).catch(() => undefined)} />
            )}

            {assistant && !editing && (
              <p className="text-[12px] text-muted">{t('{region} guidance is on for this form.', { region: t(TAX_REGION_LABEL[assistantRegionValue]) })}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block">
                <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Tax rate')} (%)</span>
                <NumberInput aria-label={t('Tax rate')} value={effectiveRate} disabled={exempt} onChange={taxRate => setForm({ ...form, taxRate: Math.min(taxRate, 1000) })} className={inputClass} />
                {exempt
                  ? <span className="mt-1 block text-[11.5px] text-muted">{t('TVA non applicable')} · {t('No TVA: the exemption mention replaces the tax lines.')}</span>
                  : assistant && <span className="mt-1 block text-[11.5px] text-muted">{t(hints.taxRate)}</span>}
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Issue date")}</span>
                <input type="date" value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} className={inputClass} />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Due date")}</span>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className={inputClass} />
              </label>
              {region === 'MA' && (
                <label className="block sm:col-span-3">
                  <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Client ICE')}</span>
                  <input aria-label={t('Client ICE')} value={selectedCustomer?.taxNumber || ''} readOnly placeholder={t('Stored with the selected customer')} className={`${inputClass} bg-canvas`} />
                  {assistant && <span className={`mt-1 block text-[11.5px] ${selectedCustomer && !selectedCustomer.taxNumber ? 'text-warn' : 'text-muted'}`}>{t(selectedCustomer && !selectedCustomer.taxNumber ? hints.customerTaxMissing : hints.customerTax)}</span>}
                </label>
              )}
            </div>

            <div className="bg-canvas p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-[13px]"><span>{t("Subtotal:")}</span><span className="font-medium">{money(totals.subtotal, form.currency, false, form.language)}</span></div>
              <div className="flex justify-between text-[13px]"><span>{t("Tax")} {effectiveRate ? `(${number(effectiveRate)}%)` : ''}:</span><span className="font-medium">{money(totals.tax, form.currency, false, form.language)}</span></div>
              <div className="flex justify-between text-[13px] font-bold pt-2 border-t border-line"><span>{t("Total:")}</span><span>{money(totals.total, form.currency, false, form.language)}</span></div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Notes")}</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder={t("Thank you for your business!")} className={inputClass} rows={3} />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button disabled={busy} onClick={() => void save()} className="bg-brand text-white px-6 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{editing ? t('Save changes') : t("Create Invoice")}</button>
            <button disabled={busy} onClick={closeForm} className="bg-canvas text-ink px-6 py-2 rounded-lg text-[13px]">{t("Cancel")}</button>
          </div>
        </div>
      )}

      {preview && <Suspense fallback={<div className="fixed inset-0 z-50 grid place-items-center bg-canvas"><p className="text-[13px] text-muted">{t('Loading...')}</p></div>}>
        <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas p-4 sm:p-6">
          <TemplatePicker
            value={form.template}
            onChange={patch => setForm(current => ({ ...current, template: { ...current.template, ...patch } }))}
            onApply={next => { setForm(current => ({ ...current, template: next, taxRate: presetIsTaxExempt(next) ? 0 : current.taxRate })); setPreview(false) }}
            onBack={() => setPreview(false)}
            applyLabel="Use this template"
            region={region}
            language={form.language || prefs.language}
            currency={form.currency}
            logo={business?.logo}
            stamp={business?.stamp}
          />
        </div>
      </Suspense>}

      <div className="bg-surface rounded-xl border border-line p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[12rem] items-center gap-2 bg-canvas rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-faint" />
            <input type="text" aria-label={t('Search invoices...')} placeholder={t("Search invoices...")} value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-transparent outline-none text-[13.5px]" />
          </div>
          <select aria-label={t('Status')} value={filter} onChange={e => setFilter(e.target.value as 'all' | Status)} className={inputClass + ' w-auto'}>
            <option value="all">{t('All')}</option>
            {STATUSES.map(status => <option key={status} value={status}>{t(status)}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {visible.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted text-[13px]">{invoices.length ? t("No results") : t("No invoices yet")}</p>
            {!invoices.length && <p className="text-[12px] text-faint mt-1">{t("Create your first invoice → PDF → Share")}</p>}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {visible.map((invoice) => {
              const customer = customers.find(c => c.id === invoice.customerId)
              return (
                <div key={invoice.id} className="p-4 hover:bg-canvas">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[13px] text-ink">{invoice.number}</p>
                      <p className="text-[12px] text-muted mt-0.5">{customer?.name || t("Unknown")} • {formatDate(invoice.occurredAt || invoice.createdAt, true, invoice.language)}</p>
                      {invoice.status === 'paid' && invoice.paidAt && <p className="text-[12px] text-emerald-700 mt-0.5">{t('Paid on')} {formatDate(invoice.paidAt, false, invoice.language)}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-end me-1">
                        <p className="font-bold text-[13px] text-ink">{money(invoice.total, invoice.currency, false, invoice.language)}</p>
                        {!!invoice.tax && <p className="text-[11.5px] text-muted">{t('Tax')} {money(invoice.tax, invoice.currency, false, invoice.language)}</p>}
                      </div>
                      <select aria-label={`${t('Status')} ${invoice.number}`} value={invoice.status} onChange={e => void changeStatus(invoice, e.target.value as Status)} className={`text-[12px] rounded-lg border border-line-strong bg-surface px-2 py-1 ${invoice.status === 'paid' ? 'text-emerald-700' : invoice.status === 'overdue' ? 'text-serious' : 'text-ink'}`}>
                        {STATUSES.map(status => <option key={status} value={status}>{t(status)}</option>)}
                      </select>
                      {invoice.status !== 'paid' && <button onClick={() => void changeStatus(invoice, 'paid')} className="text-[12px] px-2 py-1 rounded-lg bg-good-50 text-emerald-700 font-semibold">{t('Mark as paid')}</button>}
                      <button disabled={busy} onClick={() => openEdit(invoice)} title={t('Edit')} aria-label={`${t('Edit')} ${invoice.number}`} className="p-2 hover:bg-canvas rounded-lg"><Pencil className="w-4 h-4 text-muted" /></button>
                      <button disabled={busy} onClick={() => void share(invoice)} title={t("Download PDF")} aria-label={`${t('Download PDF')} ${invoice.number}`} className="p-2 hover:bg-canvas rounded-lg"><Download className="w-4 h-4 text-muted" /></button>
                      <button disabled={busy} onClick={() => void share(invoice)} title={t("Share")} aria-label={`${t('Share')} ${invoice.number}`} className="p-2 hover:bg-canvas rounded-lg"><Share2 className="w-4 h-4 text-muted" /></button>
                      <button onClick={() => void remove(invoice)} className="text-[12px] text-serious hover:text-serious px-2 py-1">{t("Delete")}</button>
                    </div>
                  </div>
                  <details className="mt-2"><summary className="text-[12px] cursor-pointer text-muted">{t('Document options')}</summary><div className="mt-3"><DocumentOptions value={invoice} onChange={patch => void updateOptions(invoice, patch)} /></div></details>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
