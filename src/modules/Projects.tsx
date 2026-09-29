import { useState } from 'react'
import { useFatorati } from '../store/useFatorati'
import { Plus } from 'lucide-react'

export default function Projects() {
  const { projects, customers, addProject, deleteProject } = useFatorati()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', customerId: '', description: '', budget: 0 })

  async function handleAdd() {
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
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-600 mt-1">{projects.length} projects • 100% offline</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Add Project</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Project name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <select value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">Select customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" placeholder="Budget" value={form.budget} onChange={e => setForm({...form, budget: parseFloat(e.target.value) || 0})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Save</button>
            <button onClick={() => setShowAdd(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No projects yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {projects.map((project) => {
              const customer = customers.find(c => c.id === project.customerId)
              return (
                <div key={project.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{project.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{customer?.name || 'No customer'} • {project.status}</p>
                  </div>
                  <button onClick={() => deleteProject(project.id)} className="text-xs text-red-600 hover:text-red-700 px-2 py-1">Delete</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
