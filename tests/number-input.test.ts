import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { acceptNumberText, formatNumberText, numberError, numberInputChange, parseNumberText } from '../src/lib/number-input'
import NumberInput from '../src/components/NumberInput'

test('an empty field has no value: neither "" nor a lone separator become 0', () => {
  assert.equal(parseNumberText(''), null)
  assert.equal(parseNumberText('.'), null)
  assert.equal(parseNumberText(','), null)
  assert.equal(numberInputChange('', '').value, null)
})

test('typing "12" and deleting both digits leaves the field empty, not 0', () => {
  // The exact sequence of input events a phone keyboard produces.
  let state = { text: '', value: null as number | null }
  for (const raw of ['1', '12']) {
    state = { ...numberInputChange(state.text, raw), value: numberInputChange(state.text, raw).value }
    assert.equal(state.value, Number(raw))
  }
  assert.equal(state.text, '12')
  state = numberInputChange(state.text, '1')
  assert.equal(state.text, '1')
  state = numberInputChange(state.text, '')
  assert.equal(state.text, '')
  assert.equal(state.value, null)
  // Leaving the field with the keyboard (blur) keeps it empty instead of writing 0.
  assert.equal(formatNumberText(state.value, { integer: false }), '')
})

test('"." and "," are both accepted as the decimal separator; letters are blocked', () => {
  assert.equal(numberInputChange('', '12,5').value, 12.5)
  assert.equal(numberInputChange('', '12.5').value, 12.5)
  assert.equal(numberInputChange('12', '12abc').text, '12')
  assert.equal(numberInputChange('', 'abc').text, '')
  assert.equal(numberInputChange('', '1.2.3').text, '1.23')
  assert.equal(numberInputChange('', '٣٤').value, 34)
  // Integer-only fields (Stock) reject separators entirely.
  assert.equal(numberInputChange('', '12,5', true).text, '125')
  assert.equal(numberInputChange('', '1.5', true).text, '15')
})

test('text is formatted on blur without grouping and stays empty when empty', () => {
  assert.equal(formatNumberText(12), '12')
  assert.equal(formatNumberText(1234.5), '1234.5')
  assert.equal(formatNumberText(2.5000000001), '2.5')
  assert.equal(formatNumberText(3.6, { integer: true }), '4')
  assert.equal(formatNumberText(null), '')
  assert.equal(formatNumberText(12, { digits: 'arab' }), '١٢')
})

test('required fields report a clear error and optional fields allow empty', () => {
  assert.equal(numberError(null, { required: true }), 'Required field')
  assert.equal(numberError(null, {}), null)
  assert.equal(numberError(0, { required: true, min: 0 }), null)
  assert.equal(numberError(0, { required: true, min: 0.01 }), 'Value must be at least {min}')
  assert.equal(numberError(-5, { min: 0 }), 'Value must be at least {min}')
})

test('the field renders a visible label, decimal keypad and no fake zero', () => {
  const empty = renderToStaticMarkup(createElement(NumberInput, { label: 'Amount (MAD)', value: null, onChange: () => {} }))
  assert.match(empty, /Amount \(MAD\)/)
  assert.match(empty, /inputmode="decimal"/i)
  assert.match(empty, /<input[^>]*value=""/)
  const integer = renderToStaticMarkup(createElement(NumberInput, { label: 'Stock', value: 3, onChange: () => {}, integer: true }))
  assert.match(integer, /inputmode="numeric"/i)
  assert.match(integer, /value="3"/)
  const error = renderToStaticMarkup(createElement(NumberInput, { label: 'Amount', value: null, onChange: () => {}, error: 'Required field' }))
  assert.match(error, /role="alert"/)
  assert.match(error, /This field is required/)
})

test('a real DOM input can be emptied while typing (no 0 replacement)', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' })
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  // Node 22 exposes navigator as a getter-only global.
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')
  const values: (number | null)[] = []
  const container = dom.window.document.getElementById('root')!
  const root = createRoot(container)
  await act(async () => {
    root.render(createElement(NumberInput, { label: 'Amount', value: null, onChange: (next: number | null) => values.push(next) }))
  })
  const input = container.querySelector('input')!
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!
  const type = async (text: string) => {
    await act(async () => {
      setter.call(input, text)
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
  }
  await type('1')
  assert.equal(input.value, '1')
  await type('12')
  assert.equal(input.value, '12')
  await type('1')
  assert.equal(input.value, '1')
  await type('')
  assert.equal(input.value, '')
  assert.equal(values.at(-1), null)
  assert.equal(values.includes(0), false, 'clearing a field must never produce 0')
  await act(async () => { input.dispatchEvent(new dom.window.FocusEvent('blur', { bubbles: true })) })
  assert.equal(input.value, '')
  await act(async () => { root.unmount() })
})
