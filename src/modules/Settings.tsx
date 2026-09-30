import { showAlert } from '../lib/dialogs'
import { errorText } from '../i18n'
import { t, usePreferences } from '../i18n'
import { savePreferences, supportedValues } from '../lib/preferences'
import PreferencesPanel from '../components/PreferencesPanel'
import SecurityPanel from '../components/SecurityPanel'
import SubscriptionRemindersPanel from '../components/SubscriptionRemindersPanel'
/**
 * Fatorati Offline - Settings
 * 100% Local • Offline - Export/Import Backup, Business Settings
 */

import { useState } from 'react'
import BackupPanel from '../components/BackupPanel'
import { useFatorati } from '../store/useFatorati'
import NumberInput from '../components/NumberInput'
import { normalizePrefix } from '../lib/fatorati'
import { APP_VERSION } from '../lib/version'
import { aboutLinks } from '../lib/appConfig'
import { Building2, Shield, Info, HelpingHand, ExternalLink } from 'lucide-react'
import { ShowTaxAssistantButton } from '../components/TaxAssistant'
import { assistantVisible, hintsFor, settingsRegion, TAX_DISCLAIMER, TAX_REGION_LABEL, TAX_REGIONS } from '../lib/taxGuide'
import type { ModuleKey, TaxRegion } from '../store/types'

export default function Settings({ onNavigate }: { onNavigate?: (key: ModuleKey) => void }) {
  const prefs = usePreferences()
  const { business, settings, updateBusiness, updateSettings } = useFatorati()
  const [form, setForm] = useState({
    name: business?.name || '',
    ownerName: business?.ownerName || '',
    phone: business?.phone || '',
    email: business?.email || '',
    address: business?.address || '',
    city: business?.city || '',
    taxNumber: business?.taxNumber || '',
  })
  const [taxRate, setTaxRate] = useState(settings?.taxRate || 0)
  const [invoicePrefix, setInvoicePrefix] = useState(settings?.invoicePrefix || 'INV')
  const [estimatePrefix, setEstimatePrefix] = useState(settings?.estimatePrefix || 'EST')
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'
  const region = settingsRegion(settings)
  // Owner links ship empty; unconfigured rows stay hidden instead of showing a dead contact.
  const links = aboutLinks()
  const assistant = assistantVisible(settings)
  const hints = hintsFor(region)

  /** Settings owns the document region; the assistant region follows it from here. */
  async function handleTaxRegionChange(next: TaxRegion) {
    try { await updateSettings({ taxRegion: next, taxAssistantRegion: next }) }
    catch (error) { await showAlert(errorText(error)) }
  }

  async function handleCurrencyChange(currency: string) {
    try {
      if (business) await updateBusiness({ currency })
      await updateSettings({ currency })
      await savePreferences({ defaultCurrency: currency })
    } catch (error) { await showAlert(errorText(error)) }
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
        taxNumber: form.taxNumber.trim(),
      })
      await showAlert(t("Business info saved"))
    } catch (error) { await showAlert(errorText(error)) }
  }
  async function handleSaveDocumentDefaults() {
    try {
      await updateSettings({
        taxRate: Math.min(Math.max(taxRate, 0), 1000),
        invoicePrefix: normalizePrefix(invoicePrefix, 'INV'),
        estimatePrefix: normalizePrefix(estimatePrefix, 'EST'),
      })
      setInvoicePrefix(normalizePrefix(invoicePrefix, 'INV'))
      setEstimatePrefix(normalizePrefix(estimatePrefix, 'EST'))
      await showAlert(t("Document defaults saved"))
    } catch (error) { await showAlert(errorText(error)) }
  }

  const card = 'bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
  const label = 'block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t("Settings")}</h1>
        <p className="text-[13px] text-muted mt-1">{t("Manage business and backup • 100% Local • Offline")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className={card}>
          <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />{t("Business Information")}</h2>

          <div className="space-y-3.5">
            <div>
              <label className={label}>{t("Business Name")}</label>
              <input aria-label={t('Business Name')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={label}>{t("Owner Name")}</label>
              <input aria-label={t('Owner Name')} value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className={label}>{t("Phone")}</label>
                <input aria-label={t('Phone')} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={label}>{t("Email")}</label>
                <input aria-label={t('Email')} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={label}>{t(region === 'MA' ? 'ICE (15 digits)' : 'Tax number')}</label>
              <input aria-label={t('Tax number')} value={form.taxNumber} onChange={e => setForm({ ...form, taxNumber: e.target.value })} placeholder={t(region === 'MA' ? 'ICE / IF / TP / RC' : 'EIN / State tax ID')} className={inputClass} />
              {assistant && <span className="mt-1 block text-[11.5px] text-muted">{t(hints.businessTaxNumber)}</span>}
            </div>
            <div>
              <label className={label}>{t("Address")}</label>
              <input aria-label={t('Address')} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={label}>{t("City")}</label>
              <input aria-label={t('City')} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className={inputClass} />
            </div>

            <button onClick={handleSaveBusiness} className="w-full bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t("Save Business Info")}</button>
          </div>
        </div>

        <div className="space-y-5">
          <div className={card}>
            <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
              <HelpingHand className="w-5 h-5" />{t('Tax assistant')}</h2>
            <div className="space-y-3.5">
              <p className="text-[12px] text-muted">{t('Regional guidance shown on invoice and estimate forms. Bundled with the app, no internet needed.')}</p>
              <label className="flex min-h-12 items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" checked={assistant} onChange={e => void updateSettings({ taxAssistantVisible: e.target.checked }).catch(error => void showAlert(errorText(error)))} />
                {t('Tax assistant')}
              </label>
              {!assistant && <ShowTaxAssistantButton onShow={() => void updateSettings({ taxAssistantVisible: true }).catch(error => void showAlert(errorText(error)))} />}
              <div>
                <label className={label}>{t('Tax region')}</label>
                <select aria-label={t('Tax region')} value={region} onChange={e => void handleTaxRegionChange(e.target.value as TaxRegion)} className={inputClass}>
                  {TAX_REGIONS.map(value => <option key={value} value={value}>{t(TAX_REGION_LABEL[value])}</option>)}
                </select>
              </div>
              <p className="text-[12px] text-muted">{t('New documents use this region. The switch inside the assistant changes only the guidance you read.')}</p>
              <button onClick={() => onNavigate?.('taxGuide')} className="w-full bg-canvas text-ink px-3.5 py-2 rounded-lg text-[13px] font-medium">{t('Open tax guide')}</button>
            </div>
          </div>

          <div className={card}>
            <h2 className="text-[14px] font-bold text-ink mb-4">{t('Document numbering and tax')}</h2>
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className={label}>{t('Invoice prefix')}</label>
                  <input aria-label={t('Invoice prefix')} value={invoicePrefix} maxLength={8} onChange={e => setInvoicePrefix(e.target.value.toUpperCase())} className={inputClass} />
                </div>
                <div>
                  <label className={label}>{t('Estimate prefix')}</label>
                  <input aria-label={t('Estimate prefix')} value={estimatePrefix} maxLength={8} onChange={e => setEstimatePrefix(e.target.value.toUpperCase())} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={label}>{t('Tax rate')} (%)</label>
                <NumberInput aria-label={t('Tax rate')} value={taxRate} onChange={setTaxRate} className={inputClass} />
                {assistant && <span className="mt-1 block text-[11.5px] text-muted">{t(hints.taxRate)}</span>}
              </div>
              <p className="text-[12px] text-muted">{t('Numbers are sequential: PREFIX-YEAR-0001. The next number is calculated from the documents you already have.')}</p>
              <p className="text-[12px] text-muted">{t('The tax rate is applied to new invoices and estimates; every document keeps its own rate.')}</p>
              <button onClick={handleSaveDocumentDefaults} className="w-full bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t('Save document defaults')}</button>
            </div>
          </div>

          <BackupPanel />

          <div className={card}>
            <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />{t("Privacy & Offline")}</h2>
            <div className="space-y-3 text-[13px] text-muted">
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-good rounded-full mt-2"></span>
                <div>
                  <p className="font-medium text-ink">{t("100% Local • Offline")}</p>
                  <p className="text-[12px] mt-0.5">{t("Your data stays on device. No cloud, no subscription.")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-good rounded-full mt-2"></span>
                <div>
                  <p className="font-medium text-ink">{t("Works Offline")}</p>
                  <p className="text-[12px] mt-0.5">{t("Airplane mode ready. Create invoice → PDF → Share")}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-good rounded-full mt-2"></span>
                <div>
                  <p className="font-medium text-ink">{t("No Tracking")}</p>
                  <p className="text-[12px] mt-0.5">{t("No analytics, no tracking. Your business is private.")}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={card}>
            <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
              <Info className="w-5 h-5" />{t("About")}</h2>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted">{t("App Name")}</span>
                <span className="font-medium text-ink">{t("Fatorati")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{t("Version")}</span>
                <span className="font-medium text-ink">{APP_VERSION} · {t('100% Local • Offline')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{t("Storage")}</span>
                <span className="font-medium text-ink">{t("IndexedDB • Local")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">{t('Currency')}</span>
                <select aria-label={`${t('About')} — ${t('Currency')}`} value={prefs.defaultCurrency} onChange={e => void handleCurrencyChange(e.target.value)} className="text-[13.5px] border border-line-strong rounded px-2 py-1 bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15">
                  {supportedValues('currency').map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              </div>
            </div>
            {links.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-line pt-3">
                {links.map(link => (
                  <a key={link.label} href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noopener noreferrer' : undefined}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-brand-50 px-3.5 py-2 text-[13px] font-medium text-brand-700 transition-colors hover:bg-brand-100">
                    <span>{t(link.label)}</span>
                    <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </a>
                ))}
                {links.some(link => link.external) && <p className="text-[11.5px] text-muted">{t('Opens in your browser')}</p>}
              </div>
            )}
            <p className="mt-4 text-[12px] text-muted">{t(TAX_DISCLAIMER)}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <PreferencesPanel />
        <SecurityPanel />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <SubscriptionRemindersPanel />
      </div>
    </div>
  )
}
