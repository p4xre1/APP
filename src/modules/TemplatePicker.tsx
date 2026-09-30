import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { useI18n, errorText } from '../i18n'
import { showAlert } from '../lib/dialogs'
import { useFatorati } from '../store/useFatorati'
import { settingsRegion } from '../lib/taxGuide'
import { getPreferences } from '../lib/preferences'
import {
  buildSampleModel, layoutDocument, paintPage, PAGE_HEIGHT, PAGE_WIDTH, type Measure, type PaintContext,
} from '../lib/template-render'
import { SAMPLE_PAYMENT_METHOD } from '../lib/invoice-pdf'
import {
  LAYOUTS, MAX_FOOTER_NOTE, PRESETS, TEMPLATE_ACCENTS, columnLabelKey, presetIsTaxExempt, templateColumns, templateDefaults,
  type AccentId, type DocumentTemplate, type LayoutId, type PresetId,
} from '../lib/templates'
import type { Language } from '../lib/preferences'
import type { TaxRegion } from '../store/types'

const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'
const labelClass = 'block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]'
const PREVIEW_WIDTH = 720

export interface TemplatePickerProps {
  value: DocumentTemplate
  onChange: (patch: Partial<DocumentTemplate>) => void
  onApply: (value: DocumentTemplate) => void | Promise<void>
  onBack: () => void
  /** Button wording of the screen ("Use this template", "Set as default..."). */
  applyLabel: string
  region: TaxRegion
  language: Language
  currency: string
  logo?: string
  stamp?: string
}

/** Live preview: the same model, the same layout engine and the same painter as the PDF. */
function LivePreview({ template, region, language, currency, logo, stamp, appAccent, label }: {
  template: DocumentTemplate; region: TaxRegion; language: Language
  currency: string; logo?: string; stamp?: string; appAccent: string; label: string
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let cancelled = false
    const paint = async () => {
      const family = language === 'ar' ? 'Tajawal' : 'Inter'
      // The bundled font must be resident before anything is measured or drawn.
      try { await document.fonts.load(`28px ${family}`) } catch { /* Falls back to the default face. */ }
      const model = buildSampleModel(template, language, currency, region, appAccent, SAMPLE_PAYMENT_METHOD)
      model.logo = template.showLogo !== false ? logo : undefined
      model.stamp = template.showStamp === true ? stamp : undefined
      const scratch = document.createElement('canvas')
      const context = scratch.getContext('2d')
      if (!context) return
      const measure: Measure = (text, font) => { context.font = font; return context.measureText(text).width }
      const laid = layoutDocument(model, { measure })
      if (cancelled) return
      const scale = PREVIEW_WIDTH / PAGE_WIDTH
      const pageHeight = Math.round(PAGE_HEIGHT * scale)
      const gap = 12
      const target = canvas
      target.width = PREVIEW_WIDTH
      target.height = laid.length * pageHeight + (laid.length - 1) * gap
      const ctx = target.getContext('2d')
      if (!ctx) return
      const images = new Map<string, CanvasImageSource>()
      for (const src of [model.logo, model.stamp]) {
        if (!src || images.has(src)) continue
        try {
          const image = new Image()
          image.src = src
          await image.decode()
          images.set(src, image)
        } catch { /* A missing image never blocks the preview. */ }
      }
      if (cancelled) return
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      laid.forEach((page, index) => {
        ctx.save()
        ctx.translate(0, index * (pageHeight + gap) / scale)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
        paintPage(ctx as unknown as PaintContext, page, images)
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 2
        ctx.strokeRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
        ctx.restore()
      })
    }
    void paint()
    return () => { cancelled = true }
  }, [template, region, language, currency, logo, stamp, appAccent])

  return <canvas ref={ref} role="img" aria-label={label} className="w-full rounded-xl border border-line bg-white" />
}

/**
 * Full-screen template picker with a live preview. The routed screen (default
 * export) stores the defaults for new documents; the form embeds the same
 * component to override the template of one document.
 */
export function TemplatePicker({ value, onChange, onApply, onBack, applyLabel, region, language, currency, logo, stamp }: TemplatePickerProps) {
  const { t } = useI18n()
  const appAccent = getPreferences().accent
  const preset = PRESETS[value.presetId]
  const columns = templateColumns(value)
  const exempt = presetIsTaxExempt(value)

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink">{t('Templates')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('Choose a layout and a topic preset. The preview uses sample data.')}</p>
        <p className="mt-1 text-[12px] font-semibold text-brand-700">{t(LAYOUTS[value.layoutId].label)} · {t(preset.label)}</p>
      </div>
      <button onClick={onBack} className="inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4 directional" />{t('Back to settings')}
      </button>
    </div>

    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <div className="space-y-3.5 rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{t('Layout')}</span>
            <select aria-label={t('Layout')} value={value.layoutId} onChange={event => onChange({ layoutId: event.target.value as LayoutId })} className={inputClass}>
              {Object.values(LAYOUTS).map(layout => <option key={layout.id} value={layout.id}>{t(layout.label)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>{t('Topic preset')}</span>
            <select aria-label={t('Topic preset')} value={value.presetId} onChange={event => onChange({ presetId: event.target.value as PresetId })} className={inputClass}>
              {Object.values(PRESETS).map(item => <option key={item.id} value={item.id}>{t(item.label)}</option>)}
            </select>
          </label>
        </div>
        <p className="text-[12px] text-muted">{t(LAYOUTS[value.layoutId].description)}</p>
        <p className="text-[12px] text-muted">{t(preset.description)}</p>
        <p className="text-[12px] text-muted">{columns.map(column => t(columnLabelKey(value, column))).join(' · ')}</p>
        {exempt && <p className="rounded-lg bg-canvas p-2.5 text-[12px] text-muted">{t('Auto-entrepreneur: no TVA is charged; the exemption mention is printed on the document.')}</p>}
        {!exempt && preset.rateHint && <p className="text-[12px] text-muted">{t(preset.rateHint)}</p>}

        <div>
          <span className={labelClass}>{t('Document color')}</span>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_ACCENTS.map(accent => <button key={accent.id} type="button" aria-label={`${t('Document color')} ${t(accent.label)}`} aria-pressed={accent.id === value.accent}
              onClick={() => onChange({ accent: accent.id as AccentId })}
              className={`h-12 w-12 rounded-lg border transition-all active:scale-[0.98] ${accent.id === value.accent ? 'border-ink ring-2 ring-brand/25' : 'border-line-strong'}`}
              style={accent.hex ? { backgroundColor: accent.hex } : { background: 'linear-gradient(135deg,#2563eb 50%,#0b1220 50%)' }} />)}
          </div>
        </div>

        <label className="block">
          <span className={labelClass}>{t('Footer note')}</span>
          <input aria-label={t('Footer note')} value={value.footerNote || ''} maxLength={MAX_FOOTER_NOTE} onChange={event => onChange({ footerNote: event.target.value })} placeholder={t(preset.footer)} className={inputClass} />
          <span className="mt-1 block text-[11.5px] text-muted">{t('Shown at the bottom of the document.')}</span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex min-h-12 items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={value.showLogo !== false} onChange={event => onChange({ showLogo: event.target.checked })} />{t('Show the logo on the document')}
          </label>
          <label className="flex min-h-12 items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={value.showStamp === true} onChange={event => onChange({ showStamp: event.target.checked })} />{t('Show a stamp or signature')}
          </label>
        </div>

        <p className="text-[12px] text-muted">{t('Templates are stored with each document.')} {t('PDF and preview are generated on the device. Nothing is uploaded.')}</p>

        <button onClick={() => void onApply(value)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-700 active:scale-[0.98]">
          <Check className="h-4 w-4" />{t(applyLabel)}
        </button>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="mb-2 text-[13px] font-bold text-ink">{t('Live preview')}</h2>
        <LivePreview label={t('Live preview')} template={value} region={region} language={language} currency={currency} logo={logo} stamp={stamp} appAccent={appAccent} />
      </div>
    </div>
  </div>
}

/** Routed screen: edits the defaults every new invoice and estimate starts from. */
export default function TemplateDefaultsScreen({ onBack }: { onBack: () => void }) {
  const { t, language } = useI18n()
  const { business, settings, updateSettings } = useFatorati()
  const region = settingsRegion(settings)
  const [value, setValue] = useState<DocumentTemplate>(() => templateDefaults(settings, region))
  const currency = useMemo(() => settings?.currency || getPreferences().defaultCurrency, [settings])

  async function apply(next: DocumentTemplate) {
    try {
      await updateSettings({ templateLayout: next.layoutId, templatePreset: next.presetId, templateAccent: next.accent })
      await showAlert(t('Template saved'))
      onBack()
    } catch (error) { await showAlert(errorText(error)) }
  }

  return <TemplatePicker
    value={value}
    onChange={patch => setValue(current => ({ ...current, ...patch }))}
    onApply={apply}
    onBack={onBack}
    applyLabel="Set as default for new documents"
    region={region}
    language={language}
    currency={currency}
    logo={business?.logo}
    stamp={business?.stamp}
  />
}
