import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  customerLocationKey,
  MOROCCAN_CITY_COORDINATES,
  moroccanCityCoordinates,
  US_STATES,
  US_STATE_TILE_LAYOUT,
  usStateCode,
} from '../src/lib/customer-location'
import { MOROCCO_REGION_POLYGONS } from '../src/lib/morocco-regions'

function isInsidePolygon(longitude: number, latitude: number, points: readonly [number, number][]): boolean {
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [x1, y1] = points[index]
    const [x2, y2] = points[previous]
    const crossesLatitude = (y1 > latitude) !== (y2 > latitude)
    const crossingLongitude = ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1
    if (crossesLatitude && longitude < crossingLongitude) inside = !inside
  }
  return inside
}

function isInsideMorocco(longitude: number, latitude: number): boolean {
  return MOROCCO_REGION_POLYGONS.some(region => isInsidePolygon(longitude, latitude, region.points))
}

test('the offline US tile map has one position for every supported state and DC', () => {
  const codes = US_STATE_TILE_LAYOUT.map(([code]) => code)
  assert.equal(new Set(codes).size, codes.length, 'no state tile overlaps another state')
  assert.deepEqual([...codes].sort(), US_STATES.map(([code]) => code).sort())
})

test('city and state lookup accepts accents and common English spellings', () => {
  assert.deepEqual(moroccanCityCoordinates('Tanger'), moroccanCityCoordinates('Tangier'))
  assert.deepEqual(moroccanCityCoordinates('Fès'), moroccanCityCoordinates('Fez'))
  assert.equal(usStateCode('California'), 'CA')
  assert.equal(usStateCode('NY'), 'NY')
})

test('Morocco is drawn as 12 closed administrative regions with all mapped city centers inside', () => {
  assert.equal(MOROCCO_REGION_POLYGONS.length, 12)
  const allPoints = MOROCCO_REGION_POLYGONS.flatMap(region => region.points)
  assert.ok(Math.min(...allPoints.map(([longitude]) => longitude)) < -17, 'the map includes the far southwest coast')
  assert.ok(Math.max(...allPoints.map(([longitude]) => longitude)) > -1.1, 'the map includes the northeastern edge')
  assert.ok(Math.min(...allPoints.map(([, latitude]) => latitude)) < 21, 'the map includes the southern edge')
  assert.ok(Math.max(...allPoints.map(([, latitude]) => latitude)) > 35.8, 'the map includes the northern coast')
  for (const region of MOROCCO_REGION_POLYGONS) {
    assert.ok(region.points.length > 3, `${region.name} has a complete polygon`)
    assert.deepEqual(region.points[0], region.points.at(-1), `${region.name} boundary is closed`)
  }

  const uniqueCities = new Map(Object.entries(MOROCCAN_CITY_COORDINATES).map(([name, point]) => [
    `${point.longitude},${point.latitude}`,
    { name, ...point },
  ]))
  for (const { name, longitude, latitude } of uniqueCities.values()) {
    assert.equal(isInsideMorocco(longitude, latitude), true, `${name} should be inside the regional map`)
  }
  assert.equal(isInsideMorocco(-10, 31), false, 'an Atlantic Ocean point should remain outside the regional map')
})

test('map marker keys match the customer directory location filters', () => {
  assert.equal(customerLocationKey({ country: 'MA', city: 'Fès', state: '', countryName: '' }), 'MA:fes')
  assert.equal(customerLocationKey({ country: 'MA', city: 'Fez', state: '', countryName: '' }), 'MA:fes')
  assert.equal(customerLocationKey({ country: 'US', city: '', state: 'California', countryName: '' }), 'US:CA')
})
