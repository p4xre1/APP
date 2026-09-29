import { showAlert } from '../lib/dialogs'
import { errorText, useI18n } from '../i18n'
import { number } from '../lib/format'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { Plus } from 'lucide-react'
import NumberInput from '../components/NumberInput'
import { Field, TextField, fieldInputClass } from '../components/Field'
import { getPreferences } from '../lib/preferences'

export default function Projects() {
  const { t } = useI18n()
  const { projects, customers, addProject, deleteProject } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [errors, setErrors] = useState<{ name?: string }>({})
  const [form, setForm] = useState({ name: '', customerId: '', description: '', budget: null as number | null })
  const currency = getPreferences().defaultCurrency

  async function handleAdd() {
    try {
      if (!form.name.trim()) { setErrors({ name: 'Required field' }); return }
      setErrors({})
      await addProject({
        name: form.name.trim(),
        customerId: form.customerId,
        description: form.description.trim(),
        status: 'planning',
        budget: form.budget ?? 0,
      })
      setForm({ name: '', customerId: '', description: '', budget: null })
      setShowAdd(false)
    } catch (error) { showAlert(errorText(error)) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Projects")}</h1>
          <p className="text-[13px] text-muted mt-1">{number(projects.length)} {t("projects • 100% offline")}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4" />{t("New Project")}</button>
      </div>

      {showAdd && (
        <div className="bg-surface rounded-xl border border-line p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{t("Add Project")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TextField label={t('Project name')} required value={form.name} error={errors.name} onChange={name => setForm({...form, name})} placeholder={t('Website redesign')} />
            <Field label={t('Customer')} hint={t('Optional project owner')}>
              <select aria-label={t('Customer')} value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})} className={fieldInputClass}>
                <option value="">{t('No customer')}</option>
                {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </Field>
            <NumberInput label={t('Budget')} value={form.budget} min={0} suffix={currency} hint={`${t('Budget')} (${currency})`} onChange={budget => setForm({...form, budget})} />
            <TextField className="md:col-span-2" label={t('Description')} value={form.description} onChange={description => setForm({...form, description})} hint={t('Internal project notes')} placeholder={t('Scope, deadlines, contacts')} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleAdd} className="bg-brand text-white px-3.5 py-2.5 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t("Save")}</button>
            <button onClick={() => { setShowAdd(false); setErrors({}) }} className="bg-canvas text-ink px-4 py-2.5 rounded-lg text-[13px]">{t("Cancel")}</button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted text-[13px]">{t("No projects yet")}</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {projects.map((project) => {
              const customer = customers.find(c => c.id === project.customerId)
              return (
                <div key={project.id} className="p-4 flex items-center justify-between gap-3 hover:bg-canvas">
                  <div className="min-w-0">
                    <p className="font-medium text-[13px] text-ink break-words">{project.name}</p>
                    <p className="text-[12px] text-muted mt-0.5 break-words">{customer?.name || t("No customer")} • {t(project.status)}</p>
                  </div>
                  <button onClick={() => deleteProject(project.id)} className="text-[12px] text-serious px-2 py-1 shrink-0">{t("Delete")}</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
