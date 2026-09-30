import { useI18n } from '../i18n'
import { LAYOUTS, PRESETS, TEMPLATE_ACCENTS, MAX_FOOTER_NOTE, presetIsTaxExempt, type ColumnId, type DocumentTemplate, type PresetId, type LayoutId, type AccentId } from '../lib/templates'

const inputClass = 'w-full px-3 py-2 border border-line-strong rounded-lg text-[13.5px] bg-surface text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15'
const labelClass = 'block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-[0.06em]'

/**
 * Per-document template controls. Everything here ends up in the document's own
 * snapshot when it is saved, so editing the defaults in Settings never reaches back
 * into a document that already exists.
 */
export function TemplateFields({ value, onChange, onPreview, rateHint, missing }: {
  value: DocumentTemplate
  onChange: (patch: Partial<DocumentTemplate>) => void
  onPreview: () => void
  /** One-line, non-committal rate hint of the preset (never a default rate). */
  rateHint?: string | null
  /** Mandatory fields that are empty; they print with a dash, never disappear. */
  missing?: string[]
}) {
  const { t } = useI18n()
  const exempt = presetIsTaxExempt(value)
  return <div className="space-y-3.5">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <label className="block">
        <span className={labelClass}>{t('Layout')}</span>
        <select aria-label={t('Layout')} value={value.layoutId} onChange={event => onChange({ layoutId: event.target.value as LayoutId })} className={inputClass}>
          {Object.values(LAYOUTS).map(layout => <option key={layout.id} value={layout.id}>{t(layout.label)}</option>)}
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>{t('Topic preset')}</span>
        <select aria-label={t('Topic preset')} value={value.presetId} onChange={event => onChange({ presetId: event.target.value as PresetId })} className={inputClass}>
          {Object.values(PRESETS).map(preset => <option key={preset.id} value={preset.id}>{t(preset.label)}</option>)}
        </select>
      </label>
    </div>

    <p className="text-[12px] text-muted">{t(PRESETS[value.presetId].description)}</p>
    {missing && missing.length > 0 && <p role="status" className="rounded-lg bg-warn-50 p-2.5 text-[12px] text-warn">
      {t('Empty mandatory fields are printed with a dash:')} {missing.join(' · ')}. {t('Fill them in Settings → Business Information.')}
    </p>}
    {exempt && <p className="rounded-lg bg-canvas p-2.5 text-[12px] text-muted">{t('No TVA: the exemption mention replaces the tax lines.')} {t('Auto-entrepreneur: no TVA is charged; the exemption mention is printed on the document.')}</p>}
    {!exempt && rateHint && <p className="text-[12px] text-muted">{t(rateHint)}</p>}

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
      <input aria-label={t('Footer note')} value={value.footerNote || ''} maxLength={MAX_FOOTER_NOTE} onChange={event => onChange({ footerNote: event.target.value })} placeholder={t(PRESETS[value.presetId].footer)} className={inputClass} />
      <span className="mt-1 block text-[11.5px] text-muted">{t('Shown at the bottom of the document.')} {MAX_FOOTER_NOTE}.</span>
    </label>

    <div className="flex flex-wrap items-center gap-4">
      <label className="flex min-h-12 items-center gap-2 text-[13px] text-ink">
        <input type="checkbox" checked={value.showLogo !== false} onChange={event => onChange({ showLogo: event.target.checked })} />
        {t('Show the logo on the document')}
      </label>
      <label className="flex min-h-12 items-center gap-2 text-[13px] text-ink">
        <input type="checkbox" checked={value.showStamp === true} onChange={event => onChange({ showStamp: event.target.checked })} />
        {t('Show a stamp or signature')}
      </label>
    </div>

    <button type="button" onClick={onPreview} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-strong bg-canvas px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-brand-50">
      {t('Open template preview')}
    </button>
  </div>
}

/**
 * Extra line-item inputs, shown only when the preset asks for the column: a unit,
 * a materials/labour grouping and an optional line discount. The mandatory four
 * columns never depend on this.
 */
export function LineExtras({ line, columns, groupBy, units, onChange }: {
  line: { unit?: string; section?: string; discount?: number }
  columns: ColumnId[]
  groupBy?: 'section'
  units: string[]
  onChange: (patch: { unit?: string; section?: string; discount?: number }) => void
}) {
  const { t } = useI18n()
  const showUnit = columns.includes('unit')
  const showDiscount = columns.includes('discount')
  if (!showUnit && !showDiscount && groupBy !== 'section') return null
  return <div className="col-span-12 flex flex-wrap items-end gap-2 mb-1">
    {showUnit && <label className="flex-1 min-w-[8rem]">
      <span className="block text-[11px] font-semibold text-muted mb-1">{t('Unit')}</span>
      <input list="template-units" aria-label={t('Unit')} value={line.unit || ''} onChange={event => onChange({ unit: event.target.value })} className={inputClass} />
      <datalist id="template-units">{units.map(unit => <option key={unit} value={t(unit)} />)}</datalist>
    </label>}
    {groupBy === 'section' && <label className="min-w-[9rem]">
      <span className="block text-[11px] font-semibold text-muted mb-1">{t('Section')}</span>
      <select aria-label={t('Section')} value={line.section || ''} onChange={event => onChange({ section: event.target.value })} className={inputClass}>
        <option value="">—</option>
        <option value="materials">{t('Materials')}</option>
        <option value="labour">{t('Labour')}</option>
      </select>
    </label>}
    {showDiscount && <label className="w-28">
      <span className="block text-[11px] font-semibold text-muted mb-1">{t('Discount (%)')}</span>
      <input type="number" min="0" max="100" step="any" aria-label={t('Discount (%)')} value={line.discount ?? ''} onChange={event => onChange({ discount: event.target.value === '' ? undefined : Math.min(Math.max(Number(event.target.value), 0), 100) })} className={inputClass} />
    </label>}
  </div>
}

/** Line of the document form: what the item editor keeps while editing. */
export interface FormLine {
  description: string
  quantity: number
  unitPrice: number
  unit?: string
  section?: string
  discount?: number
}

export default TemplateFields
