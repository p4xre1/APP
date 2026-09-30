/**
 * Fatorati Offline - Business Utilities
 * 100% Local • Offline - Simple business management
 * No subscription. Your data stays on device. Works offline.
 */

export type Currency = string
export { money, formatDate as fmtDate } from './format'

/** Keep prefixes short, printable and portable: letters and digits only. */
export function normalizePrefix(prefix: string, fallback: string) {
  const clean = String(prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return clean || fallback
}

/**
 * Sequential document number: `PREFIX-YYYY-0001`. The next number is derived from
 * the numbers already stored **and** from the per-series floor kept in Settings
 * (`numberFloor`, keyed `PREFIX-YYYY`), so deleting the latest document can never
 * bring its number back: the floor only rises, and replacing a backup keeps the
 * existing sequence. Two documents can never share a number in one app install.
 */
export function nextDocumentNumber(existing: string[], prefix: string, fallback: string, date = new Date(), floor = 0) {
  const clean = normalizePrefix(prefix, fallback)
  const year = date.getFullYear()
  const pattern = new RegExp(`^${clean}-${year}-(\\d+)$`)
  let highest = Number.isInteger(floor) && floor > 0 ? floor : 0
  for (const value of existing) {
    const match = pattern.exec(typeof value === 'string' ? value : '')
    if (match) highest = Math.max(highest, Number(match[1]))
  }
  const used = new Set(existing)
  let sequence = highest + 1
  let candidate = `${clean}-${year}-${String(sequence).padStart(4, '0')}`
  while (used.has(candidate) && sequence < 1_000_000) {
    sequence++
    candidate = `${clean}-${year}-${String(sequence).padStart(4, '0')}`
  }
  return candidate
}

/** Key of a number series inside `Settings.numberFloor`: `PREFIX-YYYY`. */
export function numberFloorKey(prefix: string, fallback: string, date = new Date()): string {
  return `${normalizePrefix(prefix, fallback)}-${date.getFullYear()}`
}

/** The floor of one series, 0 when none is stored. */
export function seriesFloor(floors: Record<string, number> | undefined, prefix: string, fallback: string, date = new Date()): number {
  const value = floors?.[numberFloorKey(prefix, fallback, date)]
  return Number.isInteger(value) && (value as number) > 0 ? (value as number) : 0
}

const NUMBER_PATTERN = /^([A-Z0-9]{1,8})-(\d{4})-(\d+)$/

/**
 * The floor map after a document number is used: raised when the number tops its
 * series, `null` when nothing changes (so callers can skip the settings write).
 * Numbers outside the `PREFIX-YYYY-NNNN` shape (hand-typed or legacy) raise nothing.
 */
export function raisedFloor(current: Record<string, number> | undefined, documentNumber: string): Record<string, number> | null {
  const match = NUMBER_PATTERN.exec(typeof documentNumber === 'string' ? documentNumber : '')
  if (!match) return null
  const key = `${match[1]}-${match[2]}`
  const sequence = Number(match[3])
  // The 1,000,000 cap matches the backup validator, so a hand-typed giant
  // number can never make the settings record unexportable.
  if (!Number.isSafeInteger(sequence) || sequence > 1_000_000 || sequence <= (current?.[key] || 0)) return null
  return { ...current, [key]: sequence }
}

/** The highest sequence used per `PREFIX-YYYY` series, from stored numbers. */
export function floorsFromNumbers(numbers: string[]): Record<string, number> {
  let floors: Record<string, number> = {}
  for (const value of numbers) floors = raisedFloor(floors, value) || floors
  return floors
}

// Validation
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validatePhone(phone: string): boolean {
  return /^[\d\s+\-()]{10,}$/.test(phone)
}

// App Info
export const APP_NAME = 'Fatorati'
export const APP_POSITIONING = '100% Local • Offline'
