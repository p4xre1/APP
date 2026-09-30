import { getPreferences, type DisplayPreferences, type Language } from './preferences'

export function locale(language: Language = getPreferences().language) { return `${language}-u-nu-${getPreferences().digits}` }
export function number(value: number, language?: Language) { return new Intl.NumberFormat(locale(language)).format(value) }
export function decimals(currency: string) { return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits! }
/** Decimal text -> integer minor units using BigInt, round half away from zero. */
export function minorUnits(value: number | string, currency: string): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) throw new Error('Invalid amount')
  let text = String(value)
  if (/e/i.test(text)) text = numeric.toFixed(12)
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(text)
  if (!match) throw new Error('Invalid amount')
  const places = decimals(currency), fraction = (match[3] || '').padEnd(places+1, '0')
  let units = BigInt(match[2]) * 10n ** BigInt(places) + BigInt(fraction.slice(0, places) || '0')
  if (Number(fraction[places]) >= 5) units++
  if (match[1]) units = -units
  const result = Number(units)
  if (!Number.isSafeInteger(result)) throw new Error('Amount too large')
  return result
}
export const roundMoney = (amount: number, currency: string) => minorUnits(amount,currency) / 10 ** decimals(currency)
export function money(amount: number, currency = getPreferences().defaultCurrency, compact = false, language?: Language) {
  return new Intl.NumberFormat(locale(language), { style: 'currency', currency, notation: compact ? 'compact' : 'standard' }).format(roundMoney(amount, currency))
}
export function sumMoney(values: number[], currency: string) {
  const sum = values.reduce((result,value) => result + BigInt(minorUnits(value,currency)), 0n)
  if (!Number.isSafeInteger(Number(sum))) throw new Error('Amount too large')
  return Number(sum) / 10 ** decimals(currency)
}
export function formatDate(value: string | number, withTime = false, language?: Language, options: DisplayPreferences = getPreferences()): string {
  // Date-only fields are calendar dates, not instants: never shift them across time zones.
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(dateOnly ? value + 'T12:00:00Z' : value)
  if (Number.isNaN(date.getTime())) return '—'
  const lang = language ?? options.language
  const loc = `${lang}-u-nu-${options.digits}`
  const zone = dateOnly ? 'UTC' : options.timeZone
  const calendar = lang === 'ar' && options.hijri ? 'islamic-umalqura' : 'gregory'
  const formatter = new Intl.DateTimeFormat(loc, { timeZone: zone, calendar, year: 'numeric', month: '2-digit', day: '2-digit' })
  let result = formatter.format(date)
  if (options.dateFormat !== 'auto') {
    const parts = formatter.formatToParts(date)
    const get = (key: string) => parts.find(p => p.type === key)?.value || ''
    result = options.dateFormat.replace('YYYY', get('year')).replace('MM', get('month')).replace('DD', get('day'))
  }
  if (withTime && !dateOnly) result += ' ' + new Intl.DateTimeFormat(loc, { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: options.timeFormat === '12h' }).format(date)
  return result
}
export function localInput(timestamp = Date.now(), timeZone = getPreferences().timeZone) {
  const p = new Intl.DateTimeFormat('en-CA-u-nu-latn', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(timestamp)
  const get = (type: string) => p.find(v => v.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
/** Interpret datetime-local in the selected zone, not the WebView's zone. Reject DST gaps. */
export function inputToUTC(input: string, timeZone = getPreferences().timeZone): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) throw new Error('Invalid date or time')
  const target = Date.parse(input + ':00Z')
  let guess = target
  for (let i = 0; i < 4; i++) {
    const shown = Date.parse(localInput(guess, timeZone) + ':00Z')
    guess += target - shown
  }
  if (!Number.isFinite(guess) || localInput(guess,timeZone) !== input) throw new Error('Invalid date or time')
  return guess
}
export function weekDays() {
  const start = getPreferences().firstDay
  return Array.from({length:7}, (_,i) => new Intl.DateTimeFormat(locale(), { weekday:'short', timeZone:'UTC' }).format(Date.UTC(2026,0,4+(start+i)%7)))
}

/** One document line, quantized to the currency's minor unit. */
export function lineTotal(quantity: number, unitPrice: number, currency: string) {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) throw new Error('Invalid amount')
  return roundMoney(roundMoney(unitPrice, currency) * quantity, currency)
}
/**
 * Tax on a net amount, in the currency's minor units, half away from zero.
 * Rate is a percentage (e.g. 20 for 20%); negative or unset rates yield no tax.
 */
export function taxAmount(net: number, ratePercent: number | undefined, currency: string): number {
  const rate = Number(ratePercent)
  if (!Number.isFinite(rate) || rate <= 0) return 0
  if (rate > 1000) throw new Error('Invalid tax rate')
  const scaled = BigInt(minorUnits(net, currency)) * BigInt(Math.round(rate * 1_000_000))
  const divisor = 100n * 1_000_000n // rate percent (x1e6) over 100
  const negative = scaled < 0n, absolute = negative ? -scaled : scaled
  const units = Number((absolute * 2n + divisor) / (2n * divisor))
  if (!Number.isSafeInteger(units)) throw new Error('Amount too large')
  return (negative ? -units : units) / 10 ** decimals(currency)
}
/** Subtotal, tax and total for a set of lines, all in integer minor-unit arithmetic. */
export function documentTotals(lines: { quantity: number; unitPrice: number }[], ratePercent: number | undefined, currency: string) {
  const subtotal = sumMoney(lines.map(line => lineTotal(line.quantity, line.unitPrice, currency)), currency)
  const tax = taxAmount(subtotal, ratePercent, currency)
  return { subtotal, tax, total: sumMoney([subtotal, tax], currency) }
}
