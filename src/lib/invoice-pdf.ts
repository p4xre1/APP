import { t } from '../i18n'
import { getPreferences, accentText } from './preferences'
import { number, formatDate } from './format'
import { sessionGuard } from './vault'
import type { Business, Customer, Invoice, Estimate } from '../store/types'
import { money } from './fatorati'
import type { Currency } from './fatorati'
import { shareFile } from './share-file'

/** Render using bundled Inter/Tajawal fonts; no remote font download is needed. */
export async function shareInvoicePdf(invoice: Invoice | Estimate, business: Business | null, customer?: Customer, currency: Currency = invoice.currency || getPreferences().defaultCurrency): Promise<void> {
  const guard = sessionGuard(), prefs=getPreferences(), language=invoice.language||prefs.language
  const tr = (key:string) => t(key,{},language)
  const useColor = invoice.pdfColor ?? prefs.pdfColor
  const fontFamily=language==='ar'?'Tajawal':'Inter'
  await document.fonts.load(`28px "${fontFamily}"`)
  guard()
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ compress: true })
  const canvas = document.createElement('canvas')
  canvas.width = 1240; canvas.height = 1754
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('PDF rendering is unavailable on this device.')
  const margin = 80, lineHeight = 42
  let y = margin, page = 0
  const reset = () => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = useColor ? prefs.accent : '#111111'; ctx.fillRect(0,0,canvas.width,60)
    ctx.fillStyle = useColor ? accentText(prefs.accent) : '#ffffff'; ctx.font=`24px ${fontFamily}`; ctx.textAlign='center'; ctx.fillText(tr('Fatorati'),canvas.width/2,38)
    ctx.fillStyle = '#111827'; ctx.font = `28px ${fontFamily}`; ctx.textBaseline = 'top'
    y = margin
  }
  const flush = () => {
    if (page++) pdf.addPage()
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST')
  }
  const line = (text: string) => {
    if (y + lineHeight > canvas.height - margin) { flush(); reset() }
    const rtl = language === 'ar'
    ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left'
    ctx.fillText(text, rtl ? canvas.width - margin : margin, y)
    y += lineHeight
  }
  reset()
  const content = [
    `${tr('expiryDate' in invoice ? 'Estimate' : 'Invoice')} ${invoice.number}`, '',
    business?.name || tr('Your Business'), business?.ownerName || '',
    `${business?.address || ''} ${business?.city || ''}`,
    `${business?.phone || ''} ${business?.email || ''}`, '',
    tr('Customer'), customer?.name || invoice.customerId,
    `${customer?.address || ''} ${customer?.city || ''}`,
    `${customer?.email || ''} ${customer?.phone || ''}`, '',
    `${tr('Date and time')}: ${formatDate(invoice.occurredAt||invoice.createdAt,true,language)}`,
    `${tr('Issue date')}: ${formatDate(invoice.issueDate,false,language)}`,
    `${tr('expiryDate' in invoice?'Expiry date':'Due date')}: ${formatDate('expiryDate' in invoice?invoice.expiryDate:invoice.dueDate,false,language)}`,
    `${tr('Status')}: ${tr(invoice.status)}`, '', tr('Items'),
    ...invoice.items.flatMap(item => [item.description, `${number(item.quantity,language)} × ${money(item.unitPrice,currency,false,language)} = ${money(item.total,currency,false,language)}`, '']),
    `${tr('Subtotal')}: ${money(invoice.subtotal,currency,false,language)}`, `${tr('Tax')}: ${money(invoice.tax,currency,false,language)}`,
    `${tr('Total')}: ${money(invoice.total,currency,false,language)}`, '', tr('Notes'), invoice.notes,
  ].join('\n')
  // Wrap long descriptions/notes and add pages instead of clipping invoices.
  for (const paragraph of content.split(/\r?\n/)) {
    let buffer = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = buffer ? `${buffer} ${word}` : word
      if (ctx.measureText(candidate).width <= canvas.width - 2 * margin) { buffer = candidate; continue }
      if (buffer) line(buffer)
      buffer = ''
      for (const character of word) {
        if (ctx.measureText(buffer + character).width > canvas.width - 2 * margin) { line(buffer); buffer = '' }
        buffer += character
      }
    }
    line(buffer)
  }
  flush()
  guard()
  await shareFile(`${invoice.number}.pdf`, new Uint8Array(pdf.output('arraybuffer')), 'application/pdf')
}
