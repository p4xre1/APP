import { showAlert } from '../lib/dialogs'
import { errorText } from '../i18n'
import { t, usePreferences } from '../i18n'
import { savePreferences, supportedValues } from '../lib/preferences'
import PreferencesPanel from '../components/PreferencesPanel'
import SecurityPanel from '../components/SecurityPanel'
/**
 * Fatorati Offline - Settings
 * 100% Local • Offline - Export/Import Backup, Business Settings
 */

import { useState } from 'react'
import BackupPanel from '../components/BackupPanel'
import { useFatorati } from '../store/useFatorati'
import { Building2, Shield, Info } from 'lucide-react'

export default function Settings() {
  const prefs = usePreferences()
  const { business, updateBusiness, updateSettings } = useFatorati()
  const [form, setForm] = useState({
    name: business?.name || '',
    ownerName: business?.ownerName || '',
    phone: business?.phone || '',
    email: business?.email || '',
    address: business?.address || '',
    city: business?.city || '',
  })
  async function handleCurrencyChange(currency: string) {
    try {
      if (business) await updateBusiness({ currency })
      await updateSettings({ currency })
      await savePreferences({ defaultCurrency: currency })
    } catch (error) { showAlert(errorText(error)) }
  }
  async function handleSaveBusiness() {
    try {
    if (!business) return
    await updateBusiness({
      name: form.name,
      ownerName: form.ownerName,
      phone: form.phone,
      email: form.email,
      address: form.address,
      city: form.city,
    })
    showAlert(t("Business info saved"))
    } catch (error) { showAlert(errorText(error)) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Settings")}</h1>
        <p className="text-[13px] text-muted mt-1">{t("Manage business and backup • 100% Local • Offline")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />{t("Business Information")}</h2>
          
          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Business Name")}</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Owner Name")}</label>
              <input value={form.ownerName} onChange={e => setForm({...form, ownerName: e.target.value})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Phone")}</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Email")}</label>
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("Address")}</label>
              <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("City")}</label>
              <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15" />
            </div>
            
            <button onClick={handleSaveBusiness} className="w-full bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t("Save Business Info")}</button>
          </div>
        </div>

        <div className="space-y-5">
          <BackupPanel />

          <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />{t("Privacy & Offline")}</h2>
            <div className="space-y-3 text-[13px] text-muted">
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-good-500 rounded-full mt-2"></span>
                <div>
                  <p className="font-medium text-ink">{t("100% Local • Offline")}</p>
                  <p className="text-[12px] mt-0.5">{t("Your data stays on device. No cloud, no subscription.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-good-500 rounded-full mt-2"></span>
                <div>
                  <p className="font-medium text-ink">{t("Works Offline")}</p>
                  <p className="text-[12px] mt-0.5">{t("Airplane mode ready. Create invoice → PDF → Share")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-good-500 rounded-full mt-2"></span>
                <div>
                  <p className="font-medium text-ink">{t("No Tracking")}</p>
                  <p className="text-[12px] mt-0.5">{t("No analytics, no tracking. Your business is private.")}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
              <Info className="w-5 h-5" />{t("App Info")}</h2>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted">{t("App Name")}</span>
                <span className="font-medium text-ink">{t("Fatorati")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{t("Version")}</span>
                <span className="font-medium text-ink">{t("1.0.0 Offline")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{t("Storage")}</span>
                <span className="font-medium text-ink">{t("IndexedDB • Local")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{t('Currency')}</span>
                <select aria-label={`${t('App Info')} — ${t('Currency')}`} value={prefs.defaultCurrency} onChange={e=>void handleCurrencyChange(e.target.value)} className="text-[13.5px] border border-line-strong rounded px-2 py-1 bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15">
                  {supportedValues('currency').map(code=><option key={code} value={code}>{code}</option>)}
                </select>
              </div>

            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <PreferencesPanel />
        <SecurityPanel />
      </div>
    </div>
  )
}
