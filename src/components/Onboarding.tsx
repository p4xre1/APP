import { isUnlocked, sessionGuard } from '../lib/vault'
import { hasPickedBackup, chooseLogoFile, takePickedLogo, subscribePickedLogo } from '../lib/backup-picker'
import { errorText } from '../i18n'
import { t } from '../i18n'
import LanguagePicker from './LanguagePicker'
import CurrencyPicker from './CurrencyPicker'
import { getPreferences, savePreferences } from '../lib/preferences'
import { IMAGE_ERRORS, MAX_LOGO_BYTES, readImageFile } from '../lib/images'
/**
 * Fatorati Offline - Onboarding
 * Welcome to Fatorati - Set up your business to get started
 * Collect locally: Business name, Owner name, Phone, Email, Address, Logo
 * No account required - 100% Local • Offline
 */

import { useEffect, useState } from 'react'
import BackupPanel from './BackupPanel'
import LegalOverlay from './LegalOverlay'
import type { LegalKind } from '../lib/legal'
import type { FormEvent } from 'react'
import { Loader2, Building2, User, Phone, Mail, MapPin, Image as ImageIcon } from 'lucide-react'

interface OnboardingProps {
  onComplete: (data: {
    name: string
    ownerName: string
    phone: string
    email: string
    address: string
    city: string
    logo?: string
    currency: string
  }) => Promise<void>
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currency, setCurrency] = useState(getPreferences().defaultCurrency)
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [logo, setLogo] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [legal, setLegal] = useState<LegalKind | null>(null)

  const canSubmit = businessName.trim() && ownerName.trim() && !submitting

  useEffect(() => {
    const receive = () => { if (!isUnlocked()) return; const file=takePickedLogo(); if(file)handleLogoFile(file) }
    receive(); return subscribePickedLogo(receive)
  }, [])
  function handleLogoFile(file: File) {
    const guard = sessionGuard()
    // Resized and re-encoded before it reaches the vault: a phone photo would
    // otherwise be stored at full size and travel in every backup.
    void readImageFile(file, MAX_LOGO_BYTES).then(dataUrl => {
      guard()
      setLogo(dataUrl)
    }).catch((reason: unknown) => {
      const message = reason instanceof Error && (Object.values(IMAGE_ERRORS) as string[]).includes(reason.message) ? reason.message : 'Operation failed'
      setError(t(message))
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)

    try {
      await savePreferences({defaultCurrency: currency})
      await onComplete({
        currency,
        name: businessName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        logo,
      })
    } catch (err) {
      setError(errorText(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"><LanguagePicker /></div>
        <details open={hasPickedBackup() || undefined} className="mb-6 bg-surface rounded-xl border border-line p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <summary className="cursor-pointer text-[13px] font-medium text-brand-700">{t("Moving phones? Import an existing backup")}</summary>
          <div className="mt-4"><BackupPanel /></div>
        </details>
        <div className="bg-surface rounded-xl border border-line shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="border-b border-line p-5 text-ink">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{t("Welcome to Fatorati")}</h1>
                <p className="text-[13px] text-muted">{t("Set up your business to get started")}</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-brand-50 rounded-lg">
              <p className="text-[12px] text-muted">
                <span className="font-semibold text-brand-700">{t("100% Local • Offline")}</span>{' '}{t("- Simple business management. No subscription. Your customers, invoices and business records stay on your device. Works offline.")}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
            <CurrencyPicker value={currency} onChange={setCurrency} />
            {error && (
              <div className="bg-serious-50 border border-serious/20 text-serious px-4 py-3 rounded-lg text-[13px]">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">
                <span className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />{t("Business Name *")}</span>
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t("Acme Inc.")}
                className="w-full px-3 py-2 text-[13.5px] border border-line-strong rounded-lg focus:ring-2 outline-none bg-surface text-ink transition-colors placeholder:text-faint focus:border-brand focus:ring-brand/15"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4" />{t("Owner Name *")}</span>
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder={t("John Doe")}
                className="w-full px-3 py-2 text-[13.5px] border border-line-strong rounded-lg focus:ring-2 outline-none bg-surface text-ink transition-colors placeholder:text-faint focus:border-brand focus:ring-brand/15"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">
                  <span className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />{t("Phone")}</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('Phone example')}
                  className="w-full px-3 py-2 text-[13.5px] border border-line-strong rounded-lg focus:ring-2 outline-none bg-surface text-ink transition-colors placeholder:text-faint focus:border-brand focus:ring-brand/15"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />{t("Email")}</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("Example email")}
                  className="w-full px-3 py-2 text-[13.5px] border border-line-strong rounded-lg focus:ring-2 outline-none bg-surface text-ink transition-colors placeholder:text-faint focus:border-brand focus:ring-brand/15"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />{t("Address")}</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("123 Business St")}
                className="w-full px-3 py-2 text-[13.5px] border border-line-strong rounded-lg focus:ring-2 outline-none bg-surface text-ink transition-colors placeholder:text-faint focus:border-brand focus:ring-brand/15"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">{t("City")}</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("New York, NY 10001")}
                className="w-full px-3 py-2 text-[13.5px] border border-line-strong rounded-lg focus:ring-2 outline-none bg-surface text-ink transition-colors placeholder:text-faint focus:border-brand focus:ring-brand/15"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]">
                <span className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />{t("Business Logo (optional)")}</span>
              </label>
              <div className="flex items-center gap-4">
                {logo && (
                  <img src={logo} alt={t("Logo")} className="w-16 h-16 rounded-lg object-cover border" />
                )}
                <button type="button" onClick={chooseLogoFile} className="px-3.5 py-2 rounded-lg text-[13px] font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm">{t('Choose logo')}</button>
              </div>
              <p className="text-[12px] text-muted mt-1">{t('Max 200 KB after resizing. PNG or JPG.')}</p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-brand hover:bg-brand-700 disabled:bg-line-strong disabled:cursor-not-allowed text-white font-semibold py-3 px-3.5 rounded-lg flex items-center justify-center gap-2 transition-colors transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />{t("Setting up...")}</>
                ) : (
                  <>{t("Continue to Dashboard")}</>
                )}
              </button>
              <p className="text-[12px] text-muted text-center mt-3">{t("No account required • Your data stays on device")}</p>
              <p className="text-[12px] text-muted text-center mt-2">{t('By continuing you accept the terms of use and acknowledge the privacy policy:')}</p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4">
                <button type="button" onClick={() => setLegal('privacy')} className="min-h-12 text-[12px] font-medium text-muted underline underline-offset-2 transition-colors hover:text-ink">{t('Privacy policy')}</button>
                <button type="button" onClick={() => setLegal('terms')} className="min-h-12 text-[12px] font-medium text-muted underline underline-offset-2 transition-colors hover:text-ink">{t('Terms of use')}</button>
              </div>
            </div>
          </form>
        </div>

        <p className="text-center text-muted text-[12px] mt-6">{t("Fatorati • Simple business management • Works offline")}</p>
      </div>
      {legal && <LegalOverlay kind={legal} onClose={() => setLegal(null)} />}
    </div>
  )
}
