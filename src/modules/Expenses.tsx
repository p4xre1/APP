import { showAlert } from '../lib/dialogs'
import DateCalendar from '../components/DateCalendar'
import { errorText, useI18n } from '../i18n'
import { number } from '../lib/format'
import DocumentOptions from '../components/DocumentOptions'
import { getPreferences } from '../lib/preferences'
import { localInput, inputToUTC, formatDate } from '../lib/format'
import ExportCsvButton from '../components/ExportCsvButton'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { money } from '../lib/fatorati'
import { Plus } from 'lucide-react'
import NumberInput from '../components/NumberInput'
import { Field, TextField, fieldInputClass } from '../components/Field'
import { numberError } from '../lib/number-input'

export default function Expenses() {
  const { t } = useI18n()
  const { expenses, addExpense, deleteExpense } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [errors, setErrors] = useState<{ description?: string; amount?: string }>({})
  const [form, setForm] = useState({ currency: getPreferences().defaultCurrency, language:getPreferences().language, pdfColor:getPreferences().pdfColor, exchangeRate:undefined as number|undefined, rateCurrency:undefined as string|undefined, description: '', amount: null as number | null, category: '', vendor: '', date: localInput() })

  async function handleAdd() {
    try {
      const description = form.description.trim() ? undefined : 'Required field'
      const amount = numberError(form.amount, { required: true, min: 0.01 }) || undefined
      setErrors({ description, amount })
      if (description || amount) return
      await addExpense({
        currency:form.currency, language:form.language, exchangeRate:form.exchangeRate, rateCurrency:form.rateCurrency, occurredAt:inputToUTC(form.date),
        description: form.description.trim(),
        amount: form.amount ?? 0,
        category: form.category.trim(),
        vendor: form.vendor.trim(),
        date: form.date.slice(0,10),
      })
      setForm({ ...form, description: '', amount: null, category: '', vendor: '', date: localInput() })
      setErrors({})
      setShowAdd(false)
    } catch (error) { showAlert(errorText(error)) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Expenses")}</h1>
          <p className="text-[13px] text-muted mt-1">{number(expenses.length)} {t("expenses • 100% offline")}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4" />{t("Add Expense")}</button>
      </div>

      <ExportCsvButton store="expenses" />

      {showAdd && (
        <div className="bg-surface rounded-xl border border-line p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{t("Add Expense")}</h2>
          <DateCalendar value={form.date} onChange={date=>setForm({...form,date:date+form.date.slice(10)})} />
          <DocumentOptions value={form} onChange={patch=>setForm({...form,...patch})} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
            <TextField label={t('Description')} required value={form.description} error={errors.description} onChange={description => setForm({...form, description})} hint={t('What was this expense for?')} placeholder={t('Office supplies')} />
            <NumberInput label={t('Amount')} required value={form.amount} error={errors.amount} min={0.01} suffix={form.currency} hint={`${t('Amount')} (${form.currency})`} onChange={amount => setForm({...form, amount})} />
            <TextField label={t('Category')} value={form.category} onChange={category => setForm({...form, category})} hint={t('Optional, used in the expense chart')} placeholder={t('Travel')} />
            <TextField label={t('Vendor')} value={form.vendor} onChange={vendor => setForm({...form, vendor})} hint={t('Who was paid')} placeholder={t('Vendor')} />
            <Field label={t('Date and time')} hint={t('Interpreted in the selected time zone')}>
              <input type="datetime-local" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={fieldInputClass} />
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleAdd} className="bg-brand text-white px-3.5 py-2.5 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t("Save")}</button>
            <button onClick={() => { setShowAdd(false); setErrors({}) }} className="bg-canvas text-ink px-4 py-2.5 rounded-lg text-[13px]">{t("Cancel")}</button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {expenses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted text-[13px]">{t("No expenses yet")}</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {expenses.map((expense) => (
              <div key={expense.id} className="p-4 flex items-center justify-between gap-3 hover:bg-canvas">
                <div className="min-w-0">
                  <p className="font-medium text-[13px] text-ink break-words">{expense.description}</p>
                  <p className="text-[12px] text-muted mt-0.5 break-words">{[expense.category, expense.vendor, formatDate(expense.occurredAt||expense.date,true,expense.language)].filter(Boolean).join(' • ')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="tnum font-bold text-[13px] text-ink">{money(expense.amount,expense.currency)}</p>
                  <button onClick={() => deleteExpense(expense.id)} className="text-[12px] text-serious px-2 py-1">{t("Delete")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
