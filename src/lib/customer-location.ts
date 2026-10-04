import type { Customer } from '../store/types'

export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
] as const

/** Common suggestions only; the Moroccan city input remains free-form. */
export const MOROCCAN_CITIES = [
  'Agadir', 'Al Hoceima', 'Beni Mellal', 'Casablanca', 'Dakhla', 'El Jadida', 'Essaouira',
  'Fes', 'Guelmim', 'Kenitra', 'Khouribga', 'Laayoune', 'Larache', 'Marrakech', 'Meknes',
  'Mohammedia', 'Nador', 'Ouarzazate', 'Oujda', 'Rabat', 'Safi', 'Sale', 'Tangier', 'Taroudant',
  'Taza', 'Temara', 'Tetouan',
]

/** Offline city coordinates. These are approximate city centres, never street addresses. */
export const MOROCCAN_CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  agadir: { latitude: 30.4278, longitude: -9.5981 },
  'al hoceima': { latitude: 35.2517, longitude: -3.9372 },
  'beni mellal': { latitude: 32.3373, longitude: -6.3498 },
  casablanca: { latitude: 33.5731, longitude: -7.5898 },
  dakhla: { latitude: 23.6848, longitude: -15.957 },
  'el jadida': { latitude: 33.2316, longitude: -8.5007 },
  essaouira: { latitude: 31.5085, longitude: -9.7595 },
  fes: { latitude: 34.0331, longitude: -5.0003 },
  fez: { latitude: 34.0331, longitude: -5.0003 },
  guelmim: { latitude: 28.987, longitude: -10.0574 },
  kenitra: { latitude: 34.261, longitude: -6.5802 },
  khouribga: { latitude: 32.8811, longitude: -6.9063 },
  laayoune: { latitude: 27.1536, longitude: -13.2033 },
  'el aaiun': { latitude: 27.1536, longitude: -13.2033 },
  larache: { latitude: 35.1932, longitude: -6.1557 },
  marrakech: { latitude: 31.6295, longitude: -7.9811 },
  marrakesh: { latitude: 31.6295, longitude: -7.9811 },
  meknes: { latitude: 33.8935, longitude: -5.5473 },
  mohammedia: { latitude: 33.6866, longitude: -7.383 },
  nador: { latitude: 35.1681, longitude: -2.9335 },
  ouarzazate: { latitude: 30.9189, longitude: -6.8934 },
  oujda: { latitude: 34.6814, longitude: -1.9086 },
  rabat: { latitude: 34.0209, longitude: -6.8416 },
  safi: { latitude: 32.2994, longitude: -9.2372 },
  sale: { latitude: 34.0331, longitude: -6.7985 },
  salé: { latitude: 34.0331, longitude: -6.7985 },
  tangier: { latitude: 35.7595, longitude: -5.834 },
  tanger: { latitude: 35.7595, longitude: -5.834 },
  taroudant: { latitude: 30.4703, longitude: -8.8769 },
  taza: { latitude: 34.21, longitude: -4.01 },
  temara: { latitude: 33.9287, longitude: -6.9063 },
  tetouan: { latitude: 35.5889, longitude: -5.3626 },
}

/** Tile-map positions in a familiar US state layout; AK and HI sit in the inset row. */
export const US_STATE_TILE_LAYOUT = [
  ['WA', 0, 0], ['MT', 2, 0], ['ND', 4, 0], ['MN', 5, 0], ['WI', 6, 0], ['MI', 7, 0],
  ['VT', 10, 0], ['NH', 11, 0], ['ME', 12, 0],
  ['OR', 0, 1], ['ID', 1, 1], ['SD', 3, 1], ['IA', 4, 1], ['IL', 5, 1], ['IN', 6, 1],
  ['OH', 7, 1], ['NY', 9, 1], ['MA', 10, 1],
  ['CA', 0, 2], ['NV', 1, 2], ['WY', 2, 2], ['NE', 3, 2], ['MO', 4, 2], ['KY', 5, 2],
  ['WV', 6, 2], ['PA', 8, 2], ['NJ', 9, 2], ['CT', 10, 2], ['RI', 11, 2],
  ['AZ', 1, 3], ['UT', 2, 3], ['CO', 3, 3], ['KS', 4, 3], ['AR', 5, 3], ['TN', 6, 3],
  ['VA', 7, 3], ['MD', 8, 3], ['DE', 9, 3],
  ['NM', 2, 4], ['OK', 3, 4], ['LA', 4, 4], ['MS', 5, 4], ['AL', 6, 4], ['DC', 7, 4],
  ['NC', 8, 4], ['SC', 9, 4], ['GA', 10, 4],
  ['TX', 3, 5], ['FL', 10, 5],
  ['AK', 0, 6], ['HI', 1, 6],
] as const satisfies readonly (readonly [string, number, number])[]

export function normalizeLocationName(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function usStateCode(value: string): string | null {
  const normalized = normalizeLocationName(value)
  return US_STATES.find(([code, name]) => normalizeLocationName(code) === normalized || normalizeLocationName(name) === normalized)?.[0] || null
}

export function usStateName(value: string): string {
  const code = usStateCode(value)
  return US_STATES.find(([abbreviation]) => abbreviation === code)?.[1] || value
}

export function moroccanCityCoordinates(city: string) {
  return MOROCCAN_CITY_COORDINATES[normalizeLocationName(city)] || null
}

function canonicalMoroccanCity(city: string): string {
  const normalized = normalizeLocationName(city)
  const aliases: Record<string, string> = { fez: 'fes', marrakesh: 'marrakech', tanger: 'tangier', 'el aaiun': 'laayoune' }
  return aliases[normalized] || normalized
}

export function customerLocationKey(customer: Pick<Customer, 'country' | 'countryName' | 'state' | 'city'>): string {
  if (customer.country === 'MA') return `MA:${canonicalMoroccanCity(customer.city)}`
  if (customer.country === 'US') return `US:${usStateCode(customer.state || '') || normalizeLocationName(customer.state || '')}`
  if (customer.country === 'other') return `other:${normalizeLocationName(customer.countryName || '')}`
  return `unknown:${normalizeLocationName(customer.state || '')}:${normalizeLocationName(customer.city)}`
}

type LocationTranslator = (key: string) => string
export function customerLocationCategory(
  customer: Pick<Customer, 'country' | 'countryName' | 'state' | 'city'>,
  tr: LocationTranslator,
): string {
  if (customer.country === 'MA') return `${tr('Morocco')} · ${customer.city.trim() || tr('City not set')}`
  if (customer.country === 'US') return `${tr('United States')} · ${customer.state ? tr(usStateName(customer.state)) : tr('State not set')}`
  if (customer.country === 'other') return customer.countryName?.trim() || tr('Other')
  const legacyLocation = [customer.state?.trim(), customer.city.trim()].filter(Boolean).join(' · ')
  return legacyLocation ? `${tr('Country not set')} · ${legacyLocation}` : tr('Location not set')
}
