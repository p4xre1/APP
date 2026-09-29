import { showAlert } from '../lib/dialogs'
import { errorText } from '../i18n'
import { number } from '../lib/format'
import { t } from '../i18n'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { Plus } from 'lucide-react'

export default function Projects() {
  const { projects, customers, addProject, deleteProject } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', customerId: '', description: '', budget: 0 })

  async function handleAdd() {
    try {
    if (!form.name.trim()) return
    await addProject({
      name: form.name.trim(),
      customerId: form.customerId,
      description: form.description.trim(),
      status: 'planning',
      budget: form.budget,
    })
    setForm({ name: '', customerId: '', description: '', budget: 0 })
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
        <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{t("Add Project")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder={t("Project name *")} value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <select value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15">
              <option value="">{t("Select customer")}</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" placeholder={t("Budget")} value={form.budget} onChange={e => setForm({...form, budget: parseFloat(e.target.value) || 0})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <input placeholder={t("Description")} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleAdd} className="bg-brand text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t("Save")}</button>
            <button onClick={() => setShowAdd(false)} className="bg-canvas text-ink px-4 py-2 rounded-lg text-[13px]">{t("Cancel")}</button>
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
                <div key={project.id} className="p-4 flex items-center justify-between hover:bg-canvas">
                  <div>
                    <p className="font-medium text-[13px] text-ink">{project.name}</p>
                    <p className="text-[12px] text-muted mt-0.5">{customer?.name || t("No customer")} • {t(project.status)}</p>
                  </div>
                  <button onClick={() => deleteProject(project.id)} className="text-[12px] text-serious hover:text-serious px-2 py-1">{t("Delete")}</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
