/**
 * Fatorati Offline - Settings
 * 100% Local • Offline - Export/Import Backup, Business Settings
 */

import { useState, useRef } from 'react'
import { useFatorati } from '../store/useFatorati'
import { Download, Upload, Building2, Shield, Info } from 'lucide-react'

export default function Settings() {
  const { business, settings, updateBusiness, updateSettings, exportBackup, importBackup } = useFatorati()
  const [form, setForm] = useState({
    name: business?.name || '',
    ownerName: business?.ownerName || '',
    phone: business?.phone || '',
    email: business?.email || '',
    address: business?.address || '',
    city: business?.city || '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  async function handleSaveBusiness() {
    if (!business) return
    await updateBusiness({
      name: form.name,
      ownerName: form.ownerName,
      phone: form.phone,
      email: form.email,
      address: form.address,
      city: form.city,
    })
    alert('Business info saved')
  }

  async function handleExport() {
    try {
      await exportBackup()
    } catch (e) {
      alert('Export failed: ' + (e instanceof Error ? e.message : 'Unknown error'))
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.fatorati') && !file.name.endsWith('.json')) {
      alert('Please select a .fatorati backup file')
      return
    }

    setImporting(true)
    try {
      if (confirm('Importing backup will replace all current data. Continue?')) {
        await importBackup(file)
        alert('Backup imported successfully')
        window.location.reload()
      }
    } catch (err) {
      alert('Import failed: ' + (err instanceof Error ? err.message : 'Invalid backup file'))
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600 mt-1">Manage business and backup • 100% Local • Offline</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Business Information
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
              <input value={form.ownerName} onChange={e => setForm({...form, ownerName: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            
            <button onClick={handleSaveBusiness} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium">
              Save Business Info
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Backup & Restore
            </h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 text-sm">Export Backup</h3>
                <p className="text-xs text-blue-700 mt-1">
                  Download your business data as .fatorati file. Includes customers, invoices, products, etc. Your data stays on device.
                </p>
                <button onClick={handleExport} className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  Export Backup .fatorati
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-medium text-amber-900 text-sm">Import Backup</h3>
                <p className="text-xs text-amber-700 mt-1">
                  Restore from .fatorati backup file. This will replace all current data.
                </p>
                <input ref={fileInputRef} type="file" accept=".fatorati,.json" onChange={handleImport} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="mt-3 w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" />
                  {importing ? 'Importing...' : 'Import Backup'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Privacy & Offline
            </h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></span>
                <div>
                  <p className="font-medium text-gray-900">100% Local • Offline</p>
                  <p className="text-xs mt-0.5">Your data stays on device. No cloud, no subscription.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></span>
                <div>
                  <p className="font-medium text-gray-900">Works Offline</p>
                  <p className="text-xs mt-0.5">Airplane mode ready. Create invoice → PDF → Share</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></span>
                <div>
                  <p className="font-medium text-gray-900">No Tracking</p>
                  <p className="text-xs mt-0.5">No analytics, no tracking. Your business is private.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5" />
              App Info
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">App Name</span>
                <span className="font-medium text-gray-900">Fatorati</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Version</span>
                <span className="font-medium text-gray-900">1.0.0 Offline</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Storage</span>
                <span className="font-medium text-gray-900">IndexedDB • Local</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Currency</span>
                <select value={settings?.currency || 'USD'} onChange={e => updateSettings({ currency: e.target.value as any })} className="text-sm border border-gray-300 rounded px-2 py-1">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
