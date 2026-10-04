import { test } from 'node:test'
import assert from 'node:assert/strict'
import { darkenMapColor, DEFAULT_MAP_COLOR, mapColorText, normalizeMapColor, tintMapColor } from '../src/lib/map-color'

test('map color helpers validate picker values and derive readable companion shades', () => {
  assert.equal(normalizeMapColor('#12ABef'), '#12abef')
  assert.equal(normalizeMapColor('transparent'), DEFAULT_MAP_COLOR)
  assert.equal(darkenMapColor('#ffffff'), '#9e9e9e')
  assert.equal(tintMapColor('#000000'), '#dbdbdb')
  assert.equal(mapColorText('#000000'), '#ffffff')
  assert.equal(mapColorText('#ffffff'), '#0b1220')
})
