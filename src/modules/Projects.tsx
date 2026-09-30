import { showAlert, askConfirm } from '../lib/dialogs'
import { errorText } from '../i18n'
import { money, number } from '../lib/format'
import { t, usePreferences } from '../i18n'
import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import type { Project } from '../store/types'
import NumberInput from '../components/NumberInput'
import { Plus, Pencil } from 'lucide-react'

type Status = Project['status']
const STATUSES: Status[] = ['planning', 'active', 'on_hold', 'done']
const empty = { name: '', customerId: '', description: '', budget: 0, status: 'planning' as Status }

export default function Projects() {
  const prefs = usePreferences()
  const { projects, customers, addProject, updateProject, deleteProject } = useFatorati()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(empty)
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'

  async function save() {
    if (!form.name.trim()) { await showAlert(t('Enter a name')); return }
    setBusy(true)
    try {
      const payload = { ...form, name: form.name.trim(), description: form.description.trim() }
      if (editing) await updateProject(editing.id, payload)
      else await addProject(payload)
      setShowForm(false); setEditing(null); setForm(empty)
    } catch (error) { await showAlert(errorText(error)) } finally { setBusy(false) }
  }

  async function remove(project: Project) {
    if (!await askConfirm(t('Delete project {name}? This cannot be undone.', { name: project.name }))) return
    try { await deleteProject(project.id) } catch (error) { await showAlert(errorText(error)) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Projects")}</h1>
          <p className="text-[13px] text-muted mt-1">{number(projects.length)} {t("projects • 100% offline")}</p>
        </div>
        <button onClick={() => { setForm(empty); setEditing(null); setShowForm(true) }} className="bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg flex items-center gap-2 text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4" />{t("New Project")}</button>
      </div>

      {showForm && (
        <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="font-semibold text-ink mb-4">{editing ? t('Edit project') : t("Add Project")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Project name *")}</span>
              <input aria-label={t('Project name *')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Customer")}</span>
              <select aria-label={t('Customer')} value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className={inputClass}>
                <option value="">{t("Select customer")}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Budget")} ({prefs.defaultCurrency})</span>
              <NumberInput aria-label={t('Budget')} value={form.budget} onChange={budget => setForm({ ...form, budget })} className={inputClass} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Status")}</span>
              <select aria-label={t('Status')} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })} className={inputClass}>
                {STATUSES.map(status => <option key={status} value={status}>{t(status)}</option>)}
              </select></label>
            <label className="block md:col-span-2"><span className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Description")}</span>
              <input aria-label={t('Description')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} /></label>
          </div>
          <div className="flex gap-2 mt-4">
            <button disabled={busy} onClick={() => void save()} className="bg-brand text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{editing ? t('Save changes') : t("Save")}</button>
            <button disabled={busy} onClick={() => { setShowForm(false); setEditing(null) }} className="bg-canvas text-ink px-4 py-2 rounded-lg text-[13px]">{t("Cancel")}</button>
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
                    <p className="font-medium text-[13px] text-ink">{project.name}</p>
                    <p className="text-[12px] text-muted mt-0.5">{customer?.name || t("No customer")} • {t(project.status)}{project.budget ? ` • ${money(project.budget, prefs.defaultCurrency)}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setForm({ name: project.name, customerId: project.customerId, description: project.description || '', budget: project.budget || 0, status: project.status }); setEditing(project); setShowForm(true) }} title={t('Edit')} aria-label={`${t('Edit')} ${project.name}`} className="p-2 hover:bg-canvas rounded-lg"><Pencil className="w-4 h-4 text-muted" /></button>
                    <button onClick={() => void remove(project)} className="text-[12px] text-serious hover:text-serious px-2 py-1">{t("Delete")}</button>
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
