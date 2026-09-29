import { showAlert } from '../lib/dialogs'
import { number } from '../lib/format'
import { t } from '../i18n'
import DocumentOptions from '../components/DocumentOptions'
import { getPreferences } from '../lib/preferences'
import { roundMoney, sumMoney, formatDate } from '../lib/format'
import { errorText } from '../i18n'
import { shareInvoicePdf } from '../lib/invoice-pdf'
import type { Invoice } from '../store/types'
import ExportCsvButton from '../components/ExportCsvButton'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { money, generateInvoiceNumber } from '../lib/fatorati'
import { Plus, Download, Share2, X } from 'lucide-react'

export default function Invoices() {
  const { invoices, customers, business, settings, addInvoice, deleteInvoice, updateInvoice } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    currency: getPreferences().defaultCurrency, language: getPreferences().language, pdfColor: getPreferences().pdfColor, exchangeRate: undefined as number | undefined, rateCurrency: undefined as string | undefined,
    customerId: '',
    items: [{ description: '', quantity: 1, unitPrice: 0 }],
    notes: '',
  })

  function calculateTotal() {
    const subtotal = sumMoney(form.items.map(item=>roundMoney(item.quantity * roundMoney(item.unitPrice,form.currency), form.currency)), form.currency)
    return { subtotal, tax: 0, total: subtotal }
  }

  async function handleAdd() {
    try {
    if (!form.customerId || form.items.length === 0) return
    const { subtotal, tax, total } = calculateTotal()
    
    const items = form.items.map(item => ({
      id: Math.random().toString(36).slice(2),
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }))

    await addInvoice({
      number: generateInvoiceNumber('INV'),
      currency: form.currency, language: form.language, pdfColor: form.pdfColor, exchangeRate: form.exchangeRate, rateCurrency: form.rateCurrency,
      customerId: form.customerId,
      items,
      subtotal,
      tax,
      total,
      status: 'draft',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: form.notes,
    })
    
    setForm({ ...form, customerId: '', items: [{ description: '', quantity: 1, unitPrice: 0 }], notes: '' })
    setShowAdd(false)
    } catch (error) { showAlert(errorText(error)) }
  }

  const [sharing, setSharing] = useState(false)
  async function handleShare(invoice: Invoice) {
    setSharing(true)
    try {
      await shareInvoicePdf(invoice, business, customers.find(c => c.id === invoice.customerId), invoice.currency || settings?.currency)
    } catch (error) {
      showAlert(t('PDF share not completed') + ': ' + (errorText(error)))
    } finally { setSharing(false) }
  }

  const { subtotal, total } = calculateTotal()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Invoices")}</h1>
          <p className="text-[13px] text-muted mt-1">{number(invoices.length)} {t("invoices • Create invoice → PDF → Share")}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4" />{t("New Invoice")}</button>
      </div>

      <ExportCsvButton store="invoices" />

      {showAdd && (
        <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{t("Create Invoice")}</h2>
          <DocumentOptions value={form} onChange={patch=>setForm({...form,...patch})} />
          
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Customer *")}</label>
              <select aria-label={t('Customer')} value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15">
                <option value="">{t("Select customer")}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink mb-2">{t("Items")}</label>
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
                  <input placeholder={t("Description")} value={item.description} onChange={e => {
                    const newItems = [...form.items]
                    newItems[idx].description = e.target.value
                    setForm({...form, items: newItems})
                  }} className="col-span-6 px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
                  <input type="number" placeholder={t("Qty")} value={item.quantity} onChange={e => {
                    const newItems = [...form.items]
                    newItems[idx].quantity = parseFloat(e.target.value) || 0
                    setForm({...form, items: newItems})
                  }} className="col-span-2 px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
                  <input type="number" placeholder={t("Price")} value={item.unitPrice} onChange={e => {
                    const newItems = [...form.items]
                    newItems[idx].unitPrice = parseFloat(e.target.value) || 0
                    setForm({...form, items: newItems})
                  }} className="col-span-3 px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
                  <button onClick={() => {
                    setForm({...form, items: form.items.filter((_, i) => i !== idx)})
                  }} aria-label={t("Remove item")} className="col-span-1 text-serious text-[13px]"><X className="w-4 h-4 mx-auto" /></button>
                </div>
              ))}
              <button onClick={() => setForm({...form, items: [...form.items, { description: '', quantity: 1, unitPrice: 0 }]})} className="text-[13px] text-brand hover:text-brand-700">{t("+ Add item")}</button>
            </div>

            <div className="bg-canvas p-4 rounded-lg">
              <div className="flex justify-between text-[13px]">
                <span>{t("Subtotal:")}</span>
                <span className="font-medium">{money(subtotal,form.currency)}</span>
              </div>
              <div className="flex justify-between text-[13px] font-bold mt-2 pt-2 border-t">
                <span>{t("Total:")}</span>
                <span>{money(total,form.currency)}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Notes")}</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder={t("Thank you for your business!")} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" rows={3} />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button onClick={handleAdd} className="bg-brand text-white px-6 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t("Create Invoice")}</button>
            <button onClick={() => setShowAdd(false)} className="bg-canvas text-ink px-6 py-2 rounded-lg text-[13px]">{t("Cancel")}</button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {invoices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted text-[13px]">{t("No invoices yet")}</p>
            <p className="text-[12px] text-faint mt-1">{t("Create your first invoice → PDF → Share")}</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {invoices.map((invoice) => {
              const customer = customers.find(c => c.id === invoice.customerId)
              return (
                <div key={invoice.id} className="p-4 hover:bg-canvas">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[13px] text-ink">{invoice.number}</p>
                      <details className="mt-2"><summary className="text-[12px] cursor-pointer">{t('Document options')}</summary><DocumentOptions value={invoice} onChange={patch=>void updateInvoice(invoice.id,patch).catch(e=>showAlert(errorText(e)))}/></details>
                      <p className="text-[12px] text-muted mt-0.5">{customer?.name || t("Unknown")} • {formatDate(invoice.occurredAt || invoice.createdAt,true,invoice.language)}</p>
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${
                        invoice.status === 'paid' ? 'bg-good-50 text-emerald-700' :
                        invoice.status === 'sent' ? 'bg-brand-100 text-brand-700' :
                        'bg-canvas text-ink'
                      }`}>
                        {t(invoice.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-end me-2">
                        <p className="font-bold text-[13px] text-ink">{money(invoice.total,invoice.currency,false,invoice.language)}</p>
                      </div>
                      <button disabled={sharing} onClick={() => handleShare(invoice)} className="p-2 hover:bg-canvas rounded-lg" title={t("Download PDF")}>
                        <Download className="w-4 h-4 text-muted" />
                      </button>
                      <button disabled={sharing} onClick={() => handleShare(invoice)} className="p-2 hover:bg-canvas rounded-lg" title={t("Share")}>
                        <Share2 className="w-4 h-4 text-muted" />
                      </button>
                      <button onClick={() => deleteInvoice(invoice.id)} className="text-[12px] text-serious hover:text-serious px-2 py-1">{t("Delete")}</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
