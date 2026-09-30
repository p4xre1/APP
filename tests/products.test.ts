// Product types: ONE Product entity with a type field, type-aware behaviour,
// and one shared product -> document-line mapping for invoices and estimates.
// Nothing here creates a second inventory, pricing or tax system.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PRODUCT_TYPES, PRODUCT_TYPE_LABEL, PRODUCT_TYPE_HINT, PRODUCT_OPTION_LABEL,
  SERVICE_BILLING_METHODS, LABOR_BILLING_UNITS, BILLING_FREQUENCIES, RENEWAL_BEHAVIORS,
  DIGITAL_FORMATS, DURATION_UNITS,
  productType, tracksInventory, isLowStock, matchesProduct, validateProduct, productToLine,
} from '../src/lib/products'
import type { Product } from '../src/store/types'

const product = (patch: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'Laptop', description: 'Fast machine', sku: 'SKU-1',
  unitPrice: 999.5, unit: 'piece', stock: 25, minStock: 5,
  createdAt: 0, updatedAt: 0, ...patch,
})

test('existing product without a type behaves as a physical product (migration default)', () => {
  const legacy = product() // no `type` - exactly what pre-type records look like
  assert.equal(legacy.type, undefined)
  assert.equal(productType(legacy), 'physical')
  assert.equal(tracksInventory(legacy), true)
  assert.equal(isLowStock(product({ stock: 3, minStock: 5 })), true)
  assert.equal(isLowStock(legacy), false) // 25 > 5
})

test('only tracked physical products show inventory; every other type never does', () => {
  for (const type of PRODUCT_TYPES.filter(candidate => candidate !== 'physical')) {
    const item = product({ type, stock: 2, minStock: 5 })
    assert.equal(tracksInventory(item), false, `${type} must not track inventory`)
    assert.equal(isLowStock(item), false, `${type} must never warn about stock`)
  }
  assert.equal(tracksInventory(product({ type: 'physical' })), true)
  assert.equal(tracksInventory(product({ type: 'physical', trackInventory: false })), false)
})

test('validation depends on the type: irrelevant fields are never required', () => {
  // Name is always required.
  assert.equal(validateProduct({ name: '  ', type: 'physical', unitPrice: 5 }), 'Enter a name')
  // Physical: stock figures must not be negative.
  assert.equal(validateProduct({ name: 'Chair', type: 'physical', unitPrice: 5, stock: -1 }), 'Amounts cannot be negative')
  assert.equal(validateProduct({ name: 'Chair', type: 'physical', unitPrice: 5, stock: 10, minStock: 2 }), null)
  // Service, digital, recurring and non-stock need no inventory at all - and a
  // dormant negative-looking figure from another type never blocks them.
  for (const type of ['service', 'digital', 'recurring_service', 'non_stock'] as const) {
    assert.equal(validateProduct({ name: 'Consulting', type, unitPrice: 120 }), null, `${type} must save without inventory`)
  }
  // Labor: name and a non-negative rate.
  assert.equal(validateProduct({ name: 'Technician', type: 'labor', unitPrice: 80 }), null)
  assert.equal(validateProduct({ name: 'Technician', type: 'labor', unitPrice: -1 }), 'Amounts cannot be negative')
})

test('bundle components and custom attributes are validated, not trusted', () => {
  const good = { name: 'Pack', type: 'bundle' as const, unitPrice: 500, components: [{ productId: 'x', name: 'AC unit', quantity: 1 }] }
  assert.equal(validateProduct(good), null)
  assert.match(String(validateProduct({ ...good, components: [{ name: '', quantity: 1 }] })), /bundle component/)
  assert.match(String(validateProduct({ ...good, components: [{ name: 'AC unit', quantity: 0 }] })), /bundle component/)
  assert.match(String(validateProduct({
    name: 'Thing', type: 'custom', unitPrice: 1, attributes: [{ name: '', value: 'red' }],
  })), /custom attribute/)
  assert.equal(validateProduct({ name: 'Thing', type: 'custom', unitPrice: 1, attributes: [{ name: 'Color', value: 'red' }] }), null)
})

test('productToLine preserves the price and identity for invoices and estimates alike', () => {
  const line = productToLine(product({ type: 'labor', unitPrice: 80, unit: 'hour', description: '' }))
  assert.deepEqual(line, { productId: 'p1', itemCode: 'SKU-1', description: 'Laptop', quantity: 1, unitPrice: 80, unit: 'hour' })
  const described = productToLine(product())
  assert.equal(described.unitPrice, 999.5)
  assert.equal(described.description, 'Laptop — Fast machine')
  // No SKU -> no item code on the line.
  assert.equal(productToLine(product({ sku: ' ' })).itemCode, undefined)
})

test('search matches name, SKU, barcode and category, case-insensitively', () => {
  const item = product({ barcode: '6111234567890', category: 'Electronics' })
  for (const query of ['lap', 'sku-1', '61112', 'electro', '']) {
    assert.equal(matchesProduct(item, query), true, `query "${query}" must match`)
  }
  assert.equal(matchesProduct(item, 'plumbing'), false)
})

test('both document editors use the same product selection mechanism', () => {
  for (const file of ['src/modules/Invoices.tsx', 'src/modules/Estimates.tsx']) {
    const source = readFileSync(file, 'utf8')
    assert.ok(source.includes('productToLine('), `${file} must fill lines through productToLine`)
    assert.ok(!source.includes('stock'), `${file} must never touch product stock`)
  }
  // The store has no automatic stock movement either: stock is a manual figure.
  assert.ok(!readFileSync('src/store/useFatorati.ts', 'utf8').includes('stock'), 'no hidden inventory ledger')
})

test('every type label, hint and option label is translated in all five dictionaries', () => {
  const languages = ['en', 'ar', 'fr', 'es', 'pt'] as const
  const dictionaries = languages.map(language => JSON.parse(readFileSync(`src/i18n/${language}.json`, 'utf8')) as Record<string, string>)
  const keys = [
    ...Object.values(PRODUCT_TYPE_LABEL), ...Object.values(PRODUCT_TYPE_HINT),
    ...[...SERVICE_BILLING_METHODS, ...LABOR_BILLING_UNITS, ...BILLING_FREQUENCIES,
      ...RENEWAL_BEHAVIORS, ...DIGITAL_FORMATS, ...DURATION_UNITS].map(value => PRODUCT_OPTION_LABEL[value]),
  ]
  for (const key of keys) {
    assert.ok(key, 'every option value needs a label')
    dictionaries.forEach((dictionary, index) => {
      assert.ok(typeof dictionary[key] === 'string' && dictionary[key].length > 0, `"${key}" missing in ${languages[index]}`)
    })
  }
})
