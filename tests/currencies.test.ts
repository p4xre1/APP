import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currencyCodes, defaultPreferences, REQUIRED_CURRENCIES, validCurrency } from '../src/lib/preferences'
import { csvRows } from '../src/lib/csv'
import { fixture } from './fixtures'

test('the required currencies are always offered and validate offline', () => {
  const codes = currencyCodes()
  const symbols: Record<string, string> = { MAD: 'MAD', EUR: '€', USD: '$', GBP: '£', AED: 'AED', SAR: 'SAR', DZD: 'DZD', TND: 'TND', XOF: 'CFA', CAD: 'CA$' }
  for (const code of REQUIRED_CURRENCIES) {
    assert.ok(codes.includes(code), `${code} must be offered by the picker`)
    assert.equal(validCurrency(code), true, `${code} must be accepted by validation`)
    const formatted = new Intl.NumberFormat('en', { style: 'currency', currency: code }).format(1234.5)
    assert.ok(formatted.includes(symbols[code]), `${code} formats as a currency: ${formatted}`)
    assert.notEqual(formatted, new Intl.NumberFormat('en').format(1234.5), `${code} is not a bare number`)
  }
})

test('MAD is the default for new installs and old records stay valid', () => {
  assert.equal(defaultPreferences.defaultCurrency, 'MAD')
  assert.equal(validCurrency(undefined), false)
  assert.equal(validCurrency('BAD'), false)
  assert.equal(validCurrency('MAD'), true)
})

test('CSV exports carry a currency for every amount, including old records', () => {
  const backup = fixture()
  const withoutCurrency = { ...backup, invoices: backup.invoices.map(({ currency, ...rest }) => rest), preferences: { ...backup.preferences, defaultCurrency: 'MAD' } }
  const rows = csvRows('invoices', withoutCurrency as typeof backup)
  assert.equal(rows[0][12], 'Currency')
  assert.equal(rows[1][12], 'MAD', 'a record without a currency is exported as the default currency')
  assert.equal(csvRows('expenses', backup)[0][3], 'Currency')
})
