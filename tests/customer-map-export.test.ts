import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCustomerMapSvg, CUSTOMER_MAP_EXPORT_HEIGHT, CUSTOMER_MAP_EXPORT_WIDTH } from '../src/lib/customer-map-export'

function sampleData() {
  return {
    title: 'Client map',
    generatedDate: '04/10/2026',
    clientsLabel: 'Clients',
    moroccoTitle: 'Morocco',
    unitedStatesTitle: 'United States',
    citiesTitle: 'Clients by Moroccan city',
    unitedStatesCaption: 'U.S. state tile map',
    unmappedTitle: 'Locations not plotted',
    unmappedMoreLabel: 'More locations: 2',
    privacyNotice: 'No exact addresses',
    attribution: 'geoBoundaries · CC BY 4.0',
    totalCount: '12',
    mapColor: '#d14f2a',
    moroccoCount: '7',
    unitedStatesCount: '3',
    unmappedCount: '2 clients',
    regions: [{ path: 'M 0 0 L 10 0 L 10 10 Z' }],
    cities: [{ name: 'A&B <script>alert(1)</script>', x: 220, y: 140, count: '7' }],
    states: [{ code: 'NY', column: 9, row: 1, count: '3', hasClients: true }],
    unmapped: [{ label: 'Other · Rabat & Salé', count: '2' }],
  }
}

test('client map export is a standalone printable SVG with both map layers and location counts', () => {
  const svg = buildCustomerMapSvg(sampleData())
  assert.match(svg, new RegExp(`width="${CUSTOMER_MAP_EXPORT_WIDTH}"`))
  assert.match(svg, new RegExp(`height="${CUSTOMER_MAP_EXPORT_HEIGHT}"`))
  assert.match(svg, /fill="#d14f2a"/)

  assert.match(svg, /geoBoundaries · CC BY 4\.0/)
  assert.match(svg, /<text[^>]*>NY<\/text>/)
  assert.match(svg, /A&amp;B &lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(svg, /Other · Rabat &amp; Salé/)
  assert.doesNotMatch(svg, /<script>/)
})

test('client map export includes a continuation label when there are more than 24 unplotted locations', () => {
  const data = sampleData()
  data.unmapped = Array.from({ length: 25 }, (_, index) => ({ label: `Location ${index + 1}`, count: '1' }))
  const svg = buildCustomerMapSvg(data)
  assert.match(svg, /More locations: 2/)
  assert.match(svg, /Location 24/)
  assert.doesNotMatch(svg, /Location 25/)
})
