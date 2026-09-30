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

import { useEffect, useState } from 'react'
import BackupPanel from '../components/BackupPanel'
import { useFatorati } from '../store/useFatorati'
import NumberInput from '../components/NumberInput'
import { normalizePrefix } from '../lib/fatorati'
import { clampDueDays } from '../lib/status'
import { chooseLogoFile, subscribePickedLogo, takePickedLogo } from '../lib/backup-picker'
import { IMAGE_ERRORS, MAX_BACKUP_IMAGE_BYTES, MAX_LOGO_BYTES, MAX_STAMP_BYTES, readImageFile, storedImage } from '../lib/images'
import { LAYOUTS, PRESETS, TEMPLATE_ACCENTS, templateDefaults, type AccentId, type LayoutId, type PresetId } from '../lib/templates'
import { APP_VERSION } from '../lib/version'
import { aboutLinks } from '../lib/appConfig'
import { Building2, Shield, Info, HelpingHand, ExternalLink, LifeBuoy, CircleHelp, ScrollText, ShieldCheck, ChevronRight, LayoutTemplate, Palette, Stamp, Image as ImageIcon, NotebookPen, CalendarDays, type LucideIcon } from 'lucide-react'
import { ShowTaxAssistantButton } from '../components/TaxAssistant'
import { assistantVisible, hintsFor, settingsRegion, TAX_DISCLAIMER, TAX_REGION_LABEL, TAX_REGIONS } from '../lib/taxGuide'
import type { ModuleKey, TaxRegion } from '../store/types'

const HELP_ROWS: { key: ModuleKey; label: string; icon: LucideIcon }[] = [
  { key: 'help', label: 'Get help', icon: LifeBuoy },
  { key: 'faq', label: 'FAQ', icon: CircleHelp },
  { key: 'privacy', label: 'Privacy policy', icon: ShieldCheck },
  { key: 'terms', label: 'Terms of use', icon: ScrollText },
]

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
    ifNumber: business?.ifNumber || '',
    tpNumber: business?.tpNumber || '',
    rcNumber: business?.rcNumber || '',
    cnieNumber: business?.cnieNumber || '',
  })
  const [imageTarget, setImageTarget] = useState<'logo' | 'stamp' | null>(null)
  // A logo imported before the resize existed can be up to the backup cap; it still shows.
  const logo = storedImage(business?.logo, MAX_LOGO_BYTES) || storedImage(business?.logo, MAX_BACKUP_IMAGE_BYTES)
  const stamp = storedImage(business?.stamp, MAX_STAMP_BYTES) || storedImage(business?.stamp, MAX_BACKUP_IMAGE_BYTES)
  const template = templateDefaults(settings, settingsRegion(settings))
  const [taxRate, setTaxRate] = useState(settings?.taxRate || 0)
  const [invoicePrefix, setInvoicePrefix] = useState(settings?.invoicePrefix || 'INV')
  const [estimatePrefix, setEstimatePrefix] = useState(settings?.estimatePrefix || 'EST')
  const [defaultDueDays, setDefaultDueDays] = useState(clampDueDays(settings?.defaultDueDays))
  const [creditNotePrefix, setCreditNotePrefix] = useState(settings?.creditNotePrefix || 'AV')
  const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'
  const region = settingsRegion(settings)
  // Owner links ship empty; unconfigured rows stay hidden instead of showing a dead contact.
  const links = aboutLinks()
  const assistant = assistantVisible(settings)
  const hints = hintsFor(region)

  useEffect(() => {
    const receive = () => {
      const file = takePickedLogo()
      const target = imageTarget
      setImageTarget(null)
      if (!file || !target) return
      void (async () => {
        try {
          const dataUrl = await readImageFile(file, target === 'logo' ? MAX_LOGO_BYTES : MAX_STAMP_BYTES)
          await updateBusiness(target === 'logo' ? { logo: dataUrl } : { stamp: dataUrl })
          await showAlert(t('Image updated'))
        } catch (error) {
          const message = error instanceof Error && (Object.values(IMAGE_ERRORS) as string[]).includes(error.message) ? error.message : 'Operation failed'
          await showAlert(t(message))
        }
      })()
    }
    receive()
    return subscribePickedLogo(receive)
  }, [imageTarget, updateBusiness])

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
        ifNumber: form.ifNumber.trim(),
        tpNumber: form.tpNumber.trim(),
        rcNumber: form.rcNumber.trim(),
        cnieNumber: form.cnieNumber.trim(),
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
        defaultDueDays: clampDueDays(Math.round(defaultDueDays)),
        creditNotePrefix: normalizePrefix(creditNotePrefix, 'AV'),
      })
      setInvoicePrefix(normalizePrefix(invoicePrefix, 'INV'))
      setEstimatePrefix(normalizePrefix(estimatePrefix, 'EST'))
      setDefaultDueDays(clampDueDays(Math.round(defaultDueDays)))
      setCreditNotePrefix(normalizePrefix(creditNotePrefix, 'AV'))
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
            {region === 'MA' && <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className={label}>{t('IF number')}</label>
                <input aria-label={t('IF number')} value={form.ifNumber} onChange={e => setForm({ ...form, ifNumber: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={label}>{t('TP number')}</label>
                <input aria-label={t('TP number')} value={form.tpNumber} onChange={e => setForm({ ...form, tpNumber: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={label}>{t('RC number')}</label>
                <input aria-label={t('RC number')} value={form.rcNumber} onChange={e => setForm({ ...form, rcNumber: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={label}>{t('CNIE number')}</label>
                <input aria-label={t('CNIE number')} value={form.cnieNumber} onChange={e => setForm({ ...form, cnieNumber: e.target.value })} className={inputClass} />
              </div>
            </div>}
            {region === 'MA' && <p className="text-[11.5px] text-muted">{t('Seller identifiers')}: {t('Printed on every Moroccan document. An empty one prints with a dash.')}</p>}

            <div className="space-y-2 border-t border-line pt-3.5">
              <div className="flex flex-wrap items-center gap-3">
                {logo
                  ? <img src={logo} alt={t('Logo')} className="h-16 w-16 rounded-lg border border-line object-cover" />
                  : <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-line-strong text-faint"><ImageIcon className="h-5 w-5" aria-hidden="true" /></div>}
                <button type="button" onClick={() => { setImageTarget('logo'); chooseLogoFile() }} className="min-h-12 rounded-lg bg-brand-50 px-3.5 py-2 text-[13px] font-semibold text-brand-700 transition-all hover:bg-brand-100 active:scale-[0.98]">{t('Choose logo')}</button>
                {logo && <button type="button" onClick={() => void updateBusiness({ logo: undefined }).catch(error => void showAlert(errorText(error)))} className="min-h-12 rounded-lg bg-canvas px-3.5 py-2 text-[13px] text-serious">{t('Remove image')}</button>}
              </div>
              <p className="text-[11.5px] text-muted">{t('Max 200 KB after resizing. PNG or JPG.')}</p>
              <div className="flex flex-wrap items-center gap-3">
                {stamp
                  ? <img src={stamp} alt={t('Stamp or signature')} className="h-16 w-16 rounded-lg border border-line object-contain" />
                  : <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-line-strong text-faint"><Stamp className="h-5 w-5" aria-hidden="true" /></div>}
                <button type="button" onClick={() => { setImageTarget('stamp'); chooseLogoFile() }} className="min-h-12 rounded-lg bg-brand-50 px-3.5 py-2 text-[13px] font-semibold text-brand-700 transition-all hover:bg-brand-100 active:scale-[0.98]">{t('Choose stamp')}</button>
                {stamp && <button type="button" onClick={() => void updateBusiness({ stamp: undefined }).catch(error => void showAlert(errorText(error)))} className="min-h-12 rounded-lg bg-canvas px-3.5 py-2 text-[13px] text-serious">{t('Remove image')}</button>}
              </div>
              <p className="text-[11.5px] text-muted">{t('Stamp or signature')} · {t('Max 200 KB after resizing. PNG or JPG.')}</p>
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
                <div>
                  <label className={label}>{t('Credit note prefix')}</label>
                  <input aria-label={t('Credit note prefix')} value={creditNotePrefix} maxLength={8} onChange={e => setCreditNotePrefix(e.target.value.toUpperCase())} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={label}>{t('Tax rate')} (%)</label>
                <NumberInput aria-label={t('Tax rate')} value={taxRate} onChange={setTaxRate} className={inputClass} />
                {assistant && <span className="mt-1 block text-[11.5px] text-muted">{t(hints.taxRate)}</span>}
              </div>
              <div>
                <label className={label}>{t('Default payment term (days)')}</label>
                <NumberInput aria-label={t('Default payment term (days)')} value={defaultDueDays} onChange={setDefaultDueDays} className={inputClass} />
                <span className="mt-1 block text-[11.5px] text-muted">{t('New invoices are due this many days after their issue date (0–365). Estimates expire after the same delay.')}</span>
              </div>
              <p className="text-[12px] text-muted">{t('Numbers are sequential: PREFIX-YEAR-0001. The next number is calculated from the documents you already have.')}</p>
              <p className="text-[12px] text-muted">{t('The tax rate is applied to new invoices and estimates; every document keeps its own rate.')}</p>
              <button onClick={handleSaveDocumentDefaults} className="w-full bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t('Save document defaults')}</button>
            </div>
          </div>

          <div className={card}>
            <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5" />{t('Templates')}</h2>
            <div className="space-y-3.5">
              <p className="text-[12px] text-muted">{t('Default template')}: <span className="font-semibold text-ink">{t(LAYOUTS[template.layoutId].label)} · {t(PRESETS[template.presetId].label)}</span></p>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className={label}>{t('Default layout')}</label>
                  <select aria-label={t('Default layout')} value={template.layoutId} onChange={e => void updateSettings({ templateLayout: e.target.value as LayoutId }).catch(error => void showAlert(errorText(error)))} className={inputClass}>
                    {Object.values(LAYOUTS).map(layout => <option key={layout.id} value={layout.id}>{t(layout.label)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>{t('Default preset')}</label>
                  <select aria-label={t('Default preset')} value={template.presetId} onChange={e => void updateSettings({ templatePreset: e.target.value as PresetId }).catch(error => void showAlert(errorText(error)))} className={inputClass}>
                    {Object.values(PRESETS).map(item => <option key={item.id} value={item.id}>{t(item.label)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <span className={label}><Palette className="me-1 inline h-3.5 w-3.5" aria-hidden="true" />{t('Document color')}</span>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_ACCENTS.map(accent => <button key={accent.id} type="button" aria-label={`${t('Document color')} ${t(accent.label)}`} aria-pressed={accent.id === template.accent}
                    onClick={() => void updateSettings({ templateAccent: accent.id as AccentId }).catch(error => void showAlert(errorText(error)))}
                    className={`h-10 w-10 rounded-lg border transition-all active:scale-[0.98] ${accent.id === template.accent ? 'border-ink ring-2 ring-brand/25' : 'border-line-strong'}`}
                    style={accent.hex ? { backgroundColor: accent.hex } : { background: 'linear-gradient(135deg,#2563eb 50%,#0b1220 50%)' }} />)}
                </div>
              </div>
              <button onClick={() => onNavigate?.('templates')} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-canvas px-3.5 py-2 text-[13px] font-medium text-ink">
                <LayoutTemplate className="h-4 w-4" aria-hidden="true" />{t('Open template preview')}
              </button>
              <p className="text-[12px] text-muted">{t('New documents use it. Existing documents keep the template they were saved with.')}</p>
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

          <div className={card}>
            <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
              <LifeBuoy className="w-5 h-5" />{t('Help & legal')}</h2>
            <p className="text-[13px] text-muted">{t('Read the FAQ, the privacy policy and the terms of use, all offline.')}</p>
            <div className="mt-3 space-y-2">
              {HELP_ROWS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => onNavigate?.(key)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg bg-canvas px-3.5 py-2 text-start text-[13px] font-medium text-ink transition-colors hover:bg-brand-50">
                  <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-brand" aria-hidden="true" />{t(label)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted directional" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <PreferencesPanel />
        <SecurityPanel />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <SubscriptionRemindersPanel />

        <div className={card}>
          <h2 className="text-[14px] font-bold text-ink mb-4 flex items-center gap-2">
            <NotebookPen className="w-5 h-5" />{t('Notebook and calendar')}</h2>
          <div className="space-y-3.5">
            <p className="text-[12px] text-muted">{t('Ideas, notes and tasks stay encrypted on this phone. A note with a date also appears in the calendar next to due invoices and renewals.')}</p>
            <div>
              <label className={label}>{t('Week starts on')}</label>
              <select aria-label={t('Week starts on')} value={String(prefs.firstDay)} onChange={event => void savePreferences({ firstDay: Number(event.target.value) as 0 | 1 | 6 }).catch(error => void showAlert(errorText(error)))} className={inputClass}>
                {[1, 6, 0].map(day => <option key={day} value={day}>{t(`firstDay.${day}`)}</option>)}
              </select>
              <span className="mt-1 block text-[11.5px] text-muted">{t('The month view follows this, and so does the date picker in expenses.')}</span>
            </div>
            <p className="text-[12px] text-muted">{t('A note reminds you only when you choose a reminder on it. Reminders are inexact local notifications, like the subscription ones.')}</p>
            <p className="text-[12px] text-muted">{t('Notification text never contains a note. Turn "Hide service names in notifications" on to keep every reminder generic.')}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onNavigate?.('notebook')} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-canvas px-3.5 py-2 text-[13px] font-medium text-ink"><NotebookPen className="h-4 w-4" aria-hidden="true" />{t('Open the notebook')}</button>
              <button onClick={() => onNavigate?.('calendar')} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-canvas px-3.5 py-2 text-[13px] font-medium text-ink"><CalendarDays className="h-4 w-4" aria-hidden="true" />{t('Open the calendar')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
