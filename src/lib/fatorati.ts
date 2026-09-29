/**
 * Fatorati Offline - Business Utilities
 * 100% Local • Offline - Simple business management
 * No subscription. Your data stays on device. Works offline.
 */

export type Currency = string
export { money, number as num, formatDate as fmtDate } from './format'
import { formatDate } from './format'
export const fmtDateTime = (value: number) => formatDate(value, true)

export function generateInvoiceNumber(prefix = 'INV'): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}-${year}${month}-${random}`
}

export function generateEstimateNumber(prefix = 'EST'): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}-${year}${month}-${random}`
}

export function sanitize(input: string): string {
  let out = ''
  for (const ch of String(input).replace(/[<>]/g, '')) {
    const code = ch.charCodeAt(0)
    if (code >= 32 && code !== 127) out += ch
  }
  return out.trim().slice(0, 400)
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
export const APP_TAGLINE = 'Simple business management'
export const APP_POSITIONING = '100% Local • Offline'
export const APP_PROMISE = 'No subscription. Your customers, invoices and business records stay on your device. Works offline.'
export const APP_FLOW = 'Create invoice → PDF → Share - easy for US customers'
