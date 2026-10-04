/**
 * Fatorati Offline - subscription exports
 *
 * Rows and page lines are pure and tested; the writers only turn them into
 * bytes. Everything goes through the existing staged-export flow (shareFile),
 * so plaintext files land in the app cache and are purged at the next launch or
 * unlock, exactly like the CSV and PDF exports that already exist.
 */

import { t } from '../i18n'
import { formatDate, money } from './format'
import { getPreferences, type Language } from './preferences'
import { sessionGuard } from './vault'
import { shareFile } from './share-file'
import { minorToAmount, sortByNearest, subscriptionSummary, todayISO, type SubscriptionSummary, type SubscriptionView, type SubscriptionStatus } from './subscriptions'
import type { Subscription } from '../store/types'

export interface SubscriptionExportOptions {
  now?: number
  timeZone?: string
  warn?: number
  language?: Language
}

export interface SubscriptionExportRow {
  service: string
  category: string
  amount: number
  amountText: string
  currency: string
  cycle: string
  autoRenew: string
  startDate: string
  targetDate: string
  status: string
  paymentMethod: string
  notes: string
  cancelled: boolean
}

export interface SubscriptionExport {
  rows: SubscriptionExportRow[]
  totals: SubscriptionSummary[]
}

const yesNo = (value: boolean, language: Language) => t(value ? 'Yes' : 'No', {}, language)

/** Resolves one record to printable values, using the same status logic as the list. */
export function subscriptionExportRow(row: { subscription: Subscription; view: SubscriptionView }, language: Language): SubscriptionExportRow {
  const { subscription, view } = row
  return {
    service: subscription.serviceName,
    category: subscription.category || '',
    amount: minorToAmount(subscription.amountMinor, subscription.currency),
    amountText: money(minorToAmount(subscription.amountMinor, subscription.currency), subscription.currency, false, language),
    currency: subscription.currency,
    cycle: t(subscription.billingCycle, {}, language),
    autoRenew: yesNo(subscription.autoRenew, language),
    startDate: subscription.startDate,
    targetDate: view.date,
    status: t(view.status, {}, language),
    paymentMethod: subscription.paymentMethod || '',
    notes: subscription.notes || '',
    cancelled: view.status === 'cancelled',
  }
}

export function buildSubscriptionExport(subscriptions: Subscription[], options: SubscriptionExportOptions = {}): SubscriptionExport {
  const language = options.language ?? getPreferences().language
  const sorted = sortByNearest(subscriptions, options)
  return {
    rows: sorted.map(row => subscriptionExportRow(row, language)),
    totals: subscriptionSummary(subscriptions, options),
  }
}

export function subscriptionTotalsText(totals: SubscriptionSummary[], language: Language): string[] {
  return totals.map(total => `${total.currency}: ${t('{monthly} per month · {yearly} per year', {
    monthly: money(minorToAmount(total.monthlyMinor, total.currency), total.currency, false, language),
    yearly: money(minorToAmount(total.yearlyMinor, total.currency), total.currency, false, language),
  }, language)}`)
}

/** Header + records + one totals line per currency (never a mixed-currency sum). */
export function subscriptionSheet(fill: SubscriptionExport, language: Language): (string | number)[][] {
  const header = ['Service', 'Category', 'Amount', 'Currency', 'Cycle', 'Auto-renew', 'Start date', 'Next renewal / end', 'Status', 'Payment method', 'Notes']
  const rows: (string | number)[][] = [header.map(key => t(key, {}, language))]
  for (const row of fill.rows) {
    rows.push([row.service, row.category, row.amount, row.currency, row.cycle, row.autoRenew, row.startDate, row.targetDate, row.status, row.paymentMethod, row.notes])
  }
  if (fill.totals.length) {
    rows.push([])
    for (const total of fill.totals) {
      rows.push([`${t('Total', {}, language)} (${total.currency})`, '', minorToAmount(total.monthlyMinor, total.currency), total.currency, t('per month', {}, language), '', '', '', '', '', `${minorToAmount(total.yearlyMinor, total.currency)} ${t('per year', {}, language)}`])
    }
  }
  return rows
}

/** Generates the .xlsx bytes. `write-excel-file` needs no network and ships own zipper. */
export async function subscriptionXlsxBytes(fill: SubscriptionExport, language: Language = getPreferences().language): Promise<Uint8Array<ArrayBuffer>> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const rows = subscriptionSheet(fill, language)
  const header = rows[0]
  const sheet = rows.map((cells, index) => cells.map(cell => ({
    value: cell === '' ? undefined : cell,
    fontWeight: index === 0 ? ('bold' as const) : undefined,
    wrap: typeof cell === 'string' && cell.length > 40 ? true : undefined,
    type: typeof cell === 'number' ? Number : String,
  })))
  void header
  const columns = [24, 16, 12, 10, 16, 12, 14, 20, 16, 18, 32].map(width => ({ width }))
  const file = writeXlsxFile(sheet as never, { columns, sheet: t('Subscriptions', {}, language) } as never)
  const blob = await file.toBlob()
  return new Uint8Array(await blob.arrayBuffer()) as Uint8Array<ArrayBuffer>
}

export async function exportSubscriptionsXlsx(subscriptions: Subscription[], options: SubscriptionExportOptions = {}): Promise<void> {
  const guard = sessionGuard()
  const language = options.language ?? getPreferences().language
  const fill = buildSubscriptionExport(subscriptions, options)
  const bytes = await subscriptionXlsxBytes(fill, language)
  guard()
  await shareFile(`fatorati-subscriptions-${todayISO()}.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

/** Rows of the PDF table, kept pure so the layout can be tested without a canvas. */
export interface PdfTable {
  title: string
  subtitle: string
  headers: string[]
  rows: string[][]
  details: string[]
  totals: string[]
  notice: string
}

export function subscriptionPdfTable(fill: SubscriptionExport, language: Language, now = Date.now()): PdfTable {
  return {
    title: t('Subscriptions', {}, language),
    subtitle: formatDate(now, true, language),
    headers: ['Service', 'Category', 'Amount', 'Cycle', 'Auto-renew', 'Start date', 'Next renewal / end', 'Status'].map(key => t(key, {}, language)),
    rows: fill.rows.map(row => [row.service, row.category, row.amountText, row.cycle, row.autoRenew, row.startDate, row.targetDate, row.status]),
    details: fill.rows.flatMap(row => {
      const parts = [row.paymentMethod, row.notes].filter(Boolean)
      return parts.length ? [`${row.service}: ${parts.join(' · ')}`] : []
    }),
    totals: subscriptionTotalsText(fill.totals, language),
    notice: t('Exported files are not encrypted. Delete them when you are done.', {}, language),
  }
}

/**
 * Renders the table on a canvas and embeds it in a PDF. The canvas route is what
 * already gives the invoice PDFs correct Arabic shaping with the bundled fonts.
 */
export async function exportSubscriptionsPdf(subscriptions: Subscription[], options: SubscriptionExportOptions = {}): Promise<void> {
  const guard = sessionGuard()
  const language = options.language ?? getPreferences().language
  const prefs = getPreferences()
  const fill = buildSubscriptionExport(subscriptions, options)
  const table = subscriptionPdfTable(fill, language, options.now)
  const fontFamily = language === 'ar' ? 'Tajawal' : 'Inter'
  await document.fonts.load(`22px "${fontFamily}"`)
  guard()
  const { jsPDF } = await import('jspdf')
  const canvas = document.createElement('canvas')
  canvas.width = 1754; canvas.height = 1240
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('PDF rendering is unavailable on this device.')
  const rtl = language === 'ar'
  const margin = 60, lineHeight = 34
  let y = margin
  const pages: string[] = []
  const reset = () => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = prefs.accent; ctx.fillRect(0, 0, canvas.width, 54)
    ctx.textBaseline = 'top'; y = margin + 40
  }
  const flush = () => { pages.push(canvas.toDataURL('image/png')); reset() }
  const line = (text: string, size = 22, color = '#111827', indent = 0) => {
    if (y + lineHeight > canvas.height - margin) flush()
    ctx.fillStyle = color; ctx.font = `${size}px ${fontFamily}`
    ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left'
    ctx.fillText(text, rtl ? canvas.width - margin - indent : margin + indent, y)
    y += lineHeight
  }
  reset()
  line(`${table.title} — ${t('Fatorati', {}, language)}`, 30, '#ffffff')
  y = margin + 40
  line(table.subtitle, 20, '#64748b')

  // Fixed column grid across the printable width.
  const widths = [300, 190, 190, 190, 170, 190, 220, 190]
  const usable = canvas.width - margin * 2
  const total = widths.reduce((sum, width) => sum + width, 0)
  let cursor = margin
  const columns = table.headers.map((label, index) => {
    const width = widths[index] * (usable / total)
    const column = { label, x: cursor, width }
    cursor += width
    return column
  })
  ctx.font = `20px ${fontFamily}`
  ctx.fillStyle = '#0b1220'; ctx.direction = 'ltr'; ctx.textAlign = 'left'
  for (const column of columns) ctx.fillText(column.label, column.x, y)
  y += lineHeight
  ctx.fillStyle = '#e5e8ee'; ctx.fillRect(margin, y - 12, usable, 2)
  for (const row of table.rows) {
    if (y + lineHeight > canvas.height - margin) flush()
    ctx.font = `20px ${fontFamily}`
    row.forEach((cell, index) => {
      const column = columns[index]
      ctx.fillStyle = index === 0 ? '#0b1220' : '#334155'
      ctx.textAlign = rtl ? 'right' : 'left'
      ctx.fillText(fit(ctx, String(cell), column.width - 10), rtl ? column.x + column.width - 10 : column.x, y)
    })
    y += lineHeight
  }
  for (const detail of table.details) line(detail, 18, '#64748b', 10)
  if (table.totals.length) {
    y += 10
    line(t('Totals', {}, language), 24)
    for (const entry of table.totals) line(entry, 20)
  }
  line(table.notice, 18, '#dc2626')
  pages.push(canvas.toDataURL('image/png'))

  const pdf = new jsPDF({ compress: true, orientation: 'landscape' })
  pages.forEach((data, index) => {
    if (index) pdf.addPage('a4', 'landscape')
    pdf.addImage(data, 'PNG', 0, 0, 297, 210, undefined, 'FAST')
  })
  guard()
  await shareFile(`fatorati-subscriptions-${todayISO()}.pdf`, new Uint8Array(pdf.output('arraybuffer')) as Uint8Array<ArrayBuffer>, 'application/pdf')
}

/** Truncates a cell so a long note cannot overlap the next column. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text
  let end = text.length
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > width) end--
  return `${text.slice(0, end)}…`
}
