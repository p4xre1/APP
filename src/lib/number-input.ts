/**
 * Text <-> number handling for money and quantity fields.
 *
 * A field keeps the raw text while the user types, so it can be empty. Empty
 * means "no value yet" (null), never 0. Parsing happens on save, formatting on blur.
 */
export type DigitStyle = 'latn' | 'arab'

const TRANSLATIONS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٫': '.', '٬': '',
}
/** Western, Arabic-Indic and Extended Arabic-Indic digits become ASCII digits. */
export function normalizeDigits(text: string): string {
  return [...text].map(character => TRANSLATIONS[character] ?? character).join('')
}
const stripSeparators = (text: string) => normalizeDigits(text).replace(/[\s\u00a0\u202f']/g, '')
const PARTIAL = /^[0-9]*[.,]?[0-9]*$/

/**
 * Keep the text a user may still be typing: digits plus at most one "." or ",",
 * letters and other symbols are dropped. Unusable text keeps the previous value.
 */
export function acceptNumberText(raw: string, previous: string, integer = false): string {
  let text = stripSeparators(raw)
  text = integer ? text.replace(/[^0-9]/g, '') : text.replace(/[^0-9.,]/g, '')
  const first = text.search(/[.,]/)
  if (first >= 0) text = text.slice(0, first + 1) + text.slice(first + 1).replace(/[.,]/g, '')
  if (text.length > 18) return previous
  return PARTIAL.test(text) ? text : previous
}

/** Empty (or a lone separator) has no value: null, not 0. Both "." and "," are decimal. */
export function parseNumberText(text: string): number | null {
  const normalized = stripSeparators(text).replace(',', '.')
  if (/^$|^\.$/.test(normalized)) return null
  if (!/^[0-9]*\.?[0-9]*$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** Display text for a stored value: no grouping, locale/decimal-aware, "" for null. */
export function formatNumberText(value: number | null | undefined, options: { integer?: boolean; digits?: DigitStyle; locale?: string } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  const { integer = false, digits = 'latn', locale = 'en' } = options
  return new Intl.NumberFormat(`${locale}-u-nu-${digits}`, {
    useGrouping: false, maximumFractionDigits: integer ? 0 : 6,
  }).format(value)
}

/** One change event: sanitize the raw text, then read the value the form should store. */
export function numberInputChange(text: string, raw: string, integer = false): { text: string; value: number | null } {
  const next = acceptNumberText(raw, text, integer)
  return { text: next, value: parseNumberText(next) }
}

export interface NumberRules { required?: boolean; min?: number }
/** Translation key for the field error, or null when the value is acceptable. */
export function numberError(value: number | null, rules: NumberRules = {}): string | null {
  if (value === null || !Number.isFinite(value)) return rules.required ? 'Required field' : null
  if (rules.min !== undefined && value < rules.min) return 'Value must be at least {min}'
  return null
}
