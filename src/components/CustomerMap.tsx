import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { FileText, Image as ImageIcon, Loader2, MapPin, Palette, X } from 'lucide-react'
import { showAlert } from '../lib/dialogs'
import { t, usePreferences } from '../i18n'
import { formatDate, number } from '../lib/format'
import { DEFAULT_MAP_COLOR, darkenMapColor, mapColorText, tintMapColor } from '../lib/map-color'
import { todayISO } from '../lib/subscriptions'
import { buildCustomerMapSvg, rasterizeCustomerMap } from '../lib/customer-map-export'
import { MOROCCO_REGION_POLYGONS } from '../lib/morocco-regions'
import { shareFile } from '../lib/share-file'
import {
  customerLocationCategory,
  customerLocationKey,
  moroccanCityCoordinates,
  normalizeLocationName,
  US_STATE_TILE_LAYOUT,
  usStateCode,
  usStateName,
} from '../lib/customer-location'
import type { Customer } from '../store/types'

interface CustomerMapProps {
  customers: Customer[]
  onSelectLocation: (locationKey: string) => void
}

interface CityGroup {
  key: string
  name: string
  latitude: number
  longitude: number
  customers: Customer[]
}

interface UnmappedGroup {
  key: string
  label: string
  customers: Customer[]
}

const MAP_WIDTH = 500
const MAP_HEIGHT = 500
const MAP_BOUNDS = { west: -17.25, east: -0.85, south: 20.6, north: 36.05 }
const MAP_PADDING = 20
const MAP_COS_LATITUDE = Math.cos(((MAP_BOUNDS.south + MAP_BOUNDS.north) / 2) * Math.PI / 180)
const MAP_PROJECTED_WIDTH = (MAP_BOUNDS.east - MAP_BOUNDS.west) * MAP_COS_LATITUDE
const MAP_PROJECTED_HEIGHT = MAP_BOUNDS.north - MAP_BOUNDS.south
const MAP_SCALE = Math.min(
  (MAP_WIDTH - MAP_PADDING * 2) / MAP_PROJECTED_WIDTH,
  (MAP_HEIGHT - MAP_PADDING * 2) / MAP_PROJECTED_HEIGHT,
)
const MAP_OFFSET_X = (MAP_WIDTH - MAP_PROJECTED_WIDTH * MAP_SCALE) / 2
const MAP_OFFSET_Y = (MAP_HEIGHT - MAP_PROJECTED_HEIGHT * MAP_SCALE) / 2

function project(longitude: number, latitude: number) {
  return {
    x: MAP_OFFSET_X + (longitude - MAP_BOUNDS.west) * MAP_COS_LATITUDE * MAP_SCALE,
    y: MAP_OFFSET_Y + (MAP_BOUNDS.north - latitude) * MAP_SCALE,
  }
}

function regionPath(points: readonly [number, number][]) {
  return points.map(([longitude, latitude], index) => {
    const { x, y } = project(longitude, latitude)
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ') + ' Z'
}

function activateOnKey(event: KeyboardEvent<SVGGElement>, onActivate: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onActivate()
  }
}

function locationName(customer: Customer, language: ReturnType<typeof usePreferences>['language']): string {
  const tr = (key: string) => t(key, {}, language)
  if (customer.country === 'MA') return `${tr('Morocco')} · ${customer.city.trim() || tr('City not set')}`
  if (customer.country === 'US') return `${tr('United States')} · ${customer.state ? tr(usStateName(customer.state)) : tr('State not set')}`
  if (customer.country === 'other') return customer.countryName?.trim() || tr('Other')
  return customerLocationCategory(customer, tr)
}

function cityOffsets(city: string): [number, number] {
  // Close city pairs (Rabat/Salé, Tangier/Tétouan, Fes/Meknes) get tiny visual
  // separation so their count markers remain independently clickable.
  const key = normalizeLocationName(city)
  const offsets: Record<string, [number, number]> = {
    'sale': [13, 11], 'rabat': [-13, -8], 'kenitra': [-12, 11], 'mohammedia': [13, -10],
    'tangier': [-10, -10], 'tetouan': [13, 8], 'fes': [10, -10], 'meknes': [-11, 10],
  }
  return offsets[key] || [0, 0]
}

function useMapGroups(customers: Customer[], language: ReturnType<typeof usePreferences>['language']) {
  return useMemo(() => {
    const cities = new Map<string, CityGroup>()
    const states = new Map<string, Customer[]>()
    const unmapped = new Map<string, UnmappedGroup>()

    const addUnmapped = (customer: Customer) => {
      const key = customerLocationKey(customer)
      const group = unmapped.get(key) || { key, label: locationName(customer, language), customers: [] }
      group.customers.push(customer)
      unmapped.set(key, group)
    }

    for (const customer of customers) {
      if (customer.country === 'MA') {
        const coordinates = moroccanCityCoordinates(customer.city)
        if (!coordinates) { addUnmapped(customer); continue }
        const key = customerLocationKey(customer)
        const group = cities.get(key) || {
          key, name: customer.city.trim(), latitude: coordinates.latitude, longitude: coordinates.longitude, customers: [],
        }
        group.customers.push(customer)
        cities.set(key, group)
      } else if (customer.country === 'US') {
        const code = usStateCode(customer.state || '')
        if (!code) { addUnmapped(customer); continue }
        states.set(code, [...(states.get(code) || []), customer])
      } else addUnmapped(customer)
    }

    return {
      cities: [...cities.values()].sort((a, b) => a.name.localeCompare(b.name)),
      states,
      unmapped: [...unmapped.values()].sort((a, b) => a.label.localeCompare(b.label)),
    }
  }, [customers, language])
}

export default function CustomerMap({ customers, onSelectLocation }: CustomerMapProps) {
  const language = usePreferences().language
  const { cities, states, unmapped } = useMapGroups(customers, language)
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'image' | 'pdf' | null>(null)
  const [mapColor, setMapColor] = useState(DEFAULT_MAP_COLOR)
  const mapShade = darkenMapColor(mapColor)
  const mapTint = tintMapColor(mapColor)
  const mapTextColor = mapColorText(mapTint)
  const selectedCity = cities.find(city => city.key === selectedLocationKey) || null
  const mappedMoroccoCount = cities.reduce((total, point) => total + point.customers.length, 0)
  const mappedUsCount = [...states.values()].reduce((total, group) => total + group.length, 0)
  const unmappedCustomerCount = unmapped.reduce((total, group) => total + group.customers.length, 0)
  const regionPaths = useMemo(() => MOROCCO_REGION_POLYGONS.map(region => ({
    name: region.name,
    path: regionPath(region.points),
  })), [])

  async function exportMap(kind: 'image' | 'pdf') {
    setExporting(kind)
    try {
      const exportCities = cities.map(point => {
        const projected = project(point.longitude, point.latitude)
        const [dx, dy] = cityOffsets(point.name)
        return { name: point.name, x: projected.x + dx, y: projected.y + dy, count: number(point.customers.length) }
      })
      const exportStates = US_STATE_TILE_LAYOUT.map(([code, column, row]) => {
        const count = states.get(code)?.length || 0
        return { code, column, row, count: number(count), hasClients: count > 0 }
      })
      const svg = buildCustomerMapSvg({
        title: t('Client map'),
        generatedDate: formatDate(todayISO(), false, language),
        clientsLabel: t('Clients'),
        moroccoTitle: t('Morocco'),
        unitedStatesTitle: t('United States'),
        citiesTitle: t('Clients by Moroccan city'),
        unitedStatesCaption: t('U.S. state tile map'),
        unmappedTitle: t('Locations not plotted'),
        unmappedMoreLabel: t('More locations: {count}', { count: Math.max(0, unmapped.length - 24) }),
        privacyNotice: t('This offline map uses saved cities and states only; it never shows exact addresses.'),
        attribution: t('Boundary data: geoBoundaries · CC BY 4.0'),
        totalCount: number(customers.length),
        mapColor,
        moroccoCount: number(mappedMoroccoCount),
        unitedStatesCount: number(mappedUsCount),
        unmappedCount: `${number(unmappedCustomerCount)} ${t('Clients')}`,
        regions: regionPaths,
        cities: exportCities,
        states: exportStates,
        unmapped: unmapped.map(group => ({ label: group.label, count: number(group.customers.length) })),
      })
      const { canvas, png } = await rasterizeCustomerMap(svg)
      const fileBase = `fatorati-client-map-${todayISO()}`
      if (kind === 'image') {
        await shareFile(`${fileBase}.png`, png, 'image/png')
      } else {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF({ compress: true, orientation: 'landscape', unit: 'mm', format: 'a4' })
        pdf.addImage(canvas, 'PNG', 0, 0, 297, 210, undefined, 'FAST')
        await shareFile(`${fileBase}.pdf`, new Uint8Array(pdf.output('arraybuffer')) as Uint8Array<ArrayBuffer>, 'application/pdf')
      }
    } catch {
      await showAlert(t('Map export failed. Please try again.'))
    } finally {
      setExporting(null)
    }
  }

  return (
    <section className="space-y-4" aria-label={t('Client map')}>
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-ink"><MapPin className="h-4 w-4 text-brand" />{t('Client map')}</p>
          <p className="mt-1">{t('This offline map uses saved cities and states only; it never shows exact addresses.')}</p>
          <p className="mt-1 text-[10px] text-faint">{t('Boundary data: geoBoundaries · CC BY 4.0')}</p>
          {customers.length > 0 && <p className="mt-1">{t('Tap a Moroccan city or U.S. state to filter clients.')}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <label className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink">
            <Palette className="h-4 w-4 text-brand" />
            <span>{t('Map color')}</span>
            <span className="font-mono text-[10px] text-muted">{mapColor.toUpperCase()}</span>
            <input type="color" disabled={exporting !== null} aria-label={t('Map color')} title={mapColor.toUpperCase()} value={mapColor} onChange={event => setMapColor(event.currentTarget.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
          </label>
          <button type="button" disabled={exporting !== null} aria-busy={exporting === 'image'} onClick={() => void exportMap('image')} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:bg-brand-50 disabled:cursor-wait disabled:opacity-50">
            {exporting === 'image' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4 text-brand" />}
            {exporting === 'image' ? t('Exporting...') : t('Export image')}
          </button>
          <button type="button" disabled={exporting !== null} aria-busy={exporting === 'pdf'} onClick={() => void exportMap('pdf')} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-brand px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-wait disabled:opacity-50">
            {exporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {exporting === 'pdf' ? t('Exporting...') : t('Export PDF')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <article className="min-w-0 rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div><h2 className="text-[14px] font-bold text-ink">{t('Morocco')}</h2><p className="text-[12px] text-muted">{t('Moroccan city map')}</p></div>
              <span style={{ backgroundColor: mapTint, color: mapTextColor }} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">{number(mappedMoroccoCount)} {t('Clients')}</span>
            </header>
            <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label={t('Map of Moroccan cities')} className="mx-auto block h-auto w-full max-w-[500px] overflow-hidden rounded-lg">
              <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#ffffff" />
              <g fill={mapColor} className="customer-map-fill" stroke="#ffffff" strokeLinejoin="round" strokeWidth="1.25">
                {regionPaths.map((region, index) => <path key={region.name} d={region.path} className="customer-map-region" style={{ animationDelay: `${index * 18}ms` }} />)}
              </g>
              {cities.map(point => {
                const projected = project(point.longitude, point.latitude)
                const [dx, dy] = cityOffsets(point.name)
                const x = projected.x + dx, y = projected.y + dy
                const count = point.customers.length
                const isSelected = selectedLocationKey === point.key
                const select = () => setSelectedLocationKey(current => current === point.key ? null : point.key)
                return <g key={point.key} role="button" tabIndex={0} aria-pressed={isSelected} aria-label={t('Show clients in {location}', { location: point.name })} onClick={select} onKeyDown={event => activateOnKey(event, select)} className={`customer-map-marker ${isSelected ? 'customer-map-marker-selected' : ''} cursor-pointer outline-none`}>
                  <circle cx={x} cy={y} r="28" fill="transparent" />
                  <circle className="customer-map-marker-halo" cx={x} cy={y} r={isSelected ? 10 : 8.5} fill="#ffffff" opacity="0.26" />
                  <circle cx={x} cy={y} r="5.5" fill="#ffffff" stroke={isSelected ? mapShade : darkenMapColor(mapColor, 0.78)} strokeWidth={isSelected ? 3 : 2} />
                  <title>{t('{count} clients in {location}', { count, location: point.name })}</title>
                </g>
              })}
            </svg>
            {selectedCity && <div role="region" aria-live="polite" aria-label={t('{count} clients in {location}', { count: selectedCity.customers.length, location: selectedCity.name })} className="customer-map-panel mt-3 rounded-lg border border-brand/20 bg-brand-50/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[13px] font-semibold text-ink">{t('{count} clients in {location}', { count: selectedCity.customers.length, location: selectedCity.name })}</h3>
                  <p className="mt-0.5 text-[11px] text-muted">{t('Morocco')}</p>
                </div>
                <button type="button" aria-label={t('Close')} onClick={() => setSelectedLocationKey(null)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="mt-2 divide-y divide-brand/10">
                {selectedCity.customers.slice(0, 3).map(customer => {
                  const contact = [customer.phone, customer.email].filter(Boolean).join(' · ')
                  return <li key={customer.id} className="py-2 first:pt-0 last:pb-0">
                    <p className="text-[12px] font-medium text-ink">{customer.name}</p>
                    {contact && <p className="mt-0.5 break-all text-[11px] text-muted">{contact}</p>}
                  </li>
                })}
              </ul>
              <button type="button" onClick={() => onSelectLocation(selectedCity.key)} className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-brand px-3 py-2 text-[12px] font-semibold text-white hover:bg-brand-700">
                {t('See more')}
              </button>
            </div>}
            {cities.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">
              {cities.map(point => <button key={point.key} onClick={() => setSelectedLocationKey(point.key)} className="customer-map-location-chip inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink hover:border-brand/40 hover:bg-brand-50">
                <span>{point.name}</span><span style={{ backgroundColor: mapTint, color: mapTextColor }} className="rounded-full bg-canvas px-1.5 text-[10px] font-semibold tnum">{number(point.customers.length)}</span>
              </button>)}
            </div> : <p className="mt-3 text-[12px] text-muted">{t('No mapped clients in Morocco yet')}</p>}
          </article>

          <article className="min-w-0 rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <header className="mb-3 flex items-center justify-between gap-3">
              <div><h2 className="text-[14px] font-bold text-ink">{t('United States')}</h2><p className="text-[12px] text-muted">{t('U.S. state tile map')}</p></div>
              <span style={{ backgroundColor: mapTint, color: mapTextColor }} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">{number(mappedUsCount)} {t('Clients')}</span>
            </header>
            <div className="overflow-x-auto pb-1">
              <div className="grid min-w-[690px] grid-cols-[repeat(13,minmax(0,1fr))] gap-1 sm:gap-1.5" dir="ltr" role="group" aria-label={t('U.S. state tile map')}>
                {US_STATE_TILE_LAYOUT.map(([code, column, row]) => {
                const clientRows = states.get(code) || []
                const count = clientRows.length
                const name = usStateName(code)
                const select = () => onSelectLocation(`US:${code}`)
                return <button
                  key={code}
                  type="button"
                  style={{ gridColumn: column + 1, gridRow: row + 1, ...(count ? { backgroundColor: mapTint, borderColor: mapShade, color: mapTextColor } : {}) }}
                  aria-label={t('Show clients in {location}', { location: name })}
                  title={t('{count} clients in {location}', { count, location: name })}
                  onClick={select}
                  className={`customer-map-state relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-md border text-[9px] font-bold transition-colors sm:text-[10px] ${count ? 'border-brand/30 bg-brand-50 text-brand-700 hover:border-brand hover:bg-brand-100' : 'border-line bg-canvas text-muted hover:border-brand/40 hover:bg-brand-50'}`}
                >
                  <span>{code}</span>
                  {count > 0 && <span style={{ backgroundColor: mapColor, color: mapColorText(mapColor) }} className="absolute -right-1 -top-1 min-w-4 rounded-full bg-brand px-1 text-[8px] leading-4 text-white tnum">{count > 99 ? '99+' : number(count)}</span>}
                </button>
                })}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-faint">{t('Alaska and Hawaii are shown in insets.')}</p>
          </article>
        </div>

      {unmapped.length > 0 && <article className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-[14px] font-bold text-ink">{t('Locations not plotted')}</h2>
        <p className="mt-1 text-[12px] text-muted">{t('These saved locations are still available in the customer list.')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {unmapped.map(group => <button key={group.key} onClick={() => onSelectLocation(group.key)} className="customer-map-location-chip inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink hover:border-brand/40 hover:bg-brand-50">
            <span>{group.label}</span><span className="rounded-full bg-canvas px-1.5 text-[10px] font-semibold tnum">{number(group.customers.length)}</span>
          </button>)}
        </div>
      </article>}
    </section>
  )
}
