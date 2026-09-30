// Inventory-lite: optional cost price and low-stock threshold on products.
// No warehouse management, no COGS engine - just fields that survive backups.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateBackup, normalizeRecord, encodeBackup, decodeBackup } from '../src/lib/backup-format'
import { fixture } from './fixtures'

const withProduct = (patch: Record<string, unknown> = {}) => {
  const backup = fixture()
  const product = backup.products[0] as unknown as Record<string, unknown>
  Object.assign(product, patch)
  return backup
}

test('valid inventory fields pass; broken ones are rejected; old data stays valid', () => {
  validateBackup(withProduct({ costPrice: 6.5, minStock: 2 }))
  validateBackup(withProduct()) // both optional
  for (const bad of [
    { costPrice: 'x' }, { costPrice: -1 }, { costPrice: Infinity },
    { minStock: 'x' }, { minStock: -3 },
  ]) assert.throws(() => validateBackup(withProduct(bad)), /Invalid backup record/)
})

test('normalizeRecord rounds the cost price like other money, leaves minStock alone', () => {
  const source = withProduct().products[0] as unknown as Record<string, unknown>
  const row = normalizeRecord('products', { ...source, costPrice: 6.999, minStock: 2.5 }, 'EUR')
  assert.equal(row.costPrice, 7)
  assert.equal(row.minStock, 2.5)
  assert.equal(normalizeRecord('products', source, 'EUR').costPrice, undefined)
})

test('inventory fields survive an encrypted backup round-trip', async () => {
  const source = withProduct({ costPrice: 6.5, minStock: 2 })
  const restored = await decodeBackup(await encodeBackup(source, 'سري secret é'), 'سري secret é')
  assert.equal(restored.products[0].costPrice, 6.5)
  assert.equal(restored.products[0].minStock, 2)
})

test('product-type fields validate; a missing type stays valid (legacy = physical)', () => {
  // Pre-type backups carry no `type` at all and must import unchanged.
  validateBackup(withProduct())
  for (const type of ['physical', 'service', 'digital', 'recurring_service', 'bundle', 'non_stock', 'labor', 'custom']) {
    validateBackup(withProduct({ type }))
  }
  validateBackup(withProduct({
    type: 'physical', category: 'Electronics', barcode: '6111234567890', brand: 'Acme',
    manufacturer: 'Acme Corp', model: 'X1', vendor: 'Supplier SA', supplierSku: 'SUP-9',
    trackInventory: false, reorderQty: 10, maxStock: 100, location: 'Depot A',
    weight: 2.5, weightUnit: 'kg', length: 30, width: 20, height: 3, dimensionUnit: 'cm',
  }))
  validateBackup(withProduct({
    type: 'service', billingMethod: 'hourly', duration: 3, durationUnit: 'hours', internalNotes: 'Bring tools',
  }))
  validateBackup(withProduct({
    type: 'digital', fileFormat: 'pdf', fileRef: 'guide.pdf', fileUrl: 'https://example.test/guide',
    version: '1.2', licenseType: 'Single user', deliveryMethod: 'Email',
  }))
  validateBackup(withProduct({ type: 'recurring_service', billingFrequency: 'monthly', renewal: 'auto_renew' }))
  validateBackup(withProduct({
    type: 'bundle',
    components: [{ productId: 'product', name: 'Filter', quantity: 2 }, { name: 'Install', quantity: 1, note: 'On site' }],
  }))
  validateBackup(withProduct({ type: 'custom', attributes: [{ name: 'Color', value: 'Red' }] }))
})

test('broken product-type data is rejected, never restored', () => {
  for (const bad of [
    { type: 'gadget' }, { type: 42 },
    { trackInventory: 'yes' },
    { reorderQty: -1 }, { maxStock: 'many' }, { weight: -0.1 }, { duration: Infinity },
    { category: 12 }, { barcode: 'x'.repeat(121) },
    { fileUrl: 42 }, { internalNotes: 11 },
    { components: 'none' }, { components: [{ name: '', quantity: 1 }] },
    { components: [{ name: 'Filter', quantity: 0 }] }, { components: [{ name: 'Filter', quantity: 1, productId: 5 }] },
    { attributes: [{ name: '', value: 'red' }] }, { attributes: [{ name: 'Color', value: 7 }] },
    { attributes: Array.from({ length: 41 }, () => ({ name: 'a', value: 'b' })) },
  ]) assert.throws(() => validateBackup(withProduct(bad)), /Invalid backup record/, JSON.stringify(bad))
})

test('type, components and attributes survive an encrypted backup round-trip', async () => {
  const source = withProduct({
    type: 'bundle', category: 'Packs',
    components: [{ productId: 'product', name: 'قطعة Filtre', quantity: 2, note: 'مع التركيب' }],
    attributes: [{ name: 'Couleur', value: 'أحمر' }],
  })
  const restored = await decodeBackup(await encodeBackup(source, 'سري secret é'), 'سري secret é')
  assert.equal(restored.products[0].type, 'bundle')
  assert.equal(restored.products[0].category, 'Packs')
  assert.deepEqual(restored.products[0].components, [{ productId: 'product', name: 'قطعة Filtre', quantity: 2, note: 'مع التركيب' }])
  assert.deepEqual(restored.products[0].attributes, [{ name: 'Couleur', value: 'أحمر' }])
})
