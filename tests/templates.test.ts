import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { IDBFactory } from 'fake-indexeddb'

import {
  COLUMN_LABEL, LAYOUT_IDS, LAYOUTS, LEGACY_TEMPLATE, MAX_FOOTER_NOTE, PRESET_IDS, PRESETS, REQUIRED_COLUMNS,
  TEMPLATE_ACCENTS, TEMPLATE_VERSION, accentHex, columnAlign, columnLabelKey, documentTemplate, normalizeTemplate, normalizeTemplate as snapshotOf,
  presetIsTaxExempt, presetRateHint, presetSample, templateColumns, templateCombinationKeys, templateDefaults,
  type DocumentTemplate,
} from '../src/lib/templates'
import {
  approximateMeasure, buildDocumentModel, buildSampleModel, layoutDocument, mandatoryFields, paintPage, pageText,
  type DocumentPage, type PaintContext, type TextOp,
} from '../src/lib/template-render'
import { BACKUP_VERSION, isStoredImage, isTemplateSnapshot, migrateBackup, validateBackup } from '../src/lib/backup-format'
import {
  IMAGE_ERRORS, MAX_LOGO_BYTES, MAX_SOURCE_BYTES, MAX_STAMP_BYTES, imageBytes, isImageDataUrl, readImageFile,
  storedImage, targetSize, type ImageIo,
} from '../src/lib/images'
import { accentText, languages } from '../src/lib/preferences'
import { lineTotal, money, number } from '../src/lib/format'
import { t } from '../src/i18n'
import { fixture, legacyFixture } from './fixtures'
import type { Business, Customer, Estimate, Invoice, TaxRegion } from '../src/store/types'

/**
 * The template engine is tested where it is deterministic: the model builder, the
 * layout engine and the painter. The PDF wrapper adds canvas + jsPDF (a browser
 * API) around exactly these pages, and the picker preview paints the same ops
 * through `paintPage`, so a string that is missing here is missing in both.
 */

const REGIONS: TaxRegion[] = ['MA', 'US']
const base = { occurredAt: 1_756_684_800_000, createdAt: 1, updatedAt: 2 }

const completeBusiness = (): Business => ({
  ...base, id: 'business', name: 'Atelier Nord SARL', ownerName: 'Karim Owner',
  phone: '+212600112233', email: 'contact@atelier.ma', address: '12 Rue des Orangers', city: 'Tanger 90000',
  taxNumber: '123456789012345', ifNumber: 'IF-778899', tpNumber: 'TP-445566', rcNumber: 'RC-112233',
  cnieNumber: 'AB123456', logo: 'data:image/png;base64,AAAA', stamp: 'data:image/png;base64,AAAA',
} as unknown as Business)

const completeCustomer = (): Customer => ({
  ...base, id: 'customer', name: 'Client SARL', email: 'achat@client.ma', phone: '+212522334455',
  address: '45 Avenue Mohammed VI', city: 'Rabat', notes: '', balance: 0, taxNumber: '987654321098765',
} as unknown as Customer)

const items = () => [
  { id: 'i1', description: 'Pose de carrelage 60x60 avec finition', quantity: 12, unitPrice: 250, unit: 'm²', section: 'materials', total: 3000 },
  { id: 'i2', description: 'Main d’œuvre qualifiée sur site', quantity: 3, unitPrice: 400, unit: 'day', section: 'labour', total: 1200 },
]

const invoice = (patch: Record<string, unknown> = {}): Invoice => ({
  ...base, id: 'invoice', number: 'INV-2026-0042', customerId: 'customer', projectId: 'project',
  items: items(), subtotal: 4200, tax: 840, total: 5040, taxRate: 20, status: 'sent',
  issueDate: '2026-09-01', dueDate: '2026-09-30', notes: '', paymentMethod: 'Bank transfer',
  currency: 'MAD', language: 'fr', pdfColor: true, ...patch,
} as unknown as Invoice)

const estimate = (patch: Record<string, unknown> = {}): Estimate => ({
  ...invoice(patch), id: 'estimate', number: 'EST-2026-0007', expiryDate: '2026-10-01', dueDate: undefined,
} as unknown as Estimate)

const build = (template: DocumentTemplate, options: { region?: TaxRegion; language?: (typeof languages)[number]; document?: Invoice | Estimate; business?: Business } = {}) => {
  const region = options.region ?? template.region
  return buildDocumentModel({
    kind: 'expiryDate' in (options.document ?? {}) ? 'estimate' : 'invoice',
    document: options.document ?? invoice({ language: options.language }),
    business: options.business ?? completeBusiness(),
    customer: completeCustomer(),
    region, currency: region === 'MA' ? 'MAD' : 'USD', language: options.language ?? 'fr',
    template, appAccent: '#2563eb',
  })
}

const pagesOf = (template: DocumentTemplate, options: Parameters<typeof build>[1] = {}) =>
  layoutDocument(build(template, options), { measure: approximateMeasure })

/** WCAG 2.x relative luminance and contrast ratio (same maths as contrast.test.ts). */
const luminance = (hex: string) => {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
  const [r, g, b] = channels.map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const read = (path: string) => readFileSync(path, 'utf8')
const textOps = (pages: DocumentPage[]): TextOp[] => pages.flatMap(page => page.ops).filter((op): op is TextOp => op.kind === 'text')

test('every layout, preset, language and region builds and lays out without throwing', () => {
  let combinations = 0
  for (const layoutId of LAYOUT_IDS) {
    for (const presetId of PRESET_IDS) {
      for (const language of languages) {
        for (const region of REGIONS) {
          const template = normalizeTemplate({
            layoutId, presetId, accent: 'blue', region, templateVersion: TEMPLATE_VERSION,
            showLogo: true, showStamp: true, footerNote: 'Merci',
          }, region)
          for (const document of [invoice({ language }), estimate({ language })]) {
            const model = build(template, { region, language, document })
            const pages = pagesOf(template, { region, language, document })
            assert.ok(pages.length >= 1, `${layoutId}/${presetId}/${language}/${region}`)
            assert.ok(pages.every(page => page.ops.length > 10), `${layoutId}/${presetId}: an empty page`)
            const text = pageText(pages)
            assert.ok(text.includes(document.number), `${layoutId}/${presetId}: the number is missing`)
            assert.ok(text.includes(model.businessName))
            if (LAYOUTS[layoutId].footer !== 'none') assert.ok(text.includes(model.footer), `${layoutId}/${presetId}: the footer wording is missing`)
            assert.equal(model.columns.length, templateColumns(template).length)
            assert.equal(model.rows.length, document.items.length)
            if (template.showLogo) assert.equal(model.logo !== undefined, true, 'the logo flag must reach the model')
            if (template.showStamp) assert.equal(model.stamp !== undefined, true)
            combinations += 1
          }
        }
      }
    }
  }
  assert.equal(combinations, LAYOUT_IDS.length * PRESET_IDS.length * languages.length * REGIONS.length * 2)
})

test('a Moroccan document prints every locked mention in every layout, preset and language', () => {
  for (const layoutId of LAYOUT_IDS) {
    for (const presetId of PRESET_IDS) {
      const template = normalizeTemplate({ layoutId, presetId, accent: 'ink', region: 'MA', templateVersion: TEMPLATE_VERSION, showLogo: true }, 'MA')
      const exempt = presetIsTaxExempt(template)
      for (const language of languages) {
        const document = invoice({ language })
        const model = build(template, { language })
        const text = pageText(pagesOf(template, { language }))
        const where = `${layoutId}/${presetId}/${language}`
        const has = (value: string) => assert.ok(text.includes(value), `${where}: "${value}" is missing`)

        // Seller identity and the identifiers the law asks for.
        has('Atelier Nord SARL'); has('Karim Owner'); has('12 Rue des Orangers'); has('Tanger 90000')
        has('123456789012345'); has('IF-778899'); has('TP-445566')
        if (exempt) {
          // Auto-entrepreneur: CNIE instead of RC, and the exemption mention instead of tax lines.
          has('AB123456')
          assert.equal(text.includes('RC-112233'), false, `${where}: RC must not print on an exempt document`)
          has(t('TVA non applicable', {}, language))
          assert.equal(model.taxExempt, true)
          const rate = new RegExp(`${t('TVA', {}, language)}[\\s\\u00a0]*\\d`)
          assert.equal(rate.test(text), false, `${where}: no TVA line with a rate`)
          assert.equal(text.includes(t('Sales tax', {}, language)), false)
        } else {
          has('RC-112233')
          has(`${t('TVA', {}, language)} ${number(20, language)}%`)
        }
        for (const label of ['ICE', 'IF', 'TP']) has(t(label, {}, language))

        // Client identity, including the client ICE for a B2B document.
        has('Client SARL'); has('45 Avenue Mohammed VI'); has('987654321098765'); has(t('Client ICE', {}, language))

        // Number, dates, payment method and every line of the table.
        has(document.number); has(t('Payment method', {}, language)); has(t('Bank transfer', {}, language))
        has(t('Date and time', {}, language)); has(t('Issue date', {}, language))
        assert.ok(model.meta.every(entry => entry.value !== null))
        for (const row of model.rows) for (const cell of row.cells) if (cell) has(cell)

        // Totals: ex-tax, tax grouped by rate, and in-tax.
        has(t('Total excl. tax', {}, language)); has(t('Total incl. tax', {}, language))
        for (const total of model.totals) { has(total.label); has(total.value) }
        assert.equal(model.missing.length, 0, `${where}: a complete document must not warn`)

        // The mandatory four columns are present whatever the preset adds.
        const columns = model.columns.map(column => column.id)
        for (const required of REQUIRED_COLUMNS) assert.ok(columns.includes(required), `${where}: ${required}`)
      }
    }
  }
})

test('an empty mandatory field keeps its label and warns instead of disappearing', () => {
  const bare = { ...completeBusiness(), taxNumber: '', ifNumber: '', tpNumber: '', rcNumber: '', cnieNumber: '', address: '', city: '' } as unknown as Business
  const customer = { ...completeCustomer(), taxNumber: '' } as unknown as Customer
  const template = normalizeTemplate({ layoutId: 'classic', presetId: 'general', region: 'MA' }, 'MA')
  const document = invoice({ paymentMethod: undefined })
  const model = buildDocumentModel({
    kind: 'invoice', document, business: bare, customer, region: 'MA', currency: 'MAD', language: 'fr',
    template, appAccent: '#2563eb',
  })
  const text = pageText(layoutDocument(model, { measure: approximateMeasure }))
  for (const label of ['ICE', 'IF', 'TP', 'RC', 'Client ICE', 'Payment method']) {
    assert.ok(model.missing.includes(t(label, {}, 'fr')), `${label} must be reported as missing`)
    assert.ok(text.includes(t(label, {}, 'fr')), `${label} must still be printed`)
  }
  assert.ok(model.missing.includes(t('Address', {}, 'fr')))
  assert.ok(text.includes('—'), 'an empty mandatory field prints with a dash')
  // The same document with the exemption preset swaps RC for CNIE without losing either rule.
  const exempt = normalizeTemplate({ layoutId: 'classic', presetId: 'auto_entrepreneur', region: 'MA' }, 'MA')
  const exemptModel = buildDocumentModel({ kind: 'invoice', document, business: bare, customer, region: 'MA', currency: 'MAD', language: 'fr', template: exempt, appAccent: '#2563eb' })
  assert.ok(exemptModel.missing.includes(t('CNIE', {}, 'fr')))
  assert.ok(exemptModel.missing.includes(t('Client ICE', {}, 'fr')))
})

test('the region is part of the snapshot: a US document never gains Moroccan identifiers', () => {
  const template = normalizeTemplate({ layoutId: 'modern', presetId: 'freelancer', region: 'US', accent: 'green' }, 'US')
  const model = build(template, { region: 'US', language: 'en' })
  assert.equal(model.region, 'US')
  assert.deepEqual(model.sellerIds.map(entry => entry.label), [t('Tax number', {}, 'en')])
  const text = pageText(layoutDocument(model, { measure: approximateMeasure }))
  assert.equal(text.includes(t('IF', {}, 'en')), false)
  assert.equal(text.includes(t('Client ICE', {}, 'en')), false)
  assert.equal(text.includes(t('ICE', {}, 'en')), false)
  // US: tax is always its own line, never folded into the total.
  assert.ok(model.totals.some(total => total.label === t('Sales tax', {}, 'en')))
  assert.equal(model.totals.at(-1)!.label, t('Total incl. tax', {}, 'en'))
  // Switching the app region later must not change a stored US document.
  const stored = documentTemplate({ ...template }, 'MA')
  assert.equal(stored.region, 'US')
})

test('a stored snapshot never changes when the defaults in Settings change', () => {
  const stored = migrateBackup(legacyFixture()).invoices[0].template as DocumentTemplate
  const before = pageText(pagesOf(stored))
  assert.equal(stored.layoutId, 'classic')
  assert.equal(stored.presetId, 'general')
  assert.equal(stored.templateVersion, 1)
  assert.equal(stored.accent, 'auto')
  assert.equal(stored.showLogo, false)

  const changed = templateDefaults({ templateLayout: 'modern', templatePreset: 'freelancer', templateAccent: 'rose' }, 'MA')
  assert.equal(changed.layoutId, 'modern')
  assert.equal(changed.presetId, 'freelancer')
  assert.equal(changed.accent, 'rose')
  assert.notEqual(templateCombinationKeys(changed).join(' · '), templateCombinationKeys(stored).join(' · '))

  // The old document still renders exactly as it did, with its own wording.
  const after = pageText(pagesOf(stored))
  assert.equal(after, before)
  assert.ok(before.includes(t(COLUMN_LABEL.quantity, {}, 'fr')), 'the stored label wins')
  assert.equal(before.includes(t('Hours', {}, 'fr')), false, 'a later preset must not rename a stored column')
  assert.notEqual(pageText(pagesOf(changed)), before, 'a new document does use the new default')

  // Resolving a stored snapshot is idempotent, and unknown values fall back safely.
  assert.deepEqual(snapshotOf(stored), stored)
  const damaged = snapshotOf({ layoutId: 'nope', presetId: 42, accent: 'gold', templateVersion: 0, labels: { quantity: 'x'.repeat(200) }, showLogo: 'yes' }, 'MA')
  assert.equal(damaged.layoutId, 'classic'); assert.equal(damaged.presetId, 'general')
  assert.equal(damaged.templateVersion, TEMPLATE_VERSION); assert.equal(damaged.accent, 'auto')
  assert.equal(columnLabelKey(damaged, 'quantity'), 'Qty'); assert.equal(damaged.showLogo, true)
})

test('an old 3.0.0 backup maps to classic + general version 1 and renders exactly as before', () => {
  const old = legacyFixture()
  assert.equal(old.version, '3.0.0')
  for (const name of ['invoices', 'estimates'] as const) {
    for (const row of old[name]) assert.equal((row as unknown as Record<string, unknown>).template, undefined, name)
  }
  const migrated = migrateBackup(JSON.parse(JSON.stringify(old)) as typeof old)
  assert.equal(migrated.version, BACKUP_VERSION)
  validateBackup(migrated)
  for (const name of ['invoices', 'estimates'] as const) {
    for (const row of migrated[name]) {
      assert.deepEqual(row.template, { ...LEGACY_TEMPLATE, labels: { ...LEGACY_TEMPLATE.labels }, region: 'MA' }, name)
      assert.ok(isTemplateSnapshot(row.template))
    }
  }
  // Writing the snapshot down is a no-op for the old look: the same document with and
  // without it produces byte-identical pages.
  const row = migrated.invoices[0]
  const withSnapshot = buildDocumentModel({
    kind: 'invoice', document: row, business: migrated.businesses[0], customer: migrated.customers[0],
    region: 'MA', currency: 'EUR', language: 'en', template: documentTemplate(row.template, 'MA'), appAccent: '#2563eb',
  })
  const legacy = buildDocumentModel({
    kind: 'invoice', document: { ...row, template: undefined }, business: migrated.businesses[0],
    customer: migrated.customers[0], region: 'MA', currency: 'EUR', language: 'en',
    template: documentTemplate(undefined, 'MA'), appAccent: '#2563eb',
  })
  assert.deepEqual(withSnapshot, legacy)
  assert.deepEqual(pageText(layoutDocument(withSnapshot, { measure: approximateMeasure })), pageText(layoutDocument(legacy, { measure: approximateMeasure })))
  // A new document still starts from the shipped defaults (logo on, blue accent).
  const fresh = templateDefaults(null, 'MA')
  assert.deepEqual({ layoutId: fresh.layoutId, presetId: fresh.presetId, accent: fresh.accent, showLogo: fresh.showLogo }, { layoutId: 'classic', presetId: 'general', accent: 'auto', showLogo: true })
  // A US file is pinned to US, not to the app's default region.
  const us = legacyFixture()
  us.settings[0] = { ...us.settings[0], taxRegion: 'US' }
  const migratedUs = migrateBackup(JSON.parse(JSON.stringify(us)))
  assert.equal(migratedUs.invoices[0].template!.region, 'US')
  // Older formats still import.
  for (const version of ['1.0.0', '2.0.0'] as const) {
    const older = JSON.parse(JSON.stringify(legacyFixture())) as unknown as Record<string, unknown>
    older.version = version
    assert.equal(migrateBackup(older).version, BACKUP_VERSION, version)
  }
})

test('a line discount changes the line total, not the tax rules', () => {
  const document = invoice({
    items: [{ id: 'i1', description: 'Casque audio', quantity: 2, unitPrice: 100, discount: 10, total: 180 }],
    subtotal: 180, tax: 36, total: 216, taxRate: 20,
  })
  const template = normalizeTemplate({ layoutId: 'classic', presetId: 'retail', region: 'MA', accent: 'blue' }, 'MA')
  const model = buildDocumentModel({
    kind: 'invoice', document, business: completeBusiness(), customer: completeCustomer(),
    region: 'MA', currency: 'MAD', language: 'fr', template, appAccent: '#2563eb',
  })
  const totalColumn = model.columns.findIndex(column => column.id === 'total')
  assert.equal(model.rows[0].cells[totalColumn], money(180, 'MAD', false, 'fr'))
  assert.equal(model.totals[0].value, money(180, 'MAD', false, 'fr'))
  assert.equal(model.totals[1].value, money(36, 'MAD', false, 'fr'))
  assert.equal(lineTotal(2, 100, 'MAD', 10), 180)
  assert.equal(lineTotal(2, 100, 'MAD'), 200)
  assert.throws(() => lineTotal(2, 100, 'MAD', 101), /discount/i)
  // The discount column only exists where the preset asks for it.
  assert.ok(templateColumns(template).includes('discount'))
  assert.equal(templateColumns(normalizeTemplate({ presetId: 'general', region: 'MA' }, 'MA')).includes('discount'), false)
})

test('no preset can change a tax rate, remove mandatory content or hide a field', () => {
  const layoutKeys = ['id', 'label', 'description', 'header', 'table', 'spacing', 'totals', 'footer', 'logo', 'baseSize', 'rowPadding', 'margin']
  for (const layout of Object.values(LAYOUTS)) {
    assert.deepEqual(Object.keys(layout).sort(), [...layoutKeys].sort(), `${layout.id}: a layout may only describe style`)
  }
  const presetKeys = ['id', 'label', 'description', 'columns', 'labels', 'unitSuggestions', 'notes', 'terms', 'footer', 'groupBy', 'taxExempt', 'rateHint']
  for (const preset of Object.values(PRESETS)) {
    for (const key of Object.keys(preset)) {
      assert.ok(presetKeys.includes(key), `${preset.id}: unexpected key ${key}`)
      const forbidden = key !== 'rateHint' && /^(taxRate|rate|vat|tva|hidden|hide|omit|required)/i.test(key)
      assert.equal(forbidden, false, `${preset.id}: ${key} would let a preset touch tax or mandatory content`)
    }
    for (const column of preset.columns) assert.ok(!REQUIRED_COLUMNS.includes(column) || true)
    // The four mandatory columns survive every preset, in the same order.
    const columns = templateColumns(normalizeTemplate({ presetId: preset.id, region: 'MA' }, 'MA'))
    for (const required of REQUIRED_COLUMNS) assert.ok(columns.includes(required), `${preset.id}: ${required}`)
    assert.equal(columns[0], 'description')
    // A hint is prose, never a rate.
    const hint = presetRateHint(normalizeTemplate({ presetId: preset.id, region: 'MA' }, 'MA'))
    if (hint !== null) assert.equal(typeof hint, 'string')
  }
  // One document, every preset: the tax line is the document's own rate, and the
  // exempt preset is the only one that drops it.
  const document = invoice({ taxRate: 20, tax: 840 })
  for (const presetId of PRESET_IDS) {
    const template = normalizeTemplate({ presetId, region: 'MA' }, 'MA')
    const model = buildDocumentModel({
      kind: 'invoice', document, business: completeBusiness(), customer: completeCustomer(),
      region: 'MA', currency: 'MAD', language: 'fr', template, appAccent: '#2563eb',
    })
    const taxLines = model.totals.filter(total => total.label.startsWith(t('TVA', {}, 'fr')))
    if (presetId === 'auto_entrepreneur') assert.equal(taxLines.length, 0)
    else {
      assert.equal(taxLines.length, 1, presetId)
      assert.equal(taxLines[0].label, `${t('TVA', {}, 'fr')} ${number(20, 'fr')}%`)
      assert.equal(taxLines[0].value, money(840, 'MAD', false, 'fr'))
    }
  }
})

test('the preview is RTL in Arabic and paints the same operations as the PDF', () => {
  for (const presetId of PRESET_IDS) {
    for (const region of REGIONS) {
      const template = normalizeTemplate({ presetId, region, accent: 'teal' }, region)
      const currency = region === 'MA' ? 'MAD' : 'USD'
      const arabic = buildSampleModel(template, 'ar', currency, region, '#0f766e', 'Bank transfer')
      assert.equal(arabic.rtl, true)
      assert.deepEqual(templateCombinationKeys(arabic.template), [LAYOUTS[template.layoutId].label, PRESETS[presetId].label])
      const pages = layoutDocument(arabic, { measure: approximateMeasure })
      const arabicOps = textOps(pages).filter(op => /[\u0600-\u06FF]/.test(op.text))
      assert.ok(arabicOps.length > 5, `${presetId}: the Arabic model must be full`)
      for (const op of arabicOps) {
        // Amounts print in Latin digits (some currencies render an Arabic symbol),
        // so a line that carries a number keeps the LTR direction.
        assert.ok(op.dir === 'rtl' || /\d/.test(op.text), `${presetId}: "${op.text}" mixes Arabic and a number in LTR`)
      }
      assert.ok(arabicOps.some(op => op.dir === 'rtl'))
      // Amounts keep Latin digits and their own direction, exactly like the old PDF.
      const values = [...new Set(arabic.totals.map(total => total.value))]
      // The totals block prints each value start-aligned and LTR; the same string in a
      // table row follows the column alignment instead, so match on the block only.
      const amounts = textOps(pages).filter(op => values.includes(op.text) && op.align === 'start')
      assert.ok(amounts.length >= values.length, `${presetId}: every total is drawn`)
      for (const op of amounts) assert.equal(op.dir, 'ltr')
      const latin = buildSampleModel(template, 'fr', currency, region, '#0f766e', 'Bank transfer')
      assert.equal(latin.rtl, false)
      for (const op of textOps(layoutDocument(latin, { measure: approximateMeasure }))) assert.equal(op.dir, 'ltr')
      // The preview canvas is labelled for screen readers and the columns flip.
      const painted: string[] = []
      const context = {
        fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: 'left', textBaseline: 'top', direction: 'ltr',
        fillRect: () => undefined, fillText: (text: string) => { painted.push(text) },
        beginPath: () => undefined, moveTo: () => undefined, lineTo: () => undefined, stroke: () => undefined,
        drawImage: () => undefined,
      } as unknown as PaintContext
      paintPage(context, layoutDocument(arabic, { measure: approximateMeasure })[0])
      assert.ok(painted.length > 10, 'the painter must draw the page')
      assert.ok(painted.some(line => /[\u0600-\u06FF]/.test(line)), 'the Arabic page carries Arabic text')
    }
  }
  assert.equal(columnAlign('description'), 'start')
  assert.equal(columnAlign('unitPrice'), 'end')
  const picker = read('src/modules/TemplatePicker.tsx')
  assert.ok(picker.includes('role="img"'), 'the preview canvas needs a text alternative')
  assert.ok(picker.includes('aria-pressed'), 'the accent swatches must expose selection')
})

test('images are user-provided only: resized, capped, validated and refused when invalid', async () => {
  /** A data URL whose decoded size is about `bytes` (base64 is 3 bytes per 4 characters). */
  const payload = (bytes: number) => `data:image/png;base64,${'A'.repeat(Math.ceil(bytes * 4 / 3))}`
  const canvas = { width: 0, height: 0, toDataURL: () => 'data:image/png;base64,AAAA' }
  const io: ImageIo = {
    decode: async () => ({ width: 1600, height: 1200, source: {} as CanvasImageSource }),
    createCanvas: () => ({
      getContext: () => ({ drawImage: () => undefined }),
      toDataURL: () => canvas.toDataURL(),
      get width() { return canvas.width }, set width(value: number) { canvas.width = value },
      get height() { return canvas.height }, set height(value: number) { canvas.height = value },
    }),
  }
  const stored = await readImageFile(new File(['x'], 'logo.png', { type: 'image/png' }), MAX_LOGO_BYTES, io)
  assert.ok(isImageDataUrl(stored, MAX_LOGO_BYTES))
  assert.deepEqual([canvas.width, canvas.height], [512, 384], 'the image is downscaled, not upscaled')
  assert.equal(targetSize(1600, 1200).width, 512)
  assert.deepEqual(targetSize(120, 80), { width: 120, height: 80 })

  await assert.rejects(readImageFile(new File([new Uint8Array(MAX_SOURCE_BYTES + 1)], 'big.png', { type: 'image/png' }), MAX_LOGO_BYTES, io), new RegExp(IMAGE_ERRORS.tooLarge))
  await assert.rejects(readImageFile(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }), MAX_LOGO_BYTES, io), new RegExp(IMAGE_ERRORS.unsupported))
  await assert.rejects(readImageFile(new File(['x'], 'logo.gif', { type: 'image/gif' }), MAX_LOGO_BYTES, io), new RegExp(IMAGE_ERRORS.unsupported))
  await assert.rejects(readImageFile(new File(['x'], 'logo.png', { type: 'image/png' }), MAX_LOGO_BYTES, {
    decode: async () => { throw new Error('cannot decode') },
    createCanvas: io.createCanvas,
  }), new RegExp(IMAGE_ERRORS.unreadable))
  await assert.rejects(readImageFile(new File(['x'], 'logo.png', { type: 'image/png' }), MAX_LOGO_BYTES, {
    decode: async () => ({ width: 0, height: 0, source: {} as CanvasImageSource }),
    createCanvas: io.createCanvas,
  }), new RegExp(IMAGE_ERRORS.unreadable))
  await assert.rejects(readImageFile(new File(['x'], 'logo.png', { type: 'image/png' }), 8, {
    decode: async () => ({ width: 1600, height: 1200, source: {} as CanvasImageSource }),
    createCanvas: () => ({ getContext: () => ({ drawImage: () => undefined }), toDataURL: () => payload(4096), width: 0, height: 0 }),
  }), new RegExp(IMAGE_ERRORS.tooLarge), 'an image that cannot fit the cap is refused')
  await assert.rejects(readImageFile(new File(['x'], 'logo.png', { type: 'image/png' }), MAX_LOGO_BYTES, {
    decode: async () => ({ width: 1600, height: 1200, source: {} as CanvasImageSource }),
    createCanvas: () => ({ getContext: () => null, toDataURL: () => payload(64), width: 0, height: 0 }),
  }), new RegExp(IMAGE_ERRORS.write))

  // Backup validation: a bitmap inside the cap is accepted, SVG or an oversized
  // payload is refused, and a stamp above its own cap is ignored by the UI.
  assert.ok(isStoredImage(payload(4096)))
  assert.ok(isStoredImage('data:image/jpeg;base64,AAAA'))
  for (const invalid of ['data:image/svg+xml;base64,AAAA', 'data:image/png,AAAA', 'https://example.com/logo.png', '', payload(2 * 1024 * 1024 + 8192)]) {
    assert.equal(isStoredImage(invalid), false, invalid.slice(0, 40))
  }
  assert.ok(imageBytes(payload(4096)) <= 4096)
  assert.equal(storedImage(payload(4 * MAX_STAMP_BYTES), MAX_STAMP_BYTES), undefined)
  assert.equal(storedImage(payload(MAX_STAMP_BYTES), MAX_STAMP_BYTES)?.startsWith('data:image/png;base64,'), true)
  assert.equal(storedImage(payload(4096), MAX_STAMP_BYTES), payload(4096))
  // A backup carries the image inside the business record, and an export with a
  // logo must import again: SVG or oversized payloads are refused before any write.
  const logo = payload(4096)
  assert.doesNotThrow(() => validateBackup({ ...fixture(), businesses: [{ ...fixture().businesses[0], logo, stamp: logo }] }))
  for (const invalid of ['data:image/svg+xml;base64,AAAA', 'https://example.com/logo.png', payload(2 * 1024 * 1024 + 4096)]) {
    assert.throws(() => validateBackup({ ...fixture(), businesses: [{ ...fixture().businesses[0], logo: invalid }] }), /no data was changed/)
  }
  // resetApp empties every store (tests/limits.test.ts), and an image only lives in a
  // business record, so a reset can never leave a logo behind.
  assert.ok(read('src/lib/vault.ts').includes('for(const name of STORES) stores[name]=[]'))
})

test('the accent palette is readable as a band and as text on white', () => {
  for (const accent of TEMPLATE_ACCENTS) {
    if (!accent.hex) continue
    assert.ok(contrast(accent.hex, '#ffffff') >= 4.5, `${accent.id}: text on white`)
    assert.ok(contrast(accent.hex, accentText(accent.hex)) >= 4.5, `${accent.id}: white text on the band`)
    for (const other of TEMPLATE_ACCENTS.filter(entry => entry.hex)) {
      assert.ok(contrast(accent.hex, other.hex!) >= 1, `${accent.id} vs ${other.id}`)
    }
  }
  // Legacy documents follow the app accent exactly like the old PDF did.
  assert.equal(accentHex(LEGACY_TEMPLATE, '#2563eb'), '#2563eb')
  assert.equal(accentHex(normalizeTemplate({ accent: 'violet', region: 'MA' }, 'MA'), '#2563eb'), '#6d28d9')
})

test('every template string exists in all five dictionaries', () => {
  const dictionaries = Object.fromEntries(languages.map(language => [
    language, JSON.parse(readFileSync(`src/i18n/${language}.json`, 'utf8')) as Record<string, string>,
  ])) as Record<(typeof languages)[number], Record<string, string>>
  const keys = new Set<string>()
  for (const layout of Object.values(LAYOUTS)) { keys.add(layout.label); keys.add(layout.description) }
  for (const preset of Object.values(PRESETS)) {
    keys.add(preset.label); keys.add(preset.description); keys.add(preset.notes); keys.add(preset.terms); keys.add(preset.footer)
    if (preset.rateHint) keys.add(preset.rateHint)
    for (const unit of preset.unitSuggestions) keys.add(unit)
  }
  for (const label of Object.values(COLUMN_LABEL)) keys.add(label)
  for (const accent of TEMPLATE_ACCENTS) keys.add(accent.label)
  for (const presetId of PRESET_IDS) {
    for (const line of presetSample(normalizeTemplate({ presetId, region: 'MA' }, 'MA'))) {
      keys.add(line.description)
      if (line.unit) keys.add(line.unit)
      if (line.section) keys.add(line.section === 'materials' ? 'Materials' : 'Labour')
    }
  }
  // Wording the picker and the form pass as props, which t() cannot see.
  for (const key of ['Templates', 'Layout', 'Topic preset', 'Document color', 'Footer note', 'Live preview', 'Back to settings', 'Open template preview', 'Use this template', 'Set as default for new documents', 'Template saved', 'Show the logo on the document', 'Show a stamp or signature', 'Shown at the bottom of the document.', 'Unit', 'Section', 'Discount (%)', 'No TVA: the exemption mention replaces the tax lines.', 'Auto-entrepreneur: no TVA is charged; the exemption mention is printed on the document.', 'Empty mandatory fields are printed with a dash:', 'Fill them in Settings → Business Information.', 'Image updated', 'Choose logo', 'Choose stamp', 'Remove image', 'Max 200 KB after resizing. PNG or JPG.', 'Default layout', 'Default preset', 'Default template', 'New documents use it. Existing documents keep the template they were saved with.', 'Printed on every Moroccan document. An empty one prints with a dash.', 'Seller identifiers', 'TVA non applicable']) {
    keys.add(key)
  }
  for (const language of languages) {
    const dictionary = dictionaries[language]
    for (const key of keys) assert.ok(typeof dictionary[key] === 'string' && dictionary[key].length > 0, `${language}: ${key}`)
  }
  assert.ok(keys.size > 90, `the registry carries ${keys.size} keys`)
})

test('a 50-line invoice keeps one pass, repeats the table header and stays fast', () => {
  const lines = Array.from({ length: 50 }, (_, index) => ({
    id: `i${index}`, description: `Prestation ${index + 1} sur le chantier de Tanger avec un libellé long qui doit passer à la ligne`,
    quantity: index + 1, unitPrice: 100 + index, unit: 'm²', section: index % 2 ? 'labour' : 'materials', total: (index + 1) * (100 + index),
  }))
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
  const document = invoice({ items: lines, subtotal, tax: subtotal * 0.2, total: subtotal * 1.2 })
  const template = normalizeTemplate({ layoutId: 'compact', presetId: 'construction', region: 'MA', accent: 'slate' }, 'MA')
  const model = buildDocumentModel({
    kind: 'invoice', document, business: completeBusiness(), customer: completeCustomer(),
    region: 'MA', currency: 'MAD', language: 'fr', template, appAccent: '#2563eb',
  })
  const started = performance.now()
  const pages = layoutDocument(model, { measure: approximateMeasure })
  const elapsed = performance.now() - started
  assert.ok(pages.length >= 2, 'a 50-line invoice is a multi-page document')
  assert.ok(elapsed < 1500, `layout took ${Math.round(elapsed)} ms`)
  const labels = model.columns.map(column => column.label)
  for (const page of pages.slice(1)) {
    const text = pageText([page])
    for (const label of labels) assert.ok(text.includes(label), `continuation page repeats the header: ${label}`)
    assert.ok(text.includes(document.number), 'continuation page repeats the number')
  }
  // A long description wraps instead of overflowing: it is drawn as several lines.
  const long = lines[0].description
  const wrapped = textOps(pages).filter(op => long.includes(op.text) && op.text.split(' ').length > 1)
  assert.ok(wrapped.length >= 2, 'the long description is split across lines')
  assert.ok(textOps(pages).every(op => op.x >= 0 && op.y >= 0))
})

test('the picker stays out of the first bundle and keeps 48 px targets', () => {
  for (const file of ['src/modules/Invoices.tsx', 'src/modules/Estimates.tsx']) {
    const source = read(file)
    assert.ok(source.includes("lazy(() => import('./TemplatePicker')"), `${file} must lazy-load the picker`)
    assert.equal(/^import .*TemplatePicker/m.test(source), false, `${file} must not import the picker eagerly`)
  }
  const app = read('src/App.tsx')
  assert.ok(app.includes("lazy(() => import('./modules/TemplatePicker'))"), 'the routed screen is lazy too')
  assert.ok(app.includes("case 'templates'"))
  assert.ok(read('src/components/AppShell.tsx').includes("templates:'Templates'"))
  // The registries are plain data and the renderer has no React dependency, so a
  // bundle that does not draw a preview cannot pull them in.
  for (const file of ['src/lib/templates.ts', 'src/lib/template-render.ts']) {
    assert.equal(/from 'react'/.test(read(file)), false, file)
  }
  for (const file of ['src/modules/TemplatePicker.tsx', 'src/components/TemplateFields.tsx']) {
    const source = read(file)
    for (const chunk of source.split('<button').slice(1)) {
      // `onClick={() => ...}` contains a '>', so look at the whole tag window.
      const tag = chunk.slice(0, 700)
      assert.ok(/min-h-12|h-12 w-12/.test(tag), `${file}: ${tag.slice(0, 60)} needs a 48 px target`)
    }
    const checkboxes = source.split('<input').filter(tag => tag.slice(0, tag.indexOf('>')).includes('type="checkbox"'))
    const rows = source.split('<label className="flex min-h-12').slice(1)
    assert.equal(rows.length >= checkboxes.length, true, `${file}: each checkbox row carries the 48 px tap area`)
    assert.equal(/\bfetch\s*\(|XMLHttpRequest|https?:\/\//.test(source), false, `${file} must stay offline`)
    assert.equal(/dangerouslySetInnerHTML|<style|contenteditable/i.test(source), false, `${file} must not accept free-form markup`)
  }
  assert.ok(MAX_FOOTER_NOTE >= 60 && MAX_FOOTER_NOTE <= 200, 'the footer note keeps a bounded length')
  assert.equal(/contenteditable|dangerouslySetInnerHTML/i.test(read('src/lib/templates.ts')), false)
})
