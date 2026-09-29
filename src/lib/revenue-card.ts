import { t } from '../i18n'
import { money, number as formatNumber } from './format'
import { getPreferences, accentText } from './preferences'
import type { Language } from './preferences'
import type { RevenueCardData } from './revenue-period'
import { shareFile } from './share-file'

export interface RevenueCardOptions {
  accent?: string
  logo?: string
  language?: Language
  digits?: 'latn' | 'arab'
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); return }
  ctx.beginPath(); ctx.rect(x, y, width, height)
}

async function drawLogo(ctx: CanvasRenderingContext2D, source: string, x: number, y: number, size: number) {
  const image = new Image()
  image.src = source
  try { await image.decode() } catch { return false }
  const ratio = image.width && image.height ? Math.min(size / image.width, size / image.height) : 1
  const width = image.width * ratio, height = image.height * ratio
  ctx.save()
  rounded(ctx, x, y, size, size, size / 6); ctx.clip()
  ctx.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height)
  ctx.restore()
  return true
}

/**
 * Portrait PNG card with the period, revenue, invoice count and the business name/logo.
 * Drawn locally with the bundled fonts; nothing is uploaded. Arabic is laid out right-to-left.
 */
export async function revenueCardPng(data: RevenueCardData, options: RevenueCardOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  const prefs = getPreferences()
  const language = options.language || prefs.language
  const digits = options.digits || prefs.digits
  const rtl = language === 'ar'
  const accent = options.accent || prefs.accent
  const tr = (key: string, params: Record<string, string | number> = {}) => t(key, params, language)
  const fontFamily = rtl ? 'Tajawal' : 'Inter'
  try { await document.fonts.load(`64px "${fontFamily}"`) } catch { /* System fallback. */ }

  const canvas = document.createElement('canvas')
  canvas.width = 1080; canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image rendering is unavailable on this device.')
  const margin = 72
  const align = (x: number) => rtl ? canvas.width - x : x
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)

  const header = 340
  ctx.fillStyle = accent; ctx.fillRect(0, 0, canvas.width, header)
  ctx.fillStyle = accentText(accent)
  ctx.font = `600 40px "${fontFamily}"`
  let textLeft = margin
  let logoDrawn = false
  if (options.logo) logoDrawn = await drawLogo(ctx, options.logo, rtl ? canvas.width - margin - 120 : margin, 48, 120)
  if (logoDrawn) textLeft = rtl ? canvas.width - margin - 144 : margin + 144
  ctx.textAlign = rtl ? 'right' : 'left'
  ctx.font = `700 46px "${fontFamily}"`
  ctx.fillText(data.businessName || tr('Your Business'), align(textLeft), 66)
  ctx.font = `400 30px "${fontFamily}"`
  ctx.fillText(`${tr('Revenue card')} · ${data.periodLabel}`, align(textLeft), 132)
  ctx.font = `800 96px "${fontFamily}"`
  ctx.fillText(money(data.total, data.currency, false, language), align(margin), 196)

  const bodyTop = header + 84
  ctx.textAlign = rtl ? 'right' : 'left'
  const rows: { label: string; value: string }[] = [
    { label: tr('Total Revenue (Paid)'), value: money(data.total, data.currency, false, language) },
    { label: tr('Paid invoices'), value: formatNumber(data.invoiceCount, language) },
    { label: tr('Pending Revenue'), value: money(data.pending, data.currency, false, language) },
    { label: tr('Period'), value: data.periodLabel },
  ]
  ctx.font = `600 30px "${fontFamily}"`
  ctx.fillStyle = '#64748b'
  rows.forEach((row, index) => {
    const y = bodyTop + index * 150
    ctx.fillStyle = '#f4f6f9'
    rounded(ctx, margin - 24, y - 24, canvas.width - 2 * (margin - 24), 118, 20); ctx.fill()
    ctx.fillStyle = '#64748b'; ctx.font = `600 28px "${fontFamily}"`
    ctx.fillText(row.label, align(margin), y + 4)
    ctx.fillStyle = '#0b1220'; ctx.font = `700 44px "${fontFamily}"`
    ctx.fillText(row.value, align(margin), y + 44)
  })
  const footerY = canvas.height - 120
  ctx.fillStyle = accent; ctx.fillRect(0, canvas.height - 24, canvas.width, 24)
  ctx.fillStyle = '#94a3b8'; ctx.font = `500 26px "${fontFamily}"`
  ctx.fillText(tr('Fatorati • 100% Local • Offline'), align(margin), footerY)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Image rendering is unavailable on this device.')
  return new Uint8Array(await blob.arrayBuffer())
}

export async function shareRevenueCard(data: RevenueCardData, options: RevenueCardOptions = {}): Promise<void> {
  const bytes = await revenueCardPng(data, options)
  const name = `fatorati-${data.currency}-${data.periodLabel.replace(/[^a-zA-Z0-9]+/g, '-')}.png`
  await shareFile(name, bytes, 'image/png')
}
