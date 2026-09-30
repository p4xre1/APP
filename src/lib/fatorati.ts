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
 * the numbers already stored, so replacing a backup keeps the existing sequence
 * and two documents can never share a number in one app install.
 */
export function nextDocumentNumber(existing: string[], prefix: string, fallback: string, date = new Date()) {
  const clean = normalizePrefix(prefix, fallback)
  const year = date.getFullYear()
  const pattern = new RegExp(`^${clean}-${year}-(\\d+)$`)
  let highest = 0
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
