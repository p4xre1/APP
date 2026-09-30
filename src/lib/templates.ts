/**
 * Document templates: layouts and topic presets, as plain data.
 *
 * Nothing here renders anything. A layout is a set of style choices the renderer
 * reads (header style, table style, spacing, totals position, footer style); a
 * preset is a set of content choices (columns, translated labels, unit
 * suggestions, default notes/terms/footer, optional grouping and the
 * auto-entrepreneur exemption). Adding a layout or a preset means adding one
 * entry below - never a new component.
 *
 * A document stores a snapshot: layoutId + presetId + templateVersion + accent +
 * footer note + the label keys it was created with. Rendering reads the snapshot,
 * so changing the defaults in Settings never changes an existing document, and a
 * future templateVersion can add behaviour without touching v1 documents.
 *
 * Mandatory content (tax region MA: seller name/address/IF/TP/RC/ICE, client
 * name/address/ICE, sequential number, date, description/quantity/unit price per
 * line, subtotal, TVA per rate, total incl. tax, payment method) is applied by the
 * model builder, not by a preset - a preset may choose labels and extra columns,
 * never remove one of those.
 */
import { DEFAULT_TAX_REGION, isTaxRegion } from './taxGuide'
import type { TaxRegion } from '../store/types'
import type { Language } from './preferences'

/** Frozen contract: bump only when a change must alter how documents render. */
export const TEMPLATE_VERSION = 1

export const LAYOUT_IDS = ['classic', 'modern', 'minimal', 'compact'] as const
export type LayoutId = typeof LAYOUT_IDS[number]

export const PRESET_IDS = [
  'general', 'freelancer', 'construction', 'retail',
  'restaurant', 'consulting', 'transport', 'auto_entrepreneur',
] as const
export type PresetId = typeof PRESET_IDS[number]

/** Extra line-item columns a preset may add to the mandatory four. */
export const COLUMN_IDS = ['description', 'unit', 'quantity', 'unitPrice', 'discount', 'total'] as const
export type ColumnId = typeof COLUMN_IDS[number]

/** Columns every document renders, whatever the preset says. */
export const REQUIRED_COLUMNS: ColumnId[] = ['description', 'quantity', 'unitPrice', 'total']

/**
 * Document accents. Every entry reaches at least 4.5:1 against white, so the same
 * colour is readable as text on the page and as a filled band with white text on
 * it (`tests/templates.test.ts` checks the ratio for each one).
 * `auto` follows the app accent like every document did before templates existed,
 * and is only produced by the migration of documents that have no snapshot.
 */
export const TEMPLATE_ACCENTS = [
  { id: 'auto', label: 'App color (as before)', hex: null },
  { id: 'ink', label: 'Ink', hex: '#0b1220' },
  { id: 'slate', label: 'Slate', hex: '#334155' },
  { id: 'blue', label: 'Blue', hex: '#1d4ed8' },
  { id: 'indigo', label: 'Indigo', hex: '#4f46e5' },
  { id: 'violet', label: 'Violet', hex: '#6d28d9' },
  { id: 'rose', label: 'Rose', hex: '#be123c' },
  { id: 'red', label: 'Red', hex: '#b91c1c' },
  { id: 'orange', label: 'Orange', hex: '#c2410c' },
  { id: 'amber', label: 'Amber', hex: '#a16207' },
  { id: 'green', label: 'Green', hex: '#15803d' },
  { id: 'teal', label: 'Teal', hex: '#0f766e' },
  { id: 'cyan', label: 'Cyan', hex: '#0e7490' },
] as const
export type AccentId = typeof TEMPLATE_ACCENTS[number]['id']

export interface LayoutSpec {
  id: LayoutId
  /** i18n key of the layout name. */
  label: string
  /** i18n key of a one-line description, shown in the picker. */
  description: string
  /** Top of the page: filled band, rule, stacked text or one inline row. */
  header: 'band' | 'rule' | 'stacked' | 'inline'
  /** How the item table is drawn. */
  table: 'hairline' | 'striped' | 'boxed' | 'open'
  /** Vertical rhythm, in page units. */
  spacing: 'airy' | 'normal' | 'tight'
  /** Where the totals block sits and how it is drawn. */
  totals: 'box' | 'stack' | 'inline' | 'right'
  footer: 'band' | 'rule' | 'plain' | 'none'
  /** Logo placement in the header. */
  logo: 'start' | 'end' | 'none'
  /** Base font size on the 1240 x 1754 page; the others derive from it. */
  baseSize: number
  rowPadding: number
  margin: number
}

export const LAYOUTS: Record<LayoutId, LayoutSpec> = {
  classic: {
    id: 'classic', label: 'Classic', description: 'Color band header, hairline table, boxed totals, ruled footer.',
    header: 'band', table: 'hairline', spacing: 'normal', totals: 'box', footer: 'rule', logo: 'start',
    baseSize: 26, rowPadding: 18, margin: 80,
  },
  modern: {
    id: 'modern', label: 'Modern', description: 'Large title with a color block, striped table, boxed totals, color footer.',
    header: 'stacked', table: 'striped', spacing: 'airy', totals: 'box', footer: 'band', logo: 'end',
    baseSize: 28, rowPadding: 22, margin: 84,
  },
  minimal: {
    id: 'minimal', label: 'Minimal', description: 'Plain stacked header, open table without fills, totals right-aligned, plain footer.',
    header: 'rule', table: 'open', spacing: 'normal', totals: 'stack', footer: 'plain', logo: 'none',
    baseSize: 25, rowPadding: 16, margin: 88,
  },
  compact: {
    id: 'compact', label: 'Compact', description: 'One-line header, compact table, totals on one line, no footer band.',
    header: 'inline', table: 'boxed', spacing: 'tight', totals: 'inline', footer: 'none', logo: 'none',
    baseSize: 22, rowPadding: 12, margin: 72,
  },
}

export interface PresetSpec {
  id: PresetId
  /** i18n key of the preset name. */
  label: string
  /** i18n key of the one-line description, and the "check the rate" hint. */
  description: string
  /** Extra columns on top of the mandatory four. */
  columns: ColumnId[]
  /** i18n keys that rename a column for this topic (stored in the snapshot). */
  labels: Partial<Record<ColumnId, string>>
  /** Translated suggestions offered in the unit field. */
  unitSuggestions: string[]
  /** i18n keys of the neutral default note, payment terms and footer line. */
  notes: string
  terms: string
  footer: string
  /** Items are grouped under translated sub-headings (materials / labour). */
  groupBy?: 'section'
  /** The auto-entrepreneur preset prints the "TVA non applicable" mention. */
  taxExempt?: boolean
  /** i18n key of a one-line, non-committal rate hint shown next to the tax rate. */
  rateHint?: string
}

export const PRESETS: Record<PresetId, PresetSpec> = {
  general: {
    id: 'general', label: 'General', description: 'Description, quantity, unit price - the default for any trade.',
    columns: [], labels: {}, unitSuggestions: [],
    notes: 'Thank you for your business.', terms: 'Payment on receipt of the invoice.', footer: 'Generated offline by Fatorati.',
  },
  freelancer: {
    id: 'freelancer', label: 'Freelancer & services',
    description: 'Time-based work: hours (or a quantity), an hourly rate and an optional unit.',
    columns: ['unit'], labels: { quantity: 'Hours', unitPrice: 'Rate' },
    unitSuggestions: ['hour', 'day', 'forfait'],
    notes: 'Work carried out as agreed.', terms: 'Payment within 30 days of the invoice date.', footer: 'Hours are rounded to the nearest quarter.', rateHint: 'Check the correct rate for your activity.',
  },
  construction: {
    id: 'construction', label: 'Construction & contractor',
    description: 'Site work measured in m2, ml or forfait, grouped into materials and labour.',
    columns: ['unit'], labels: { quantity: 'Quantity', unitPrice: 'Unit price' }, groupBy: 'section',
    unitSuggestions: ['m²', 'ml', 'forfait', 'day'],
    notes: 'Work executed according to the agreed quotation.', terms: 'Payment by bank transfer within 30 days.', footer: 'Quantities measured on site.', rateHint: 'Check the correct rate for your activity.',
  },
  retail: {
    id: 'retail', label: 'Retail & shop',
    description: 'Sold items with a quantity, a unit price and an optional line discount.',
    columns: ['discount'], labels: { description: 'Item', quantity: 'Quantity' },
    unitSuggestions: ['piece'],
    notes: 'Thank you for your purchase.', terms: 'Payment according to the notice on the receipt.', footer: 'Goods remain the property of the seller until paid.', rateHint: 'Check the correct rate for your activity.',
  },
  restaurant: {
    id: 'restaurant', label: 'Restaurant & café',
    description: 'Short item lines with a quantity and a price, sized for a busy service.',
    columns: [], labels: { description: 'Item', quantity: 'Quantity' },
    unitSuggestions: ['piece'],
    notes: 'Thank you and see you soon.', terms: 'Payment at the counter or by card.', footer: 'Service included unless stated otherwise.', rateHint: 'Check the correct rate for your activity.',
  },
  consulting: {
    id: 'consulting', label: 'Consulting & training',
    description: 'Days or sessions at a daily rate, with the mission stated in the description.',
    columns: [], labels: { quantity: 'Days or sessions', unitPrice: 'Rate' },
    unitSuggestions: ['day', 'session', 'hour'],
    notes: 'Mission carried out as described above.', terms: 'Payment within 30 days of the invoice date.', footer: 'A detailed report is available on request.', rateHint: 'Check the correct rate for your activity.',
  },
  transport: {
    id: 'transport', label: 'Transport & delivery',
    description: 'Trips or kilometres at a rate, for haulage, delivery and courier work.',
    columns: ['unit'], labels: { quantity: 'Trips', unitPrice: 'Rate' },
    unitSuggestions: ['trip', 'km', 'day'],
    notes: 'Transport carried out as requested.', terms: 'Payment within 30 days of the invoice date.', footer: 'Goods carried under the usual conditions.', rateHint: 'Check the correct rate for your activity.',
  },
  auto_entrepreneur: {
    id: 'auto_entrepreneur', label: 'Auto-entrepreneur',
    description: 'No TVA: the exemption mention and ICE, IF, TP and CNIE are printed instead of tax lines.',
    columns: [], labels: { quantity: 'Quantity', unitPrice: 'Unit price' },
    unitSuggestions: ['forfait', 'hour', 'day'],
    notes: 'Thank you for your business.', terms: 'Payment within 30 days of the invoice date.', footer: 'Auto-entrepreneur - TVA non applicable.', taxExempt: true,
  },
}

export const DEFAULT_LAYOUT_ID: LayoutId = 'classic'
export const DEFAULT_PRESET_ID: PresetId = 'general'
/** Legacy documents follow the app accent exactly like the old PDF did. */
export const LEGACY_ACCENT_ID: AccentId = 'auto'
export const MAX_FOOTER_NOTE = 160
export const MAX_LABEL_LENGTH = 40

/** The snapshot a document stores. `labels` holds i18n keys, not translated text. */
export interface DocumentTemplate {
  layoutId: LayoutId
  presetId: PresetId
  templateVersion: number
  accent: AccentId
  footerNote?: string
  labels: Partial<Record<ColumnId, string>>
  showLogo?: boolean
  showStamp?: boolean
  /**
   * Tax region the document was created under. It is part of the snapshot on
   * purpose: switching the app region later must not add Moroccan identifiers to a
   * document that was issued in the United States, or remove them from a Moroccan
   * one. Documents written before templates existed carry the region in force when
   * they are next saved, and are rendered with the current region until then.
   */
  region: TaxRegion
}

export const isLayoutId = (value: unknown): value is LayoutId => typeof value === 'string' && (LAYOUT_IDS as readonly string[]).includes(value)
export const isPresetId = (value: unknown): value is PresetId => typeof value === 'string' && (PRESET_IDS as readonly string[]).includes(value)
export const isAccentId = (value: unknown): value is AccentId => typeof value === 'string' && TEMPLATE_ACCENTS.some(accent => accent.id === value)

export const layoutOf = (template: DocumentTemplate): LayoutSpec => LAYOUTS[template.layoutId]
export const presetOf = (template: DocumentTemplate): PresetSpec => PRESETS[template.presetId]

/** The snapshot every document without one resolves to: exactly the old output. */
export const LEGACY_TEMPLATE: DocumentTemplate = {
  layoutId: DEFAULT_LAYOUT_ID,
  presetId: DEFAULT_PRESET_ID,
  templateVersion: TEMPLATE_VERSION,
  accent: LEGACY_ACCENT_ID,
  labels: { ...PRESETS[DEFAULT_PRESET_ID].labels },
  // The pre-template PDF never drew the logo, so a migrated document must not
  // start drawing one now; new documents default to showing it.
  showLogo: false,
  showStamp: false,
  region: DEFAULT_TAX_REGION,
}

/** Label keys a preset uses, so a snapshot carries the wording it was created with. */
export function presetLabels(presetId: PresetId): Partial<Record<ColumnId, string>> {
  return { ...PRESETS[presetId].labels }
}

/** Columns of a document: the mandatory four, plus what the preset adds. */
export function templateColumns(template: DocumentTemplate): ColumnId[] {
  const extra = PRESETS[template.presetId].columns.filter(column => !REQUIRED_COLUMNS.includes(column))
  // Table order stays readable whatever the preset adds.
  const columns: ColumnId[] = ['description', ...COLUMN_IDS.filter(id => id !== 'description' && (REQUIRED_COLUMNS.includes(id) || extra.includes(id)))]
  return columns
}

/** Snapshot first, preset default second: a stored document keeps its wording. */
export function columnLabelKey(template: DocumentTemplate, column: ColumnId): string {
  return template.labels?.[column] || PRESETS[template.presetId].labels[column] || COLUMN_LABEL[column]
}

export const COLUMN_LABEL: Record<ColumnId, string> = {
  description: 'Description', unit: 'Unit', quantity: 'Qty', unitPrice: 'Unit price', discount: 'Discount (%)', total: 'Total',
}

/** Trims, validates and completes any stored or imported snapshot. */
export function normalizeTemplate(value: unknown, regionFallback: TaxRegion = DEFAULT_TAX_REGION): DocumentTemplate {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<DocumentTemplate>
  const layoutId = isLayoutId(source.layoutId) ? source.layoutId : DEFAULT_LAYOUT_ID
  const presetId = isPresetId(source.presetId) ? source.presetId : DEFAULT_PRESET_ID
  const version = Number.isInteger(source.templateVersion) && (source.templateVersion as number) >= 1 ? source.templateVersion as number : TEMPLATE_VERSION
  const accent = isAccentId(source.accent) ? source.accent : LEGACY_ACCENT_ID
  const labels: Partial<Record<ColumnId, string>> = {}
  for (const column of COLUMN_IDS) {
    const key = source.labels?.[column]
    if (typeof key === 'string' && key.trim() && key.length <= MAX_LABEL_LENGTH) labels[column] = key
  }
  const footerNote = typeof source.footerNote === 'string' ? source.footerNote.trim().slice(0, MAX_FOOTER_NOTE) : ''
  return {
    layoutId, presetId, templateVersion: version, accent,
    region: isTaxRegion(source.region) ? source.region : regionFallback,
    ...(footerNote ? { footerNote } : {}),
    labels: { ...presetLabels(presetId), ...labels },
    showLogo: source.showLogo !== false,
    showStamp: source.showStamp === true,
  }
}

/**
 * Resolves a document's snapshot. A document written before templates existed
 * renders exactly like the legacy PDF (classic, general, app accent, no logo) and
 * follows the region currently configured, because it never stored one.
 */
export function documentTemplate(value: unknown, regionFallback: TaxRegion = DEFAULT_TAX_REGION): DocumentTemplate {
  if (!value || typeof value !== 'object') return { ...LEGACY_TEMPLATE, labels: { ...LEGACY_TEMPLATE.labels }, region: regionFallback }
  return normalizeTemplate(value, regionFallback)
}

/** Defaults for a new document, from Settings, with the shipped values as fallback. */
export function templateDefaults(
  settings?: { templateLayout?: unknown; templatePreset?: unknown; templateAccent?: unknown } | null,
  region: TaxRegion = DEFAULT_TAX_REGION,
): DocumentTemplate {
  return normalizeTemplate({
    layoutId: settings?.templateLayout,
    presetId: settings?.templatePreset,
    accent: settings?.templateAccent,
    templateVersion: TEMPLATE_VERSION,
    showLogo: true,
    region,
  }, region)
}

export function accentHex(template: DocumentTemplate, appAccent: string): string {
  const chosen = TEMPLATE_ACCENTS.find(accent => accent.id === template.accent)
  return chosen?.hex ?? appAccent
}

export const presetIsTaxExempt = (template: DocumentTemplate) => PRESETS[template.presetId].taxExempt === true

/** "Classic · Freelancer & services" - the combination name shown to the user. */
export function templateCombinationKeys(template: DocumentTemplate): [string, string] {
  return [LAYOUTS[template.layoutId].label, PRESETS[template.presetId].label]
}

/** One-line hint for the chosen topic, or null when the preset has nothing to say. */
export const presetRateHint = (template: DocumentTemplate): string | null => PRESETS[template.presetId].rateHint ?? null

/** Sample lines for the preview: descriptions and units are i18n keys. */
export function presetSample(template: DocumentTemplate): { description: string; quantity: number; unitPrice: number; unit?: string; discount?: number; section?: string }[] {
  switch (template.presetId) {
    case 'freelancer': return [{ description: 'Sample service', quantity: 12, unitPrice: 250, unit: 'hour' }, { description: 'Sample report', quantity: 1, unitPrice: 900, unit: 'forfait' }]
    case 'construction': return [
      { description: 'Sample material', quantity: 45, unitPrice: 120, unit: 'm²', section: 'materials' },
      { description: 'Sample labour', quantity: 6, unitPrice: 400, unit: 'day', section: 'labour' },
    ]
    case 'retail': return [{ description: 'Sample item', quantity: 3, unitPrice: 99.9, discount: 10 }, { description: 'Sample accessory', quantity: 1, unitPrice: 45 }]
    case 'restaurant': return [{ description: 'Sample dish', quantity: 2, unitPrice: 65 }, { description: 'Sample drink', quantity: 3, unitPrice: 18 }]
    case 'consulting': return [{ description: 'Sample workshop', quantity: 2, unitPrice: 2500 }, { description: 'Sample follow-up', quantity: 3, unitPrice: 800 }]
    case 'transport': return [{ description: 'Sample delivery', quantity: 4, unitPrice: 350, unit: 'trip' }, { description: 'Sample waiting time', quantity: 2, unitPrice: 120, unit: 'hour' }]
    case 'auto_entrepreneur': return [{ description: 'Sample service', quantity: 1, unitPrice: 1200, unit: 'forfait' }]
    default: return [{ description: 'Sample item', quantity: 2, unitPrice: 150 }, { description: 'Sample service', quantity: 1, unitPrice: 400 }]
  }
}

/** Column alignment: amounts and quantities end, text starts. */
export function columnAlign(column: ColumnId): 'start' | 'end' {
  return column === 'description' || column === 'unit' ? 'start' : 'end'
}

