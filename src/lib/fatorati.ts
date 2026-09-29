/**
 * Fatorati Offline - Business Utilities
 * 100% Local • Offline - Simple business management
 * No subscription. Your data stays on device. Works offline.
 */

export type Currency = 'USD' | 'EUR'

const currencyLocale: Record<Currency, string> = {
  USD: 'en-US',
  EUR: 'en-US',
}

export function money(n: number, currency: Currency = 'USD', compact = false): string {
  const v = Math.round(n * 100) / 100
  const formatted = new Intl.NumberFormat(currencyLocale[currency], {
    notation: compact ? 'compact' : 'standard',
    style: 'currency',
    currency,
    maximumFractionDigits: compact ? 1 : 2,
  }).format(v)
  return formatted
}

export function num(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function fmtDate(iso: string | number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export function fmtDateTime(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

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

// PDF Generation - Offline
export function generateInvoicePDFData(invoice: any, business: any, customer: any): string {
  // Simple text-based PDF data for offline generation
  // In production, use jsPDF or similar for real PDF
  return `
INVOICE ${invoice.number}
Business: ${business?.name || 'Your Business'}
Customer: ${customer?.name || 'Customer'}
Date: ${invoice.issueDate}
Due: ${invoice.dueDate}

Items:
${invoice.items?.map((item: any) => `- ${item.description}: ${item.quantity} x ${money(item.unitPrice)} = ${money(item.total)}`).join('\n') || ''}

Subtotal: ${money(invoice.subtotal)}
Tax: ${money(invoice.tax)}
Total: ${money(invoice.total)}

Notes: ${invoice.notes || ''}
  `.trim()
}

export function downloadTextFile(content: string, filename: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
