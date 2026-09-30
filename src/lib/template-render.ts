/**
 * Template renderer: data -> document model -> pages of drawing operations.
 *
 * Nothing here touches the DOM directly:
 *   - buildDocumentModel() turns a stored invoice/estimate into a translated model
 *     (header, parties, columns, rows, totals, notes, footer, mandatory fields);
 *   - layoutDocument() paginates that model with the layout's style choices and a
 *     text-measuring function, repeating the table header on every page;
 *   - paintPage() draws one page of operations onto a canvas.
 *
 * The PDF pipeline paints the pages onto a canvas and hands them to jsPDF, the
 * picker preview paints the same pages into a smaller canvas, and the tests assert
 * on the model and the operations without needing a browser.
 */
import { t } from '../i18n'
import { accentText, type Language } from './preferences'
import { formatDate, money, number as formatNumber, roundMoney } from './format'
import type { TaxRegion } from '../store/types'
import {
  accentHex, columnAlign, columnLabelKey, layoutOf, presetOf, presetSample, templateColumns,
  type ColumnId, type DocumentTemplate, type LayoutSpec, type PresetSpec,
} from './templates'
import type { Business, Customer, Estimate, Invoice, InvoiceItem } from '../store/types'

/** A4 at ~150 dpi: the page size the existing pipeline has always rendered. */
export const PAGE_WIDTH = 1240
export const PAGE_HEIGHT = 1754

export interface TextOp { kind: 'text'; x: number; y: number; text: string; font: string; size: number; color: string; align: 'start' | 'end' | 'center'; dir: 'ltr' | 'rtl' }
export interface RectOp { kind: 'rect'; x: number; y: number; w: number; h: number; color: string }
export interface LineOp { kind: 'line'; x: number; y: number; x2: number; y2: number; color: string; width: number }
export interface ImageOp { kind: 'image'; src: string; x: number; y: number; w: number; h: number }
export type Op = TextOp | RectOp | LineOp | ImageOp
export interface DocumentPage { width: number; height: number; ops: Op[] }

/** Text measurement, injected so pagination stays pure and testable. */
export interface Measure { (text: string, font: string): number }

/** The subset of CanvasRenderingContext2D the painter needs. */
export interface PaintContext {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  font: string
  textAlign: 'left' | 'right' | 'center'
  textBaseline: 'top' | 'middle' | 'alphabetic'
  direction: 'ltr' | 'rtl'
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
  drawImage(image: CanvasImageSource, x: number, y: number, w: number, h: number): void
}

export interface ModelInput {
  kind: 'invoice' | 'estimate'
  document: Invoice | Estimate
  business?: Business | null
  customer?: Customer | null
  region: TaxRegion
  currency: string
  language: Language
  template: DocumentTemplate
  appAccent: string
}

export interface TableRow { section?: string; cells: string[] }
export interface Labelled { label: string; value: string | null }

export interface DocumentModel {
  kind: 'invoice' | 'estimate'
  title: string
  number: string
  language: Language
  rtl: boolean
  currency: string
  region: TaxRegion
  template: DocumentTemplate
  layout: LayoutSpec
  preset: PresetSpec
  accent: string
  accentInk: string
  appName: string
  logo?: string
  stamp?: string
  businessName: string
  businessLines: string[]
  /** Seller identifiers: MA always prints ICE, IF, TP and RC (CNIE when exempt). */
  sellerIds: Labelled[]
  customerName: string
  customerLines: string[]
  /** Client ICE: mandatory on a Moroccan document, printed with a dash when empty. */
  customerIds: Labelled[]
  meta: Labelled[]
  columns: { id: ColumnId; label: string; align: 'start' | 'end' }[]
  rows: TableRow[]
  totals: { label: string; value: string; emphasis?: boolean }[]
  taxExempt: boolean
  exemption: string
  notesLabel: string
  notes?: string
  termsLabel: string
  terms: string
  footer: string
  footerNote?: string
  pageWord: string
  /** Labels of mandatory fields that carry no value, so the UI can warn. */
  missing: string[]
}

const translator = (language: Language) => (key: string, params: Record<string, string | number> = {}) => t(key, params, language)

/** TVA grouped by rate in Morocco; a separate, plainly named line in the US. */
function taxLabel(region: TaxRegion, rate: number, language: Language): string {
  const tr = translator(language)
  return region === 'MA' ? `${tr('TVA')} ${formatNumber(rate, language)}%` : tr('Sales tax')
}

/** The model the layouts draw: everything translated, nothing measured yet. */
export function buildDocumentModel(input: ModelInput): DocumentModel {
  const { kind, document: doc, business, customer, region, currency, language, template } = input
  const tr = translator(language)
  const preset = presetOf(template)
  const accent = accentHex(template, input.appAccent)
  const missing: string[] = []

  // Seller identity, client identity and the list of empty mandatory fields.
  const mandatory = mandatoryFields({ region, business, customer, template, paymentMethod: doc.paymentMethod, language })
  const { sellerIds, customerIds } = mandatory
  missing.push(...mandatory.missing)

  const businessLines = [
    business?.ownerName || '',
    business?.address || '',
    business?.city || '',
    [business?.phone || '', business?.email || ''].filter(Boolean).join(' · '),
  ].filter(line => line.trim())

  const customerLines = [
    customer?.address || '', customer?.city || '',
    [customer?.phone || '', customer?.email || ''].filter(Boolean).join(' · '),
  ].filter(line => line.trim())

  const rate = Number(doc.taxRate) || 0
  const taxExempt = preset.taxExempt === true
  const isEstimate = kind === 'estimate'
  const estimate = isEstimate ? (doc as Estimate) : null
  const invoice = isEstimate ? null : (doc as Invoice)

  const paymentMethod = (doc.paymentMethod || '').trim()
  const meta: Labelled[] = [
    { label: tr('Date and time'), value: formatDate(doc.occurredAt || doc.createdAt, true, language) },
    { label: tr('Issue date'), value: formatDate(doc.issueDate, false, language) },
    { label: tr(isEstimate ? 'Expiry date' : 'Due date'), value: formatDate(estimate ? estimate.expiryDate : invoice!.dueDate, false, language) },
    { label: tr('Status'), value: tr(doc.status) },
    { label: tr('Payment method'), value: paymentMethod ? tr(paymentMethod) : '—' },
  ]

  const columns = templateColumns(template).map(column => ({
    id: column, label: tr(columnLabelKey(template, column)), align: columnAlign(column),
  }))

  const rows: TableRow[] = doc.items.map(item => ({
    section: preset.groupBy === 'section' ? sectionLabel(item, language) : undefined,
    cells: columns.map(column => lineCell(column.id, item, currency, language)),
  }))

  const totals: { label: string; value: string; emphasis?: boolean }[] = [
    { label: tr('Total excl. tax'), value: money(doc.subtotal, currency, false, language) },
  ]
  // "Grouped by rate": the app applies one rate per document, so the group is that
  // rate; the loop keeps the door open for several groups without changing the model.
  if (!taxExempt && rate > 0) totals.push({ label: taxLabel(region, rate, language), value: money(doc.tax, currency, false, language) })
  totals.push({ label: tr('Total incl. tax'), value: money(doc.total, currency, false, language), emphasis: true })

  return {
    kind, title: tr(isEstimate ? 'Estimate' : 'Invoice'), number: doc.number,
    language, rtl: language === 'ar', currency, region, template, layout: layoutOf(template), preset, accent,
    accentInk: accentText(accent), appName: tr('Fatorati'),
    logo: template.showLogo === true ? business?.logo : undefined,
    stamp: template.showStamp === true ? business?.stamp : undefined,
    businessName: business?.name || tr('Your Business'),
    businessLines, sellerIds,
    customerName: customer?.name || doc.customerId,
    customerLines, customerIds, meta, columns, rows, totals, taxExempt,
    exemption: tr('TVA non applicable'),
    notesLabel: tr('Notes'), notes: doc.notes?.trim() || undefined,
    termsLabel: tr('Payment terms'), terms: tr(preset.terms),
    footer: tr(preset.footer), footerNote: template.footerNote?.trim() || undefined,
    pageWord: tr('Page'), missing,
  }
}

const SECTION_LABEL: Record<string, string> = { materials: 'Materials', labour: 'Labour' }
export function sectionLabel(item: InvoiceItem, language: Language): string | undefined {
  const value = (item.section || '').trim()
  if (!value) return undefined
  return SECTION_LABEL[value] ? t(SECTION_LABEL[value], {}, language) : value
}

function lineCell(column: ColumnId, item: InvoiceItem, currency: string, language: Language): string {
  switch (column) {
    case 'description': return item.description
    case 'unit': return (item.unit || '').trim()
    case 'quantity': return formatNumber(item.quantity, language)
    case 'unitPrice': return money(item.unitPrice, currency, false, language)
    case 'discount': return item.discount ? `${formatNumber(item.discount, language)}%` : ''
    case 'total': return money(item.total, currency, false, language)
  }
}

/** Sample line of a document line: `total` follows the same rounding as a real one. */
export function sampleLineTotal(quantity: number, unitPrice: number, discountPercent: number | undefined, currency: string): number {
  const gross = roundMoney(roundMoney(unitPrice, currency) * quantity, currency)
  if (!discountPercent) return gross
  return roundMoney(gross * (1 - discountPercent / 100), currency)
}


/**
 * The mandatory content of a document, in one place: the seller and client blocks
 * and the labels of the fields that are empty. A layout or a preset may never
 * remove any of these - an empty value prints as a dash and is reported here, which
 * is what the form shows as its warning.
 */
export function mandatoryFields(input: {
  region: TaxRegion
  business?: Business | null
  customer?: Customer | null
  template: DocumentTemplate
  paymentMethod?: string
  language: Language
}): { sellerIds: Labelled[]; customerIds: Labelled[]; missing: string[] } {
  const tr = translator(input.language)
  const preset = presetOf(input.template)
  const missing: string[] = []
  const sellerIds: Labelled[] = []
  const identifier = (label: string, value: string | undefined) => {
    const clean = (value || '').trim() || null
    if (!clean) missing.push(label)
    sellerIds.push({ label, value: clean })
  }
  if (input.region === 'MA') {
    identifier(tr('ICE'), input.business?.taxNumber)
    identifier(tr('IF'), input.business?.ifNumber)
    identifier(tr('TP'), input.business?.tpNumber)
    if (preset.taxExempt) identifier(tr('CNIE'), input.business?.cnieNumber)
    else identifier(tr('RC'), input.business?.rcNumber)
  } else if ((input.business?.taxNumber || '').trim()) {
    sellerIds.push({ label: tr('Tax number'), value: (input.business?.taxNumber || '').trim() })
  }
  const customerIds: Labelled[] = []
  if (input.region === 'MA') {
    const ice = (input.customer?.taxNumber || '').trim() || null
    if (!ice) missing.push(tr('Client ICE'))
    customerIds.push({ label: tr('Client ICE'), value: ice })
  }
  if (!(input.business?.address || '').trim() && !(input.business?.city || '').trim()) missing.push(tr('Address'))
  if (!(input.paymentMethod || '').trim()) missing.push(tr('Payment method'))
  return { sellerIds, customerIds, missing }
}

/**
 * Sample model for the picker preview: same builder, same layouts, invented values.
 * The preview therefore shows exactly what a document would print, including the
 * mandatory identifiers (dashes included) and the exemption mention.
 */
export function buildSampleModel(template: DocumentTemplate, language: Language, currency: string, region: TaxRegion, appAccent: string, paymentMethod: string): DocumentModel {
  const tr = translator(language)
  const items: InvoiceItem[] = presetSample(template).map((line, index) => ({
    id: `sample-${index}`,
    description: tr(line.description),
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    ...(line.unit ? { unit: tr(line.unit) } : {}),
    ...(line.discount ? { discount: line.discount } : {}),
    ...(line.section ? { section: line.section } : {}),
    total: sampleLineTotal(line.quantity, line.unitPrice, line.discount, currency),
  }))
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0), currency)
  const exempt = presetOf(template).taxExempt === true
  const rate = 20
  const tax = exempt ? 0 : roundMoney(subtotal * (rate / 100), currency)
  const today = new Date().toISOString().slice(0, 10)
  const document: Invoice = {
    id: 'sample', number: 'INV-2026-0001', customerId: 'sample-customer',
    items, subtotal, tax, total: roundMoney(subtotal + tax, currency),
    status: 'draft', issueDate: today, dueDate: today, notes: '', createdAt: Date.now(), updatedAt: Date.now(),
    currency, language, taxRate: exempt ? 0 : rate, paymentMethod,
  }
  return buildDocumentModel({
    kind: 'invoice', document,
    business: {
      id: 'sample-business', name: tr('Your Business'), ownerName: tr('Owner Name'),
      phone: '', email: '', address: tr('Address'), city: '', createdAt: 0, updatedAt: 0,
      taxNumber: '123456789012345', ifNumber: '12345678', tpNumber: '12345678', rcNumber: '12345', cnieNumber: 'AB123456',
    },
    customer: {
      id: 'sample-customer', name: tr('Sample customer'), email: '', phone: '',
      address: tr('Address'), city: '', notes: '', balance: 0, createdAt: 0, updatedAt: 0, taxNumber: '987654321098765',
    },
    region, currency, language, template, appAccent,
  })
}

export interface LayoutOptions { measure: Measure }

/**
 * Paginates the model: the table header repeats on every page, long descriptions
 * wrap word by word, and a continuation page keeps a thin title row so a reader
 * always knows which document the page belongs to.
 */
export function layoutDocument(model: DocumentModel, options: LayoutOptions): DocumentPage[] {
  const layout = model.layout
  const margin = layout.margin
  const family = model.language === 'ar' ? 'Tajawal' : 'Inter'
  const font = (size: number, bold = false) => `${bold ? 'bold ' : ''}${size}px ${family}`
  const start = margin
  const end = PAGE_WIDTH - margin
  const maxWidth = end - start
  const measure = options.measure
  const tr = translator(model.language)

  const pages: DocumentPage[] = []
  let ops: Op[] = []
  let y = 0
  let page = 0
  const bottom = PAGE_HEIGHT - margin - 26

  const pushText = (value: string, size: number, color: string, align: 'start' | 'end', boardY: number, bold = false, x = align === 'end' ? end : start, dir?: 'ltr' | 'rtl') => {
    const direction = dir ?? (model.rtl ? 'rtl' : 'ltr')
    ops.push({ kind: 'text', x, y: boardY, text: value, font: font(size, bold), size, color, align: model.rtl ? (align === 'end' ? 'end' : 'start') : align, dir: direction })
  }

  const startPage = (continuation: boolean) => {
    ops = []
    if (continuation) {
      const size = Math.max(18, layout.baseSize - 6)
      y = 24
      pushText(`${model.title} ${model.number}`, size, model.accent, 'start', y, true)
      y += size + 12
      ops.push({ kind: 'line', x: start, y, x2: end, y2: y, color: '#e2e8f0', width: 2 })
      y += 18
    } else {
      y = drawHeader(model, layout, font, ops)
    }
    page += 1
    pages.push({ width: PAGE_WIDTH, height: PAGE_HEIGHT, ops })
  }

  const room = (needed: number) => y + needed > bottom
  const newPage = () => {
    drawFooter(model, layout, font, page, ops)
    startPage(true)
    tableHeader()
  }

  const paragraph = (value: string, size: number, color: string, bold = false) => {
    const lineHeight = Math.round(size * 1.45)
    for (const raw of value.split(/\r?\n/)) {
      if (!raw.trim()) { y += Math.round(lineHeight / 2); continue }
      let buffer = ''
      for (const word of raw.split(/\s+/).filter(Boolean)) {
        const candidate = buffer ? `${buffer} ${word}` : word
        if (measure(candidate, font(size, bold)) <= maxWidth) { buffer = candidate; continue }
        if (buffer) { emit(buffer) }
        buffer = ''
        for (const character of word) {
          if (measure(buffer + character, font(size, bold)) > maxWidth) { emit(buffer); buffer = '' }
          buffer += character
        }
      }
      if (buffer) emit(buffer)
    }
    function emit(line: string) {
      if (room(lineHeight)) newPage()
      pushText(line, size, color, 'start', y, bold)
      y += lineHeight
    }
  }

  const columnWidths = model.columns.map(column => {
    const share = column.id === 'description' ? 0.44 : column.id === 'unit' ? 0.12 : 0.146
    return Math.round(maxWidth * share)
  })
  const columnX = (index: number) => {
    let x = start
    for (let i = 0; i < index; i += 1) x += columnWidths[i]
    return x
  }
  const cellX = (index: number, align: 'start' | 'end') => (align === 'end' ? columnX(index) + columnWidths[index] : columnX(index))

  const tableHeader = () => {
    const size = Math.max(15, layout.baseSize - 9)
    const headerHeight = size + layout.rowPadding
    ops.push({ kind: 'rect', x: start, y: y - 4, w: maxWidth, h: headerHeight, color: layout.table === 'striped' ? '#f1f5f9' : '#f8fafc' })
    model.columns.forEach((column, index) => {
      ops.push({
        kind: 'text', x: cellX(index, column.align), y: y + 4, text: column.label, font: font(size, true), size,
        color: '#475569', align: model.rtl ? (column.align === 'end' ? 'end' : 'start') : column.align, dir: model.rtl ? 'rtl' : 'ltr',
      })
    })
    y += headerHeight + Math.round(layout.rowPadding / 2)
    if (layout.table === 'boxed') ops.push({ kind: 'line', x: start, y: y - Math.round(layout.rowPadding / 2) - 2, x2: end, y2: y - Math.round(layout.rowPadding / 2) - 2, color: '#cbd5e1', width: 2 })
  }

  const tableRow = (row: TableRow) => {
    const size = Math.max(15, layout.baseSize - 10)
    const lineHeight = Math.round(size * 1.35)
    // The description wraps; the row grows with it instead of clipping.
    const wrapped: string[] = []
    let buffer = ''
    for (const word of (row.cells[0] || '').split(/\s+/).filter(Boolean)) {
      const candidate = buffer ? `${buffer} ${word}` : word
      if (measure(candidate, font(size)) <= columnWidths[0] - 12) { buffer = candidate; continue }
      if (buffer) wrapped.push(buffer)
      buffer = word
    }
    wrapped.push(buffer)
    const sectionHeight = row.section ? lineHeight + 4 : 0
    const rowHeight = wrapped.length * lineHeight + layout.rowPadding + sectionHeight
    if (room(rowHeight)) newPage()
    if (row.section) {
      pushText(row.section, size, model.accent, 'start', y + 2, true)
      y += sectionHeight
    }
    if (layout.table === 'striped') ops.push({ kind: 'rect', x: start, y: y - 4, w: maxWidth, h: rowHeight - sectionHeight, color: '#f8fafc' })
    model.columns.forEach((column, index) => {
      const value = row.cells[index] ?? ''
      const lines = index === 0 ? wrapped : [value]
      lines.forEach((line, position) => {
        ops.push({
          kind: 'text', x: cellX(index, column.align), y: y + position * lineHeight, text: line, font: font(size), size,
          color: index === 0 ? '#0b1220' : '#334155',
          align: model.rtl ? (column.align === 'end' ? 'end' : 'start') : column.align,
          dir: model.rtl ? 'rtl' : 'ltr',
        })
      })
    })
    y += rowHeight - sectionHeight
    if (layout.table === 'hairline' || layout.table === 'boxed') ops.push({ kind: 'line', x: start, y: y - 2, x2: end, y2: y - 2, color: '#e2e8f0', width: 1.5 })
  }

  const totalsBlock = () => {
    const size = Math.max(15, layout.baseSize - 6)
    const lineHeight = Math.round(size * 1.6)
    const height = model.totals.length * lineHeight + layout.rowPadding * 2
    if (room(height)) newPage()
    if (layout.totals === 'inline') {
      pushText(model.totals.map(entry => `${entry.label}: ${entry.value}`).join('   ·   '), size, '#0b1220', 'start', y, true)
      y += lineHeight + layout.rowPadding
      return
    }
    const boxWidth = Math.min(470, maxWidth)
    const boxX = model.rtl ? start : end - boxWidth
    if (layout.totals !== 'stack') {
      ops.push({ kind: 'rect', x: boxX, y: y - layout.rowPadding, w: boxWidth, h: height, color: '#f8fafc' })
      ops.push({ kind: 'line', x: model.rtl ? boxX + boxWidth : boxX, y: y - layout.rowPadding, x2: model.rtl ? boxX + boxWidth : boxX, y2: y + height - layout.rowPadding, color: model.accent, width: 4 })
    }
    model.totals.forEach(entry => {
      const bold = entry.emphasis === true
      const stack = layout.totals === 'stack'
      const labelX = stack ? (model.rtl ? end : start) : boxX + 16
      const valueX = stack ? (model.rtl ? start : end) : boxX + boxWidth - 16
      ops.push({ kind: 'text', x: labelX, y, text: entry.label, font: font(size, bold), size, color: bold ? '#0b1220' : '#475569', align: model.rtl ? 'end' : 'start', dir: model.rtl ? 'rtl' : 'ltr' })
      ops.push({ kind: 'text', x: valueX, y, text: entry.value, font: font(size, bold), size, color: bold ? model.accent : '#0b1220', align: model.rtl ? 'start' : 'end', dir: 'ltr' })
      y += lineHeight
    })
    y += layout.rowPadding
  }

  // ---- first page ------------------------------------------------------------------
  startPage(false)

  const partySize = Math.max(16, layout.baseSize - 8)
  const partyLine = Math.round(partySize * 1.5)
  const party = (title: string, name: string, lines: string[], ids: Labelled[]) => {
    if (room(partyLine * (2 + lines.length + ids.length))) newPage()
    pushText(title, partySize, '#64748b', 'start', y, true)
    y += partyLine
    pushText(name, partySize + 4, '#0b1220', 'start', y, true)
    y += partyLine + 4
    for (const line of lines) { pushText(line, partySize, '#475569', 'start', y); y += partyLine }
    for (const id of ids) { pushText(`${id.label}: ${id.value ?? '—'}`, partySize, id.value ? '#475569' : '#b45309', 'start', y); y += partyLine }
    y += layout.rowPadding
  }
  party(tr('Seller'), model.businessName, model.businessLines, model.sellerIds)
  party(tr('Client'), model.customerName, model.customerLines, model.customerIds)

  for (const entry of model.meta) {
    if (room(partyLine)) newPage()
    pushText(`${entry.label}: ${entry.value}`, partySize, '#475569', 'start', y)
    y += partyLine
  }
  y += layout.rowPadding

  tableHeader()
  for (const row of model.rows) tableRow(row)

  // The exemption mention replaces the tax lines for the auto-entrepreneur preset.
  if (model.taxExempt) {
    if (room(partyLine * 2)) newPage()
    pushText(model.exemption, partySize, model.accent, 'start', y, true)
    y += partyLine
  }

  totalsBlock()

  if (model.stamp) {
    const size = 180
    if (room(size + layout.rowPadding)) newPage()
    ops.push({ kind: 'image', src: model.stamp, x: model.rtl ? start : end - size, y, w: size, h: size })
    y += size + layout.rowPadding
  }

  if (model.notes) { paragraph(`${model.notesLabel}:`, partySize, '#64748b', true); paragraph(model.notes, partySize, '#475569') }
  paragraph(`${model.termsLabel}: ${model.terms}`, Math.max(15, layout.baseSize - 10), '#64748b')
  if (model.footerNote) paragraph(model.footerNote, Math.max(15, layout.baseSize - 10), '#475569')

  drawFooter(model, layout, font, page, ops)
  return pages
}

/** Page footer: the layout decides the style, the content never changes. */
function drawFooter(model: DocumentModel, layout: LayoutSpec, font: (size: number, bold?: boolean) => string, page: number, ops: Op[]): void {
  const size = Math.max(14, layout.baseSize - 11)
  const margin = layout.margin
  const start = margin
  const end = PAGE_WIDTH - margin
  const y = PAGE_HEIGHT - margin + 8
  const text = (value: string, align: 'start' | 'end', color: string, boardY: number) => ops.push({
    kind: 'text', x: align === 'end' ? end : start, y: boardY, text: value, font: font(size), size, color,
    align: model.rtl ? (align === 'end' ? 'end' : 'start') : align, dir: model.rtl ? 'rtl' : 'ltr',
  })
  if (layout.footer === 'band') {
    ops.push({ kind: 'rect', x: 0, y: PAGE_HEIGHT - margin / 2, w: PAGE_WIDTH, h: margin / 2, color: model.accent })
    text(model.footer, 'start', model.accentInk, PAGE_HEIGHT - margin / 2 + 12)
    text(`${model.pageWord} ${page}`, 'end', model.accentInk, PAGE_HEIGHT - margin / 2 + 12)
    return
  }
  if (layout.footer === 'rule') ops.push({ kind: 'line', x: start, y: y - 12, x2: end, y2: y - 12, color: '#e2e8f0', width: 2 })
  if (layout.footer === 'none') { text(`${model.pageWord} ${page}`, 'end', '#94a3b8', y); return }
  text(model.footer, 'start', '#64748b', y)
  text(`${model.pageWord} ${page}`, 'end', '#64748b', y)
}

/** Top of the first page. Returns the y position the content starts at. */
function drawHeader(model: DocumentModel, layout: LayoutSpec, font: (size: number, bold?: boolean) => string, ops: Op[]): number {
  const start = layout.margin
  const end = PAGE_WIDTH - layout.margin
  const align = model.rtl ? 'end' as const : 'start' as const
  const opposite = model.rtl ? 'start' as const : 'end' as const
  const at = (side: 'start' | 'end') => (side === 'start' ? start : end)
  const line = (value: string, x: number, y: number, size: number, color: string, bold = false, side = align) => ops.push({
    kind: 'text', x, y, text: value, font: font(size, bold), size, color,
    align: model.rtl ? (side === 'end' ? 'end' : 'start') : side, dir: model.rtl ? 'rtl' : 'ltr',
  })
  const logo = model.logo
  const logoBox = logo ? 64 : 0
  const logoLeft = model.rtl ? end - logoBox : start
  const logoRight = model.rtl ? start : end - logoBox
  if (layout.header === 'band') {
    const bandHeight = 110
    ops.push({ kind: 'rect', x: 0, y: 0, w: PAGE_WIDTH, h: bandHeight, color: model.accent })
    // Classic keeps the app name in the band, exactly like the pre-template PDF.
    const size = layout.baseSize - 2
    ops.push({ kind: 'text', x: PAGE_WIDTH / 2, y: 34, text: model.appName, font: font(size, true), size, color: model.accentInk, align: 'center', dir: model.rtl ? 'rtl' : 'ltr' })
    line(`${model.title} ${model.number}`, at(opposite), 38, size, model.accentInk, false, opposite)
    if (logo && layout.logo !== 'none') ops.push({ kind: 'image', src: logo, x: layout.logo === 'end' ? logoRight : logoLeft, y: 22, w: logoBox, h: logoBox })
    return bandHeight + layout.rowPadding * 2
  }
  if (layout.header === 'stacked') {
    const titleSize = layout.baseSize + 10
    const size = layout.baseSize - 2
    line(model.title, at(align), 26, titleSize, model.accent, true)
    line(`${model.number} · ${model.businessName}`, at(align), 26 + titleSize + 12, size, '#334155')
    const blockWidth = 220
    ops.push({ kind: 'rect', x: model.rtl ? start : end - blockWidth, y: 26, w: blockWidth, h: 14, color: model.accent })
    if (logo) ops.push({ kind: 'image', src: logo, x: model.rtl ? start : end - 130, y: 50, w: 130, h: 130 })
    return Math.max(26 + titleSize + 12 + size + layout.rowPadding * 2, logo ? 50 + 130 + layout.rowPadding : 0)
  }
  if (layout.header === 'rule') {
    const size = layout.baseSize + 2
    line(model.businessName, at(align), 26, size, '#0b1220', true)
    line(`${model.title} ${model.number}`, at(opposite), 30, layout.baseSize - 4, model.accent, false, opposite)
    const y = 26 + size + 18
    ops.push({ kind: 'line', x: start, y, x2: end, y2: y, color: model.accent, width: 3 })
    return y + layout.rowPadding * 1.5
  }
  const size = layout.baseSize
  line(model.businessName, at(align), 20, size, '#0b1220', true)
  line(`${model.title} ${model.number}`, at(opposite), 22, size, model.accent, false, opposite)
  return 20 + size + layout.rowPadding
}

/** Draws one page of operations. Images are passed in already decoded. */
export function paintPage(ctx: PaintContext, page: DocumentPage, images: Map<string, CanvasImageSource> = new Map()): void {
  for (const op of page.ops) {
    if (op.kind === 'rect') { ctx.fillStyle = op.color; ctx.fillRect(op.x, op.y, op.w, op.h); continue }
    if (op.kind === 'line') {
      ctx.strokeStyle = op.color; ctx.lineWidth = op.width
      ctx.beginPath(); ctx.moveTo(op.x, op.y); ctx.lineTo(op.x2, op.y2); ctx.stroke(); continue
    }
    if (op.kind === 'image') {
      const image = images.get(op.src)
      if (image) ctx.drawImage(image, op.x, op.y, op.w, op.h)
      continue
    }
    ctx.direction = op.dir
    ctx.font = op.font
    ctx.fillStyle = op.color
    ctx.textAlign = op.align === 'center' ? 'center' : op.align === 'end' ? 'right' : 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(op.text, op.x, op.y)
  }
}

/** Every string the pages draw: the tests and "copy the text" both use it. */
export const pageText = (pages: DocumentPage[]): string =>
  pages.flatMap(page => page.ops.filter((op): op is TextOp => op.kind === 'text').map(op => op.text)).join('\n')

/** Word-based measure for environments without a canvas (tests, SSR). */
export const approximateMeasure: Measure = (value, font) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] || 16)
  return value.length * size * 0.52
}
