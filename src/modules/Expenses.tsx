import { showAlert, askConfirm } from '../lib/dialogs'
import DateCalendar from '../components/DateCalendar'
import { errorText } from '../i18n'
import { money, number, localInput, inputToUTC, formatDate } from '../lib/format'
import { totalsByCurrency } from '../lib/reports'
import { t, usePreferences } from '../i18n'
import DocumentOptions from '../components/DocumentOptions'
import { getPreferences } from '../lib/preferences'
import NumberInput from '../components/NumberInput'
import ExportCsvButton from '../components/ExportCsvButton'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import type { Expense } from '../store/types'
import { Plus, Search, Pencil } from 'lucide-react'

function emptyForm() {
  return {
    currency: getPreferences().defaultCurrency, language: getPreferences().language,
    pdfColor: getPreferences().pdfColor,
    exchangeRate: undefined as number | undefined, rateCurrency: undefined as string | undefined,
    description: '', amount: 0, category: '', vendor: '', date: localInput(),
  }
}

export default function Expenses() {
  const prefs = usePreferences()
  const { expenses, addExpense, updateExpense, deleteExpense } = useFatorati()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

  const categories = [...new Set(expenses.map(expense => expense.category).filter(Boolean))]
  const filtered = expenses.filter(expense =>
    `${expense.description} ${expense.vendor} ${expense.category}`.toLowerCase().includes(search.toLowerCase()))
  const totals = totalsByCurrency(expenses.map(expense => ({ currency: expense.currency, amount: expense.amount })))

  async function save() {
    if (!form.description.trim() || form.amount <= 0) { await showAlert(t('Enter a description and an amount')); return }
    setBusy(true)
    try {
      const payload = {
        currency: form.currency, language: form.language, pdfColor: form.pdfColor,
        exchangeRate: form.exchangeRate, rateCurrency: form.rateCurrency,
        occurredAt: inputToUTC(form.date),
        description: form.description.trim(), amount: form.amount,
        category: form.category.trim(), vendor: form.vendor.trim(),
        date: form.date.slice(0, 10),
      }
      if (editing) await updateExpense(editing.id, payload)
      else await addExpense(payload)
      setForm(emptyForm()); setShowForm(false); setEditing(null)
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  async function remove(expense: Expense) {
    if (!await askConfirm(t('Delete expense {name}? This cannot be undone.', { name: expense.description }))) return
    try { await deleteExpense(expense.id) } catch (error) { await showAlert(errorText(error)) }
  }

  function openEdit(expense: Expense) {
    setForm({
      currency: expense.currency || prefs.defaultCurrency, language: expense.language || prefs.language,
      pdfColor: expense.pdfColor ?? prefs.pdfColor, exchangeRate: expense.exchangeRate, rateCurrency: expense.rateCurrency,
      description: expense.description, amount: expense.amount, category: expense.category, vendor: expense.vendor,
      date: localInput(expense.occurredAt || expense.createdAt),
    })
    setEditing(expense); setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Expenses")}</h1>
          <p className="text-[13px] text-muted mt-1">{number(expenses.length)} {t("expenses • 100% offline")}{totals.length ? ` • ${totals.map(row => money(row.total, row.currency)).join(' · ')}` : ''}</p>
        </div>
        <button onClick={() => { setForm(emptyForm()); setEditing(null); setShowForm(true) }} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4" />{t("Add Expense")}</button>
      </div>

      <ExportCsvButton store="expenses" />

      {showForm && (
        <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{editing ? t('Edit expense') : t("Add Expense")}</h2>
          <DateCalendar value={form.date} onChange={date => setForm({ ...form, date: date + form.date.slice(10) })} />
          <div className="mt-3"><DocumentOptions value={form} onChange={patch => setForm({ ...form, ...patch })} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Description *")}</span>
              <input aria-label={t('Description *')} placeholder={t("Description *")} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Amount *")} ({form.currency})</span>
              <NumberInput aria-label={t('Amount *')} placeholder={t("Amount *")} value={form.amount} onChange={amount => setForm({ ...form, amount })} className={inputClass} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Category")}</span>
              <input aria-label={t('Category')} list="expense-categories" placeholder={t("Category")} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputClass} />
              <datalist id="expense-categories">{categories.map(category => <option key={category} value={category} />)}</datalist></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Vendor")}</span>
              <input aria-label={t('Vendor')} placeholder={t("Vendor")} value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} className={inputClass} /></label>
            <label className="block md:col-span-2"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t('Date and time')}</span>
              <input aria-label={t('Date and time')} type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputClass} /></label>
          </div>
          <div className="flex gap-2 mt-4">
            <button disabled={busy} onClick={() => void save()} className="bg-brand text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{editing ? t('Save changes') : t("Save")}</button>
            <button disabled={busy} onClick={() => { setShowForm(false); setEditing(null) }} className="bg-canvas text-ink px-4 py-2 rounded-lg text-[13px]">{t("Cancel")}</button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 bg-canvas rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-faint" />
          <input type="text" aria-label={t('Search expenses...')} placeholder={t('Search expenses...')} value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-transparent outline-none text-[13.5px]" />
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted text-[13px]">{expenses.length ? t('No results') : t("No expenses yet")}</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((expense) => (
              <div key={expense.id} className="p-4 flex items-center justify-between gap-3 hover:bg-canvas">
                <div className="min-w-0">
                  <p className="font-medium text-[13px] text-ink">{expense.description}</p>
                  <p className="text-[12px] text-muted mt-0.5 truncate">{[expense.category, expense.vendor, formatDate(expense.occurredAt || expense.date, true, expense.language)].filter(Boolean).join(' • ')}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <p className="font-bold text-[13px] text-ink">{money(expense.amount, expense.currency)}</p>
                  <button onClick={() => openEdit(expense)} title={t('Edit')} aria-label={`${t('Edit')} ${expense.description}`} className="p-2 hover:bg-canvas rounded-lg"><Pencil className="w-4 h-4 text-muted" /></button>
                  <button onClick={() => void remove(expense)} className="text-[12px] text-serious hover:text-serious px-2 py-1">{t("Delete")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
