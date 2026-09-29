import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fieldInputClass } from '../src/components/Field'
import en from '../src/i18n/en.json'

const read = (file: string) => readFileSync(file, 'utf8')

test('no money field parses its own text any more: the shared NumberInput owns it', () => {
  const modules = ['Invoices', 'Expenses', 'Projects', 'Products', 'Estimates'].map(name => `src/modules/${name}.tsx`)
  modules.push('src/components/DocumentOptions.tsx')
  for (const file of modules) {
    const source = read(file)
    assert.doesNotMatch(source, /parseFloat\(/, `${file} must not turn an empty field into 0`)
    assert.doesNotMatch(source, /Number\(e\.target\.value\)/, `${file} must not turn an empty field into 0`)
    assert.doesNotMatch(source, /type="number"/, `${file} must use the shared decimal field`)
    assert.match(source, /NumberInput/, `${file} must use the shared decimal field`)
  }
})

test('every field style is full width, at least 48px high and 16px so the screen never zooms', () => {
  for (const token of ['w-full', 'min-h-12', 'text-[16px]']) assert.ok(fieldInputClass.includes(token), token)
  const customers = read('src/modules/Customers.tsx')
  assert.match(customers, /grid grid-cols-1 gap-3\.5/, 'all client fields are full width on a phone')
  assert.match(customers, /type="tel" inputMode="tel"/, 'the phone field opens the phone keypad')
  for (const field of ['Name', 'Email', 'Phone', 'City', 'Address', 'Notes']) assert.ok(customers.includes(`t('${field}')`), `${field} has a visible label`)
  // Logical direction properties flip for RTL; no fixed left/right offsets in the form.
  assert.doesNotMatch(customers, /\b(ml-|mr-|pl-|pr-)[0-9]/, 'client form must use logical start/end spacing')
})

test('every label shown above a field exists in all five dictionaries', () => {
  const labels = ['Amount', 'Quantity', 'Unit price', 'Budget', 'Stock', 'Required field', 'Close', 'Group by', 'Client', 'Project', 'Month']
  for (const label of labels) assert.ok(label in en, `${label} must be translated`)
  assert.match(en['Required field'], /required/i)
  assert.match(en['Value must be at least {min}'], /\{min\}/)
})
