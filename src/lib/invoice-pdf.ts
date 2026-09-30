import { t } from '../i18n'
import { getPreferences } from './preferences'
import { sessionGuard } from './vault'
import { documentTemplate } from './templates'
import { settingsRegion } from './taxGuide'
import { buildDocumentModel, layoutDocument, paintPage, PAGE_HEIGHT, PAGE_WIDTH, type Measure, type PaintContext } from './template-render'
import { shareFile } from './share-file'
import type { Currency } from './fatorati'
import type { Business, Customer, Estimate, Invoice, Settings } from '../store/types'

const INK = '#0b1220'

/** Decodes a data URL once per document; a broken image never stops the PDF. */
async function decodeImage(src: string): Promise<CanvasImageSource | null> {
  try {
    const image = new Image()
    image.src = src
    await image.decode()
    return image
  } catch { return null }
}

/**
 * Renders a document to PDF bytes with the existing pipeline: the template model is
 * painted onto a canvas page, each page becomes a PNG inside jsPDF. Fonts are the
 * bundled Inter/Tajawal files - nothing is downloaded.
 */
export async function buildInvoicePdf(
  doc: Invoice | Estimate,
  business: Business | null,
  customer?: Customer,
  currency: Currency = doc.currency || getPreferences().defaultCurrency,
  settings?: Settings | null,
): Promise<Uint8Array<ArrayBuffer>> {
  const guard = sessionGuard(), prefs = getPreferences()
  const language = doc.language || prefs.language
  const region = settingsRegion(settings)
  const template = documentTemplate(doc.template, region)
  const model = buildDocumentModel({
    kind: 'expiryDate' in doc ? 'estimate' : (doc as Invoice).kind === 'credit_note' ? 'credit_note' : 'invoice',
    document: doc, business, customer, region, currency, language, template,
    appAccent: prefs.pdfColor ? prefs.accent : INK,
  })

  const fontFamily = language === 'ar' ? 'Tajawal' : 'Inter'
  await document.fonts.load(`28px "${fontFamily}"`)
  guard()

  const canvas = document.createElement('canvas')
  canvas.width = PAGE_WIDTH
  canvas.height = PAGE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('PDF rendering is unavailable on this device.')
  const measure: Measure = (value, font) => { ctx.font = font; return ctx.measureText(value).width }
  const pages = layoutDocument(model, { measure })

  const images = new Map<string, CanvasImageSource>()
  for (const op of pages.flatMap(page => page.ops)) {
    if (op.kind !== 'image' || images.has(op.src)) continue
    const decoded = await decodeImage(op.src)
    if (decoded) images.set(op.src, decoded)
  }
  guard()

  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ compress: true })
  pages.forEach((page, index) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    paintPage(ctx as unknown as PaintContext, page, images)
    if (index) pdf.addPage()
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST')
  })
  return new Uint8Array(pdf.output('arraybuffer'))
}

/** Renders and hands the file to Android's share sheet; unchanged public entry. */
export async function shareInvoicePdf(
  doc: Invoice | Estimate,
  business: Business | null,
  customer?: Customer,
  currency: Currency = doc.currency || getPreferences().defaultCurrency,
  settings?: Settings | null,
): Promise<void> {
  const guard = sessionGuard()
  const bytes = await buildInvoicePdf(doc, business, customer, currency, settings)
  guard()
  await shareFile(`${doc.number}.pdf`, bytes, 'application/pdf')
}

/** Key of the sample payment method the picker preview shows. */
export const SAMPLE_PAYMENT_METHOD = 'Bank transfer'
