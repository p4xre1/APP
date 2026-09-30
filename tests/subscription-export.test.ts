import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'
import { IDBFactory } from 'fake-indexeddb'
import { createOrChangePin, lockVault, unlockPin } from '../src/lib/vault'
import {
  buildSubscriptionExport, exportSubscriptionsPdf, exportSubscriptionsXlsx, subscriptionPdfTable, subscriptionSheet,
  subscriptionTotalsText, subscriptionXlsxBytes,
} from '../src/lib/subscription-export'
import { subscriptionSummary } from '../src/lib/subscriptions'
import type { Subscription } from '../src/store/types'

/** A real 1x1 PNG, so jsPDF can embed what the fake canvas "draws". */
const PNG_ONE_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const users: string[] = []
const blobs: Blob[] = []
const downloads: string[] = []

const fakeCtx = {
  fillStyle: '', font: '', textAlign: '', textBaseline: '', direction: '', lineWidth: 1,
  fillRect() {}, fillText() {}, strokeRect() {}, stroke() {}, save() {}, restore() {}, beginPath() {}, clip() {},
  measureText: (text: string) => ({ width: text.length * 9 }),
}
const fakeCanvas = { width: 0, height: 0, getContext: () => fakeCtx, toDataURL: () => `data:image/png;base64,${PNG_ONE_PIXEL}` }

// shareFile revokes the download URL after a minute; without this the test process waits it out.
const realSetTimeout = globalThis.setTimeout
globalThis.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => realSetTimeout(handler, delay && delay > 1000 ? 0 : delay, ...args)) as typeof setTimeout

beforeEach(() => {
  lockVault()
  globalThis.indexedDB = new IDBFactory()
  users.length = 0
  blobs.length = 0
  downloads.length = 0
  ;(globalThis as unknown as { document: unknown }).document = {
    fonts: { load: async () => [] },
    createElement: (tag: string) => (tag === 'canvas' ? { ...fakeCanvas } : { href: '', download: '', click() {}, remove() {} }),
    body: { appendChild() {} },
  }
  const anchorElement = { href: '', download: '', click() {}, remove() {} }
  ;(globalThis as unknown as { document: { createElement: (tag: string) => unknown } }).document.createElement = (tag: string) => {
    const element = tag === 'canvas' ? { ...fakeCanvas } : { ...anchorElement }
    if (tag === 'a') Object.defineProperty(element, 'download', { set: (value: string) => downloads.push(value), get: () => downloads[downloads.length - 1] })
    return element
  }
  // Only the two static helpers are replaced; the URL class itself must stay intact for the loader.
  Object.defineProperty(URL, 'createObjectURL', { value: (blob: Blob) => { blobs.push(blob); return `blob:test-${blobs.length}` }, configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true, writable: true })
})

const sub = (patch: Partial<Subscription> = {}): Subscription => ({
  id: 'sub-1', serviceName: 'Netflix', category: 'Media', amountMinor: 12000, currency: 'USD', billingCycle: 'monthly',
  autoRenew: true, startDate: '2026-10-20', paymentMethod: 'Card', notes: 'Family plan', createdAt: 1, updatedAt: 1, ...patch,
})
const now = Date.parse('2026-10-01T12:00:00Z')
const options = { now, timeZone: 'UTC', warn: 7, language: 'en' as const }

const rows: Subscription[] = [
  sub({ id: 'a', serviceName: 'Netflix', currency: 'USD', amountMinor: 12000, startDate: '2026-10-20' }),
  sub({ id: 'b', serviceName: 'Hosting', currency: 'USD', amountMinor: 120000, billingCycle: 'yearly', autoRenew: true, startDate: '2026-10-05', category: '', paymentMethod: '', notes: '' }),
  sub({ id: 'c', serviceName: 'Rent', currency: 'MAD', amountMinor: 300000, startDate: '2026-11-01' }),
  sub({ id: 'd', serviceName: 'Old licence', currency: 'MAD', amountMinor: 9900, billingCycle: 'one_time_period', periodMonths: 1, autoRenew: false, startDate: '2026-01-10', notes: '' }),
]

/** Minimal ZIP reader: enough for the entry names and the sheet XML of an xlsx. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const files = new Map<string, string>()
  for (let offset = 0; offset + 4 <= bytes.length; offset++) {
    if (view.getUint32(offset, true) !== 0x04034b50) continue
    const method = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength))
    const start = offset + 30 + nameLength + extraLength
    const data = bytes.subarray(start, start + compressedSize)
    files.set(name, new TextDecoder().decode(method === 0 ? data : inflateRawSync(data)))
    offset = start + compressedSize - 1
  }
  return files
}

test('rows carry every column the spec asks for and follow the list order', () => {
  const fill = buildSubscriptionExport(rows, options)
  assert.equal(fill.rows.length, 4)
  // overdue first, then the soonest renewals, cancelled/expired last
  assert.deepEqual(fill.rows.map(row => row.service), ['Old licence', 'Hosting', 'Netflix', 'Rent'])
  const netflix = fill.rows.find(row => row.service === 'Netflix')!
  assert.deepEqual(Object.keys(netflix), [
    'service', 'category', 'amount', 'amountText', 'currency', 'cycle', 'autoRenew', 'startDate', 'targetDate', 'status', 'paymentMethod', 'notes', 'cancelled',
  ])
  assert.equal(netflix.amount, 120)
  assert.equal(netflix.cycle, 'monthly')
  assert.equal(netflix.autoRenew, 'Yes')
  assert.equal(netflix.status, 'active')
  assert.equal(netflix.paymentMethod, 'Card')
  assert.equal(netflix.targetDate, '2026-10-20')
  assert.equal(fill.rows.find(row => row.service === 'Hosting')!.autoRenew, 'Yes')
  const old = fill.rows.find(row => row.service === 'Old licence')!
  assert.equal(old.autoRenew, 'No')
  assert.equal(old.status, 'expired')
})

test('totals stay per currency in the sheet, the text lines and the PDF table', () => {
  const fill = buildSubscriptionExport(rows, options)
  const sheet = subscriptionSheet(fill, 'en')
  assert.equal(sheet[0].length, 11)
  assert.deepEqual(sheet[0], ['Service', 'Category', 'Amount', 'Currency', 'Cycle', 'Auto-renew', 'Start date', 'Next renewal / end', 'Status', 'Payment method', 'Notes'])
  assert.equal(sheet.length, 1 + 4 + 1 + 2)
  assert.deepEqual(sheet[5], [])
  const totalRows = sheet.slice(6)
  assert.deepEqual(totalRows.map(row => row[3]), ['MAD', 'USD'])
  assert.equal(totalRows.every(row => String(row[0]).startsWith('Total (')), true)

  const text = subscriptionTotalsText(subscriptionSummary(rows, options), 'en')
  assert.equal(text.length, 2)
  assert.match(text[0], /^MAD: .*per month.*per year$/)
  assert.match(text[1], /^USD: .*per month.*per year$/)
  assert.ok(!text.some(line => line.includes('MAD') && line.includes('USD')))
  // MAD 3,000/month must never be added to USD 220/month.
  assert.match(text[0], /3,000\.00 per month/)
  assert.match(text[0], /36,000\.00 per year/)
  assert.match(text[1], /220/)

  const table = subscriptionPdfTable(fill, 'en', now)
  assert.equal(table.title, 'Subscriptions')
  assert.equal(table.headers.length, 8)
  assert.deepEqual(table.headers, ['Service', 'Category', 'Amount', 'Cycle', 'Auto-renew', 'Start date', 'Next renewal / end', 'Status'])
  assert.equal(table.rows.length, 4)
  assert.equal(table.rows[0][7], 'expired')
  assert.deepEqual(table.totals, text)
  assert.deepEqual(table.details, ['Old licence: Card', 'Netflix: Card · Family plan', 'Rent: Card · Family plan'])
  assert.equal(table.notice, 'Exported files are not encrypted. Delete them when you are done.')
})

test('the xlsx is a real spreadsheet with the records and one totals row per currency', async () => {
  const bytes = await subscriptionXlsxBytes(buildSubscriptionExport(rows, options), 'en')
  assert.equal(bytes[0], 0x50) // P
  assert.equal(bytes[1], 0x4b) // K
  assert.ok(bytes.length > 2000)
  const files = unzip(bytes)
  const sheet = files.get('xl/worksheets/sheet1.xml')!
  const shared = files.get('xl/sharedStrings.xml')!
  for (const value of ['Netflix', 'Hosting', 'Rent', 'Old licence', '2026-10-20', 'Card', 'Family plan']) assert.ok(shared.includes(`<t>${value}</t>`), `sheet is missing ${value}`)
  // Amounts are real numbers, not text, so Excel can sum them.
  assert.ok(sheet.includes('<v>120</v>'))
  assert.ok(sheet.includes('<v>1200</v>'))
  // One totals row per currency, and never a mixed-currency sum.
  assert.ok(shared.includes('<t>Total (MAD)</t>'))
  assert.ok(shared.includes('<t>Total (USD)</t>'))
  assert.equal((shared.match(/Total \(/g) || []).length, 2)
  assert.ok(shared.includes('<t>per month</t>'))
  assert.equal((shared.match(/per year/g) || []).length, 2)
  assert.equal((sheet.match(/<row /g) || []).length, 8) // header + 4 records + blank + 2 totals
  assert.ok(files.get('xl/workbook.xml')!.includes('Subscriptions'))
})

test('exporting an unlocked vault produces a dated xlsx and pdf, and a locked one refuses', async () => {
  await assert.rejects(() => exportSubscriptionsXlsx(rows, options), /locked/)
  await assert.rejects(() => exportSubscriptionsPdf(rows, options), /locked/)
  await createOrChangePin('123456')
  await exportSubscriptionsXlsx(rows, options)
  await exportSubscriptionsPdf(rows, options)
  assert.equal(blobs.length, 2)
  const day = new Date().toISOString().slice(0, 10)
  assert.deepEqual(downloads, [`fatorati-subscriptions-${day}.xlsx`, `fatorati-subscriptions-${day}.pdf`])

  const xlsx = new Uint8Array(await blobs[0].arrayBuffer())
  assert.deepEqual([xlsx[0], xlsx[1]], [0x50, 0x4b])
  assert.ok(unzip(xlsx).has('xl/worksheets/sheet1.xml'))

  const pdf = new Uint8Array(await blobs[1].arrayBuffer())
  const text = new TextDecoder('latin1').decode(pdf)
  assert.match(text.slice(0, 8), /^%PDF-1\./)
  assert.match(text.slice(-32), /%%EOF/)
  assert.ok(pdf.length > 1500)
  assert.ok(text.includes('/Subtype /Image'))
  assert.match(text, /\/MediaBox \[0 0 841\.8\d* 595\.2\d*\]/) // landscape A4
  assert.equal((text.match(/\/Type \/Page[^s]/g) || []).length, 1)

  // A second page appears once the table runs past the sheet.
  blobs.length = 0
  const many = Array.from({ length: 60 }, (_, index) => sub({ id: `sub-${index}`, serviceName: `Service ${index}`, notes: `Note ${index}` }))
  await exportSubscriptionsPdf(many, options)
  const multi = new TextDecoder('latin1').decode(new Uint8Array(await blobs[0].arrayBuffer()))
  assert.ok((multi.match(/\/Type \/Page[^s]/g) || []).length > 1)

  // The vault session is checked again after every async gap.
  lockVault()
  await assert.rejects(() => exportSubscriptionsXlsx(rows, options), /locked/)
  await unlockPin('123456')
  await exportSubscriptionsXlsx(rows, options)
  assert.equal(blobs.length, 2)
})
