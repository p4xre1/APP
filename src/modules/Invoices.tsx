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
import { useDeferredValue, useEffect, Suspense, lazy, useMemo, useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { nextDocumentNumber, seriesFloor } from '../lib/fatorati'
import { effectiveStatus, clampDueDays, paymentTermsGap, paymentTermsLevel, PAYMENT_TERM_DAYS, dueDateFromTerms } from '../lib/status'
import { creditNoteFromInvoice, isCreditNote, CREDIT_NOTE_FALLBACK_PREFIX } from '../lib/credit-notes'
import { invoiceBalance, paymentsTotal, recordPayment, removePayment } from '../lib/payments'
import { todayISO } from '../lib/subscriptions'
import { assistantRegion, assistantStartsOpen, assistantVisible, hintsFor, settingsRegion, TAX_REGION_LABEL } from '../lib/taxGuide'
import { Plus, Download, Share2, X, Pencil, Search } from 'lucide-react'
import TemplateFields, { LineExtras, type FormLine } from '../components/TemplateFields'
import { productToLine } from '../lib/products'
import { COLUMN_LABEL, PRESETS, documentTemplate, presetIsTaxExempt, presetLabels, presetRateHint, templateColumns, templateDefaults, type DocumentTemplate } from '../lib/templates'
import { buildDocumentModel, mandatoryFields } from '../lib/template-render'
import { takeIntent } from '../lib/navigation-intent'

const TemplatePicker = lazy(() => import('./TemplatePicker').then(module => ({ default: module.TemplatePicker })))
const ModelPreview = lazy(() => import('./TemplatePicker').then(module => ({ default: module.ModelPreview })))

type Line = FormLine
type Status = Invoice['status']
const STATUSES: Status[] = ['draft', 'sent', 'paid', 'overdue']

function emptyForm(defaults: { currency: string; language: Invoice['language']; pdfColor: boolean; taxRate: number; template: DocumentTemplate; dueDays?: number }) {
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
    privateNotes: '',
    poNumber: '',
    salesperson: '',
    shippingAddress: '',
    paymentMethod: '',
    template: defaults.template,
    issueDate: today,
    dueDate: new Date(Date.now() + clampDueDays(defaults.dueDays) * 86400_000).toISOString().slice(0, 10),
  }
}

export default function Invoices() {
  const { t: tr } = useI18n()
  const prefs = usePreferences()
  const { invoices, customers, products, business, settings, addInvoice, deleteInvoice, updateInvoice, updateSettings } = useFatorati()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [preview, setPreview] = useState(false)
  const [docPreview, setDocPreview] = useState(false)
  const [shipToOpen, setShipToOpen] = useState(false)
  const [form, setForm] = useState(() => emptyForm({
    currency: getPreferences().defaultCurrency, language: getPreferences().language,
    pdfColor: getPreferences().pdfColor, taxRate: settings?.taxRate || 0,
    template: templateDefaults(settings, settingsRegion(settings)), dueDays: settings?.defaultDueDays,
  }))
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

  const prefix = settings?.invoicePrefix || 'INV'
  const nextNumber = useMemo(
    () => nextDocumentNumber(invoices.map(row => row.number), prefix, 'INV', new Date(), seriesFloor(settings?.numberFloor, prefix, 'INV')),
    [invoices, prefix, settings?.numberFloor],
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

  /**
   * Live preview of the REAL form state: the same buildDocumentModel that the
   * PDF uses, fed with a transient invoice assembled exactly like save() does.
   * There is no second data model and no second renderer - deferring the form
   * only keeps typing smooth while the canvas repaints.
   */
  const deferredForm = useDeferredValue(form)
  const previewModel = useMemo(() => {
    if (!showForm) return null
    const source = deferredForm
    const rate = presetIsTaxExempt(source.template) ? 0 : source.taxRate
    const typed = source.items.filter(item => item.description.trim() || item.unitPrice || item.itemCode?.trim())
    const lines = (typed.length ? typed : [{ description: '—', quantity: 1, unitPrice: 0 } as Line]).map((item, index) => ({
      id: `draft-${index}`,
      ...(item.productId ? { productId: item.productId } : {}),
      ...(item.itemCode?.trim() ? { itemCode: item.itemCode.trim() } : {}),
      description: item.description,
      quantity: item.quantity, unitPrice: item.unitPrice,
      ...(item.unit ? { unit: item.unit } : {}),
      ...(item.section ? { section: item.section } : {}),
      ...(item.discount ? { discount: item.discount } : {}),
      total: lineTotal(item.quantity, item.unitPrice, source.currency, item.discount),
    }))
    const sums = documentTotals(lines, rate, source.currency)
    const document: Invoice = {
      id: editing?.id || 'draft', kind: editing?.kind, number: editing?.number || nextNumber,
      customerId: source.customerId, items: lines, ...sums,
      status: editing?.status || 'draft', issueDate: source.issueDate, dueDate: source.dueDate,
      notes: source.notes, taxRate: rate, currency: source.currency, language: source.language,
      paymentMethod: source.paymentMethod,
      poNumber: source.poNumber.trim() || undefined,
      salesperson: source.salesperson.trim() || undefined,
      shippingAddress: source.shippingAddress.trim() || undefined,
      occurredAt: editing?.occurredAt, createdAt: editing?.createdAt || Date.now(), updatedAt: Date.now(),
    }
    return buildDocumentModel({
      kind: document.kind === 'credit_note' ? 'credit_note' : 'invoice', document,
      business, customer: customers.find(c => c.id === source.customerId),
      region, currency: source.currency || prefs.defaultCurrency, language: source.language || prefs.language,
      template: source.template, appAccent: prefs.pdfColor ? prefs.accent : '#0b1220',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, deferredForm, editing, nextNumber, business, customers, region, prefs.defaultCurrency, prefs.language, prefs.pdfColor, prefs.accent])

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
      taxRate: settings?.taxRate || 0, template: templateDefaults(settings, region), dueDays: settings?.defaultDueDays,
    }))
    setShipToOpen(false)
    setEditing(null); setShowForm(true)
  }
  function openEdit(invoice: Invoice) {
    setShipToOpen(false)
    setForm({
      currency: invoice.currency || prefs.defaultCurrency,
      language: invoice.language || prefs.language,
      pdfColor: invoice.pdfColor ?? prefs.pdfColor,
      exchangeRate: invoice.exchangeRate,
      rateCurrency: invoice.rateCurrency,
      taxRate: invoice.taxRate || 0,
      customerId: invoice.customerId,
      items: invoice.items.map(item => ({
        productId: item.productId, itemCode: item.itemCode, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice,
        unit: item.unit, section: item.section, discount: item.discount,
      })),
      notes: invoice.notes,
      privateNotes: invoice.privateNotes || '',
      poNumber: invoice.poNumber || '',
      salesperson: invoice.salesperson || '',
      shippingAddress: invoice.shippingAddress || '',
      paymentMethod: invoice.paymentMethod || '',
      template: documentTemplate(invoice.template, region),
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
    })
    setEditing(invoice); setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditing(null) }

  async function save(): Promise<Invoice | null> {
    if (!form.customerId) { await showAlert(tr('Select a customer first')); return null }
    const items = form.items.filter(item => item.description.trim())
    if (!items.length) { await showAlert(tr('Add at least one item')); return null }
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
          ...(item.productId ? { productId: item.productId } : {}),
          ...(item.itemCode?.trim() ? { itemCode: item.itemCode.trim() } : {}),
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
        privateNotes: form.privateNotes.trim() || undefined,
        poNumber: form.poNumber.trim() || undefined,
        salesperson: form.salesperson.trim() || undefined,
        shippingAddress: form.shippingAddress.trim() || undefined,
      }
      let saved: Invoice
      if (editing) {
        // Item identities are regenerated above, so keep the stored ones when the lines match.
        const keptItems = payload.items.map((item, index) => ({ ...item, id: editing.items[index]?.id || item.id }))
        await updateInvoice(editing.id, { ...payload, items: keptItems })
        saved = { ...editing, ...payload, items: keptItems }
      } else {
        saved = await addInvoice({ ...payload, number: nextNumber, status: 'draft' })
      }
      closeForm()
      return saved
    } catch (error) { await showAlert(errorText(error)); return null } finally { setBusy(false) }
  }

  /** Save through the ONE store path, then export through the ONE PDF pipeline. */
  async function saveAndDownload() {
    const saved = await save()
    if (!saved) return
    setBusy(true)
    try {
      await shareInvoicePdf(saved, business, customers.find(c => c.id === saved.customerId), saved.currency || settings?.currency, settings)
    } catch (error) {
      await showAlert(tr('PDF share not completed') + ': ' + errorText(error))
    } finally { setBusy(false) }
  }

  /** Resets only the unsaved draft on screen. Saved invoices are never touched. */
  async function clearDraft() {
    const meaningful = form.customerId || form.notes.trim() || form.privateNotes.trim() || form.poNumber.trim()
      || form.salesperson.trim() || form.shippingAddress.trim()
      || form.items.some(item => item.description.trim() || item.unitPrice || item.itemCode?.trim())
    if (meaningful && !await askConfirm(tr('Clear this form? Only the unsaved draft on screen is reset; saved invoices are not touched.'))) return
    setShipToOpen(false)
    setForm(emptyForm({
      currency: prefs.defaultCurrency, language: prefs.language, pdfColor: prefs.pdfColor,
      taxRate: settings?.taxRate || 0, template: templateDefaults(settings, region), dueDays: settings?.defaultDueDays,
    }))
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
    // Issued invoices stay in the gap-free series; the store enforces it too.
    if (invoice.status !== 'draft') { await showAlert(tr('Only a draft invoice can be deleted. An issued invoice must stay in the sequence; change its status instead.')); return }
    if (!await askConfirm(tr('Delete invoice {number}? This cannot be undone.', { number: invoice.number }))) return
    try { await deleteInvoice(invoice.id) } catch (error) { await showAlert(errorText(error)) }
  }

  /** Full-amount draft credit note in its own AV series; the original invoice is never modified. */
  async function createCreditNote(invoice: Invoice) {
    if (!await askConfirm(tr('Create a draft credit note for invoice {number}? It starts with the full amount; adjust the lines while it is a draft.', { number: invoice.number }))) return
    setBusy(true)
    try {
      const cnPrefix = settings?.creditNotePrefix || CREDIT_NOTE_FALLBACK_PREFIX
      const number = nextDocumentNumber(invoices.map(row => row.number), cnPrefix, CREDIT_NOTE_FALLBACK_PREFIX, new Date(), seriesFloor(settings?.numberFloor, cnPrefix, CREDIT_NOTE_FALLBACK_PREFIX))
      await addInvoice(creditNoteFromInvoice(invoice, number, new Date().toISOString().slice(0, 10)))
      await showAlert(tr('Draft credit note created'))
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  async function share(invoice: Invoice) {
    setBusy(true)
    try {
      await shareInvoicePdf(invoice, business, customers.find(c => c.id === invoice.customerId), invoice.currency || settings?.currency, settings)
    } catch (error) {
      await showAlert(tr('PDF share not completed') + ': ' + errorText(error))
    } finally { setBusy(false) }
  }

  // One "today" per render: the filter, the badges and the chips can never disagree.
  const today = todayISO()
  const visible = invoices.filter(invoice => {
    if (filter !== 'all' && effectiveStatus(invoice, today) !== filter) return false
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
          {editing && editing.status !== 'draft' && (
            <p className="mb-4 rounded-lg border border-line bg-warn-50 px-3 py-2 text-[12.5px] text-serious">
              {t('An issued document is locked: amounts, customer, issue date and numbering cannot change. Create a credit note to correct it.')}
            </p>
          )}
          <div className="xl:grid xl:grid-cols-5 xl:gap-6">
          <div className="xl:col-span-3 min-w-0">
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
              {selectedCustomer && (
                <p className="mt-1.5 text-[12px] text-muted">
                  <span className="font-semibold">{t('Billing address')}:</span>{' '}
                  {[selectedCustomer.address, selectedCustomer.city].filter(part => part?.trim()).join(', ') || t('No address on file for this customer.')}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink mb-2">{t("Items")}</label>
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
                  <input aria-label={t('Item code')} placeholder={t('Item code')} value={item.itemCode || ''} onChange={e => {
                    const items = [...form.items]; items[idx] = { ...item, itemCode: e.target.value }; setForm({ ...form, items })
                  }} className={`col-span-2 ${inputClass}`} />
                  <input aria-label={t('Description')} placeholder={t("Description")} value={item.description} onChange={e => {
                    const items = [...form.items]; items[idx] = { ...item, description: e.target.value }; setForm({ ...form, items })
                  }} className={`col-span-4 ${inputClass}`} />
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
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unitPrice: 0 }] })} className="text-[13px] text-brand hover:text-brand-700">{t("+ Add item")}</button>
                {products.length > 0 && (
                  <select aria-label={tr('Add from products')} value="" onChange={e => {
                    const product = products.find(candidate => candidate.id === e.target.value)
                    if (product) setForm({ ...form, items: [...form.items, productToLine(product)] })
                  }} className="text-[13px] text-brand bg-transparent border border-line rounded-lg px-2 py-1 outline-none focus:border-brand">
                    <option value="">{tr('Add from products')}</option>
                    {products.map(product => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` (${product.sku})` : ''}</option>)}
                  </select>
                )}
              </div>
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
                <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Payment terms')}</span>
                {/* A convenience picker over the existing dueDate field - no second term engine. */}
                <select aria-label={t('Payment terms')} value={(() => {
                  const gap = paymentTermsGap(form.issueDate, form.dueDate)
                  return gap !== null && (PAYMENT_TERM_DAYS as readonly number[]).includes(gap) ? String(gap) : 'custom'
                })()} onChange={e => {
                  if (e.target.value !== 'custom') setForm({ ...form, dueDate: dueDateFromTerms(form.issueDate, Number(e.target.value)) })
                }} className={inputClass}>
                  {PAYMENT_TERM_DAYS.map(days => <option key={days} value={String(days)}>
                    {days === 0 ? t('Due on receipt') : t('Due in {days} days', { days: number(days) })}</option>)}
                  <option value="custom">{t('Custom')}</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Due date")}</span>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className={inputClass} />
                {region === 'MA' && (() => {
                  // Advisory only (Law 69-21): a hint above 60 days, a stronger one above 120. Saving is never blocked.
                  const level = paymentTermsLevel(paymentTermsGap(form.issueDate, form.dueDate))
                  if (level === 'ok') return null
                  return <span className="mt-1 block text-[11.5px] text-warn">{t(level === 'excessive'
                    ? 'This due date is more than 120 days after the issue date. In Morocco, between businesses, 120 days is the maximum payment term a contract can set, apart from regulated sector derogations.'
                    : 'This due date is more than 60 days after the issue date. In Morocco, between businesses, terms beyond 60 days should be agreed in writing; the contractual maximum is 120 days.')}</span>
                })()}
              </label>
              {region === 'MA' && (
                <label className="block sm:col-span-3">
                  <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Client ICE')}</span>
                  <input aria-label={t('Client ICE')} value={selectedCustomer?.taxNumber || ''} readOnly placeholder={t('Stored with the selected customer')} className={`${inputClass} bg-canvas`} />
                  {assistant && <span className={`mt-1 block text-[11.5px] ${selectedCustomer && !selectedCustomer.taxNumber ? 'text-warn' : 'text-muted'}`}>{t(selectedCustomer && !selectedCustomer.taxNumber ? hints.customerTaxMissing : hints.customerTax)}</span>}
                </label>
              )}
            </div>

            <details className="rounded-lg border border-line p-3" open={Boolean(form.poNumber || form.salesperson || form.shippingAddress)}>
              <summary className="cursor-pointer text-[13px] font-semibold text-ink">{t('Other invoice fields')}</summary>
              <p className="mt-1 text-[11.5px] text-muted">{t('Optional. Printed on the document only when filled.')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <label className="block">
                  <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Purchase order #')}</span>
                  <input aria-label={t('Purchase order #')} value={form.poNumber} maxLength={120} onChange={e => setForm({ ...form, poNumber: e.target.value })} className={inputClass} />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Salesperson')}</span>
                  <input aria-label={t('Salesperson')} value={form.salesperson} maxLength={120} onChange={e => setForm({ ...form, salesperson: e.target.value })} className={inputClass} />
                </label>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-[13px] text-ink">
                    <input type="checkbox" checked={!(shipToOpen || form.shippingAddress !== '')} onChange={e => {
                      if (e.target.checked) { setShipToOpen(false); setForm({ ...form, shippingAddress: '' }) } else setShipToOpen(true)
                    }} />
                    {t('Same as billing address')}
                  </label>
                  {(shipToOpen || form.shippingAddress !== '') && (
                    <label className="mt-2 block">
                      <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Shipping address')}</span>
                      <textarea aria-label={t('Shipping address')} value={form.shippingAddress} rows={3} onChange={e => setForm({ ...form, shippingAddress: e.target.value })} className={inputClass} />
                    </label>
                  )}
                </div>
              </div>
            </details>

            <div className="bg-canvas p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-[13px]"><span>{t("Subtotal:")}</span><span className="font-medium">{money(totals.subtotal, form.currency, false, form.language)}</span></div>
              <div className="flex justify-between text-[13px]"><span>{t("Tax")} {effectiveRate ? `(${number(effectiveRate)}%)` : ''}:</span><span className="font-medium">{money(totals.tax, form.currency, false, form.language)}</span></div>
              <div className="flex justify-between text-[13px] font-bold pt-2 border-t border-line"><span>{t("Total:")}</span><span>{money(totals.total, form.currency, false, form.language)}</span></div>
              {editing && (editing.status === 'paid' || (editing.payments?.length || 0) > 0) && <>
                <div className="flex justify-between text-[13px] pt-2 border-t border-line"><span>{t('Amount paid')}:</span>
                  <span className="font-medium">{money(editing.status === 'paid' ? editing.total : paymentsTotal(editing, prefs.defaultCurrency), form.currency, false, form.language)}</span></div>
                <div className="flex justify-between text-[13px]"><span>{t('Balance')}:</span>
                  <span className="font-medium">{money(invoiceBalance(editing, prefs.defaultCurrency), form.currency, false, form.language)}</span></div>
              </>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Notes")}</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder={t("Thank you for your business!")} className={inputClass} rows={3} />
              <p className="mt-1 text-[11.5px] text-muted">{t('Printed on the document, visible to the customer.')}</p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Private note')}</label>
              <textarea aria-label={t('Private note')} value={form.privateNotes} onChange={e => setForm({ ...form, privateNotes: e.target.value })} className={inputClass} rows={2} />
              <p className="mt-1 text-[11.5px] text-muted">{t('Only you see it — never printed on the document, the preview or the PDF.')}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-6">
            <button disabled={busy} onClick={() => void save()} className="bg-brand text-white px-6 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{editing ? t('Save changes') : t("Create Invoice")}</button>
            <button disabled={busy} onClick={() => void saveAndDownload()} className="bg-brand/10 text-brand border border-brand/30 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 flex items-center gap-1.5"><Download className="w-4 h-4" />{t('Save & download PDF')}</button>
            <button disabled={busy} onClick={() => setDocPreview(true)} className="bg-canvas text-ink border border-line-strong px-4 py-2 rounded-lg text-[13px] font-medium">{t('Invoice preview')}</button>
            {!editing && <button disabled={busy} onClick={() => void clearDraft()} className="bg-canvas text-ink px-4 py-2 rounded-lg text-[13px]">{t('Clear')}</button>}
            <button disabled={busy} onClick={closeForm} className="bg-canvas text-ink px-6 py-2 rounded-lg text-[13px]">{t("Cancel")}</button>
          </div>
          </div>

          {/* Desktop workspace: the same model the PDF uses, repainted as you type. */}
          <aside className="hidden xl:block xl:col-span-2">
            <div className="sticky top-4 space-y-2">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em]">{t('Invoice preview')}</p>
              <Suspense fallback={<p className="text-[13px] text-muted">{t('Loading...')}</p>}>
                {previewModel && <ModelPreview model={previewModel} label={t('Invoice preview')} />}
              </Suspense>
            </div>
          </aside>
          </div>
        </div>
      )}

      {docPreview && previewModel && <Suspense fallback={<div className="fixed inset-0 z-50 grid place-items-center bg-canvas"><p className="text-[13px] text-muted">{t('Loading...')}</p></div>}>
        <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas p-4 sm:p-6" role="dialog" aria-label={t('Invoice preview')}>
          <div className="mx-auto max-w-3xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-ink">{t('Invoice preview')}</h2>
              <button onClick={() => setDocPreview(false)} className="inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:text-ink"><X className="w-4 h-4" />{t('Close')}</button>
            </div>
            <p className="text-[12px] text-muted">{t('Exactly what the PDF will look like — same data, same renderer.')}</p>
            <ModelPreview model={previewModel} label={t('Invoice preview')} />
          </div>
        </div>
      </Suspense>}

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
              const effective = effectiveStatus(invoice, today)
              return (
                <div key={invoice.id} className="p-4 hover:bg-canvas">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[13px] text-ink">{invoice.number}
                        {isCreditNote(invoice) && <span className="ms-2 inline-flex rounded-full bg-canvas border border-line px-2 py-0.5 text-[11px] font-semibold text-muted">{t('Credit note')}</span>}
                        {effective === 'overdue' && invoice.status === 'sent' && !isCreditNote(invoice) && <span className="ms-2 inline-flex rounded-full bg-warn-50 px-2 py-0.5 text-[11px] font-semibold text-serious">{t('overdue')}</span>}
                      </p>
                      <p className="text-[12px] text-muted mt-0.5">{customer?.name || t("Unknown")} • {formatDate(invoice.occurredAt || invoice.createdAt, true, invoice.language)}</p>
                      {isCreditNote(invoice) && invoice.creditsInvoiceId && <p className="text-[12px] text-muted mt-0.5">{tr('Credits invoice {number}', { number: invoices.find(row => row.id === invoice.creditsInvoiceId)?.number || t('Unknown') })}</p>}
                      {invoice.status !== 'paid' && invoice.status !== 'draft' && (invoice.payments?.length || 0) > 0 && (
                        <p className="text-[12px] text-muted mt-0.5">{t('Partially paid')} · {t('Outstanding')}: {money(invoiceBalance(invoice, prefs.defaultCurrency), invoice.currency, false, invoice.language)}</p>
                      )}
                      {invoice.status === 'paid' && invoice.paidAt && <p className="text-[12px] text-emerald-700 mt-0.5">{t('Paid on')} {formatDate(invoice.paidAt, false, invoice.language)}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-end me-1">
                        <p className="font-bold text-[13px] text-ink">{money(invoice.total, invoice.currency, false, invoice.language)}</p>
                        {!!invoice.tax && <p className="text-[11.5px] text-muted">{t('Tax')} {money(invoice.tax, invoice.currency, false, invoice.language)}</p>}
                      </div>
                      <select aria-label={`${t('Status')} ${invoice.number}`} value={invoice.status} onChange={e => void changeStatus(invoice, e.target.value as Status)} className={`text-[12px] rounded-lg border border-line-strong bg-surface px-2 py-1 ${effective === 'paid' ? 'text-emerald-700' : effective === 'overdue' ? 'text-serious' : 'text-ink'}`}>
                        {STATUSES.map(status => <option key={status} value={status}>{t(status)}</option>)}
                      </select>
                      {invoice.status !== 'paid' && <button onClick={() => void changeStatus(invoice, 'paid')} className="text-[12px] px-2 py-1 rounded-lg bg-good-50 text-emerald-700 font-semibold">{t('Mark as paid')}</button>}
                      <button disabled={busy} onClick={() => openEdit(invoice)} title={t('Edit')} aria-label={`${t('Edit')} ${invoice.number}`} className="p-2 hover:bg-canvas rounded-lg"><Pencil className="w-4 h-4 text-muted" /></button>
                      <button disabled={busy} onClick={() => void share(invoice)} title={t("Download PDF")} aria-label={`${t('Download PDF')} ${invoice.number}`} className="p-2 hover:bg-canvas rounded-lg"><Download className="w-4 h-4 text-muted" /></button>
                      <button disabled={busy} onClick={() => void share(invoice)} title={t("Share")} aria-label={`${t('Share')} ${invoice.number}`} className="p-2 hover:bg-canvas rounded-lg"><Share2 className="w-4 h-4 text-muted" /></button>
                      {invoice.status !== 'draft' && !isCreditNote(invoice) && <button disabled={busy} onClick={() => void createCreditNote(invoice)} className="text-[12px] text-muted hover:text-ink px-2 py-1">{t('Credit note')}</button>}
                      {invoice.status === 'draft' && <button onClick={() => void remove(invoice)} className="text-[12px] text-serious hover:text-serious px-2 py-1">{t("Delete")}</button>}
                    </div>
                  </div>
                  <details className="mt-2"><summary className="text-[12px] cursor-pointer text-muted">{t('Document options')}</summary><div className="mt-3"><DocumentOptions value={invoice} onChange={patch => void updateOptions(invoice, patch)} /></div></details>
                  {!isCreditNote(invoice) && invoice.status !== 'draft' && (
                    <details className="mt-1"><summary className="text-[12px] cursor-pointer text-muted">{t('Payments')}{invoice.status !== 'paid' && (invoice.payments?.length || 0) > 0 ? ` · ${t('Outstanding')}: ${money(invoiceBalance(invoice, prefs.defaultCurrency), invoice.currency, false, invoice.language)}` : ''}</summary>
                      <div className="mt-3"><PaymentsPanel invoice={invoice} onPatch={patch => updateInvoice(invoice.id, patch)} /></div>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Payments recorded against one invoice: list, remaining balance, small form.
 * All rules live in src/lib/payments.ts - this only renders the patches.
 */
function PaymentsPanel({ invoice, onPatch }: { invoice: Invoice; onPatch: (patch: Partial<Invoice>) => Promise<void> }) {
  const prefs = usePreferences()
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayISO())
  const [reference, setReference] = useState('')
  const balance = invoiceBalance(invoice, prefs.defaultCurrency)
  const received = invoice.status === 'paid' ? invoice.total : paymentsTotal(invoice, prefs.defaultCurrency)
  const inputClass = 'px-3 py-2 border border-line-strong rounded-lg text-[13px] bg-surface text-ink outline-none focus:border-brand'

  async function record() {
    try {
      await onPatch(recordPayment(invoice, { amount, date, reference }, prefs.defaultCurrency))
      setAmount(0); setReference('')
    } catch (error) { await showAlert(errorText(error)) }
  }

  async function remove(paymentId: string) {
    if (!await askConfirm(t('Remove this payment?'))) return
    try { await onPatch(removePayment(invoice, paymentId, prefs.defaultCurrency)) } catch (error) { await showAlert(errorText(error)) }
  }

  return (
    <div className="rounded-lg border border-line bg-canvas/40 p-3 space-y-3">
      <p className="text-[12px] text-muted">
        {t('Paid')}: <span className="font-semibold text-ink">{money(received, invoice.currency, false, invoice.language)}</span>
        {' · '}{t('Outstanding')}: <span className={`font-semibold ${balance > 0 ? 'text-serious' : 'text-emerald-700'}`}>{money(balance, invoice.currency, false, invoice.language)}</span>
      </p>
      {(invoice.payments || []).length > 0 && (
        <ul className="divide-y divide-line">
          {(invoice.payments || []).map(payment => (
            <li key={payment.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-[12.5px] text-ink">{formatDate(payment.date, false, invoice.language)} · <span className="font-semibold">{money(payment.amount, invoice.currency, false, invoice.language)}</span>{payment.reference ? <span className="text-muted"> · {payment.reference}</span> : null}</span>
              <button onClick={() => void remove(payment.id)} className="text-[12px] text-serious px-2 py-0.5">{t('Delete')}</button>
            </li>
          ))}
        </ul>
      )}
      {balance > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-[11px] font-semibold text-muted mb-1 uppercase tracking-[0.06em]">{t('Amount')}</span>
            <NumberInput aria-label={t('Amount')} value={amount} onChange={setAmount} className={inputClass + ' w-28'} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-muted mb-1 uppercase tracking-[0.06em]">{t('Date')}</span>
            <input type="date" aria-label={t('Date')} value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-muted mb-1 uppercase tracking-[0.06em]">{t('Reference')}</span>
            <input aria-label={t('Reference')} value={reference} maxLength={120} onChange={e => setReference(e.target.value)} className={inputClass + ' w-36'} placeholder={t('Optional')} />
          </label>
          <button onClick={() => void record()} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold shadow-sm">{t('Record payment')}</button>
        </div>
      )}
    </div>
  )
}
