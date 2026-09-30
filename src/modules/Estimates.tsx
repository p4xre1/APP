import { Plus, Share2, Pencil, FilePlus2 } from 'lucide-react'
import { showAlert, askConfirm } from '../lib/dialogs'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { money, number as formatNumber, documentTotals, lineTotal, formatDate } from '../lib/format'
import { nextDocumentNumber, seriesFloor } from '../lib/fatorati'
import { canConvertEstimate, invoiceFromEstimate } from '../lib/convert'
import { clampDueDays } from '../lib/status'
import { assistantRegion, assistantStartsOpen, assistantVisible, hintsFor, settingsRegion, TAX_REGION_LABEL } from '../lib/taxGuide'
import { getPreferences } from '../lib/preferences'
import { shareInvoicePdf } from '../lib/invoice-pdf'
import { useI18n, usePreferences, errorText } from '../i18n'
import DocumentOptions, { type DocumentPreferences } from '../components/DocumentOptions'
import TaxAssistantPanel, { ShowTaxAssistantButton } from '../components/TaxAssistant'
import NumberInput from '../components/NumberInput'
import type { Estimate } from '../store/types'
import TemplateFields, { LineExtras } from '../components/TemplateFields'
import { productToLine } from '../lib/products'
import { COLUMN_LABEL, PRESETS, documentTemplate, presetIsTaxExempt, presetLabels, presetRateHint, templateColumns, templateDefaults, type DocumentTemplate } from '../lib/templates'
import { mandatoryFields } from '../lib/template-render'
import { takeIntent } from '../lib/navigation-intent'

const TemplatePicker = lazy(() => import('./TemplatePicker').then(module => ({ default: module.TemplatePicker })))

type Status = Estimate['status']
const STATUSES: Status[] = ['draft', 'sent', 'accepted', 'declined']

export default function Estimates() {
  const { t } = useI18n()
  const prefs = usePreferences()
  const { estimates, invoices, customers, products, business, settings, addEstimate, updateEstimate, deleteEstimate, addInvoice, updateSettings } = useFatorati()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Estimate | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const [form, setForm] = useState(() => ({
    customerId: '', productId: undefined as string | undefined, description: '', quantity: 1, unitPrice: 0, notes: '',
    unit: '', section: '', discount: undefined as number | undefined,
    paymentMethod: '',
    template: templateDefaults(settings, settingsRegion(settings)) as DocumentTemplate,
    taxRate: settings?.taxRate || 0,
    currency: getPreferences().defaultCurrency, language: getPreferences().language,
    pdfColor: getPreferences().pdfColor,
    exchangeRate: undefined as number | undefined, rateCurrency: undefined as string | undefined,
  }))
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

  const prefix = settings?.estimatePrefix || 'EST'
  const nextNumber = useMemo(() => nextDocumentNumber(estimates.map(row => row.number), prefix, 'EST', new Date(), seriesFloor(settings?.numberFloor, prefix, 'EST')), [estimates, prefix, settings?.numberFloor])
  const exempt = presetIsTaxExempt(form.template)
  const effectiveRate = exempt ? 0 : form.taxRate
  const totals = documentTotals([{ quantity: form.quantity, unitPrice: form.unitPrice, discount: form.discount }], effectiveRate, form.currency)
  const assistant = assistantVisible(settings)
  const region = settingsRegion(settings)
  const assistantRegionValue = assistantRegion(settings)
  const hints = hintsFor(assistantRegionValue)
  const columns = templateColumns(form.template)
  const preset = PRESETS[form.template.presetId]
  const selectedCustomer = customers.find(c => c.id === form.customerId)
  const missing = mandatoryFields({ region, business, customer: selectedCustomer, template: form.template, paymentMethod: form.paymentMethod, language: form.language || prefs.language }).missing

  // A row tapped in the calendar leaves its id here; it is consumed exactly once.
  useEffect(() => {
    const id = takeIntent('estimates')
    if (!id) return
    const estimate = estimates.find(row => row.id === id)
    if (estimate) openEdit(estimate)
  }, [estimates])

  function openCreate() {
    setForm({
      customerId: '', productId: undefined, description: '', quantity: 1, unitPrice: 0, notes: '',
      unit: '', section: '', discount: undefined,
      paymentMethod: '',
      template: templateDefaults(settings, region),
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
      productId: item?.productId,
      description: item?.description || '',
      quantity: item?.quantity ?? 1,
      unitPrice: item?.unitPrice ?? 0,
      unit: item?.unit || '', section: item?.section || '', discount: item?.discount,
      notes: estimate.notes,
      paymentMethod: estimate.paymentMethod || '',
      template: documentTemplate(estimate.template, region),
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
      const rate = presetIsTaxExempt(form.template) ? 0 : form.taxRate
      const recalculated = documentTotals([{ quantity: form.quantity, unitPrice: form.unitPrice, discount: form.discount }], rate, form.currency)
      const item = {
        id: editing?.items[0]?.id || crypto.randomUUID(),
        ...(form.productId ? { productId: form.productId } : {}),
        description: form.description.trim(),
        quantity: form.quantity, unitPrice: form.unitPrice,
        ...(form.unit ? { unit: form.unit } : {}),
        ...(form.section ? { section: form.section } : {}),
        ...(form.discount ? { discount: form.discount } : {}),
        total: lineTotal(form.quantity, form.unitPrice, form.currency, form.discount),
      }
      const payload = {
        customerId: form.customerId, currency: form.currency, language: form.language, pdfColor: form.pdfColor,
        exchangeRate: form.exchangeRate, rateCurrency: form.rateCurrency, taxRate: rate,
        paymentMethod: form.paymentMethod, template: form.template,
        items: [item], subtotal: recalculated.subtotal, tax: recalculated.tax, total: recalculated.total, notes: form.notes,
      }
      if (editing) await updateEstimate(editing.id, payload)
      else await addEstimate({
        ...payload, number: nextNumber, status: 'draft',
        issueDate: new Date().toISOString().slice(0, 10),
        expiryDate: new Date(Date.now() + clampDueDays(settings?.defaultDueDays) * 86400_000).toISOString().slice(0, 10),
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

  /** Sent or accepted estimates become a draft invoice, exactly once. */
  async function convert(estimate: Estimate) {
    if (!canConvertEstimate(estimate)) { await showAlert(t('Only a sent or accepted estimate can be converted to an invoice.')); return }
    if (!await askConfirm(t('Create a draft invoice from estimate {number}?', { number: estimate.number }))) return
    setBusy(true)
    try {
      const invoicePrefix = settings?.invoicePrefix || 'INV'
      const number = nextDocumentNumber(invoices.map(row => row.number), invoicePrefix, 'INV', new Date(), seriesFloor(settings?.numberFloor, invoicePrefix, 'INV'))
      const invoice = await addInvoice(invoiceFromEstimate(
        estimate, number,
        new Date().toISOString().slice(0, 10),
        new Date(Date.now() + clampDueDays(settings?.defaultDueDays) * 86400_000).toISOString().slice(0, 10),
      ))
      await updateEstimate(estimate.id, { status: 'accepted', convertedInvoiceId: invoice.id })
      await showAlert(t('Draft invoice created'))
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  async function share(estimate: Estimate) {
    setBusy(true)
    try { await shareInvoicePdf(estimate, business, customers.find(c => c.id === estimate.customerId), estimate.currency, settings) }
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

        <div className="rounded-lg border border-line bg-canvas/40 p-4">
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
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Customer')}</span>
          <select aria-label={t('Customer')} value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className={inputClass}><option value="">{t('Select customer')}</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        {products.length > 0 && (
          <label className="block">
            <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Use a product')}</span>
            <select aria-label={t('Use a product')} value={form.productId || ''} onChange={e => {
              const product = products.find(candidate => candidate.id === e.target.value)
              if (!product) { setForm({ ...form, productId: undefined }); return }
              const line = productToLine(product)
              setForm({ ...form, productId: line.productId, description: line.description, unitPrice: line.unitPrice, unit: line.unit || '' })
            }} className={inputClass}>
              <option value="">—</option>
              {products.map(product => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` (${product.sku})` : ''}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Description')}</span>
          <input aria-label={t('Description')} placeholder={t('Description')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} />
        </label>
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-12 sm:col-span-5">
            <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Quantity')}</span>
            <NumberInput aria-label={t(presetLabels(form.template.presetId).quantity || COLUMN_LABEL.quantity)} value={form.quantity} onChange={quantity => setForm({ ...form, quantity })} className={inputClass} />
          </div>
          <div className="col-span-12 sm:col-span-5">
            <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Unit price')}</span>
            <NumberInput aria-label={t('Unit price')} value={form.unitPrice} onChange={unitPrice => setForm({ ...form, unitPrice })} className={inputClass} />
          </div>
          <LineExtras line={form} columns={columns} groupBy={preset.groupBy} units={preset.unitSuggestions}
            onChange={patch => setForm(current => ({ ...current, ...patch }))} />
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Tax rate')} (%)</span>
          <NumberInput aria-label={t('Tax rate')} value={effectiveRate} disabled={exempt} onChange={taxRate => setForm({ ...form, taxRate: Math.min(taxRate, 1000) })} className={inputClass} />
          {exempt
            ? <span className="mt-1 block text-[11.5px] text-muted">{t('TVA non applicable')} · {t('No TVA: the exemption mention replaces the tax lines.')}</span>
            : assistant && <span className="mt-1 block text-[11.5px] text-muted">{t(hints.taxRate)}</span>}
        </label>

        {assistant ? (
          <TaxAssistantPanel
            region={assistantRegionValue}
            onRegionChange={next => void updateSettings({ taxAssistantRegion: next }).catch(() => undefined)}
            onApplyRegion={next => void updateSettings({ taxRegion: next, taxAssistantRegion: next }).catch(() => undefined)}
            onHide={() => void updateSettings({ taxAssistantVisible: false }).catch(() => undefined)}
            startOpen={assistantStartsOpen(settings)}
            onFirstView={() => { if (settings?.taxAssistantSeen !== true) void updateSettings({ taxAssistantSeen: true }).catch(() => undefined) }}
          />
        ) : (
          <ShowTaxAssistantButton onShow={() => void updateSettings({ taxAssistantVisible: true }).catch(() => undefined)} />
        )}
        {assistant && <p className="text-[12px] text-muted">{t('{region} guidance is on for this form.', { region: t(TAX_REGION_LABEL[assistantRegionValue]) })}</p>}
        {assistant && region === 'MA' && <p className="text-[12px] text-muted">{t(hints.customerTax)}</p>}
        <div className="bg-canvas p-4 rounded-lg space-y-2">
          <div className="flex justify-between text-[13px]"><span>{t('Subtotal:')}</span><span className="font-medium">{money(totals.subtotal, form.currency, false, form.language)}</span></div>
          <div className="flex justify-between text-[13px]"><span>{t('Tax')} {effectiveRate ? `(${formatNumber(effectiveRate)}%)` : ''}:</span><span className="font-medium">{money(totals.tax, form.currency, false, form.language)}</span></div>
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
              {estimate.convertedInvoiceId
                ? <span className="text-[12px] text-muted px-2 py-1">{t('Converted to {number}', { number: invoices.find(inv => inv.id === estimate.convertedInvoiceId)?.number || t('Unknown') })}</span>
                : <button disabled={busy || !canConvertEstimate(estimate)} onClick={() => void convert(estimate)} title={t('Convert to invoice')} aria-label={`${t('Convert to invoice')} ${estimate.number}`} className="p-2 hover:bg-canvas rounded-lg disabled:opacity-40"><FilePlus2 className="w-4 h-4 text-muted" /></button>}
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
