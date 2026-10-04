import { darkenMapColor, mapColorText, normalizeMapColor, tintMapColor } from './map-color'

export const CUSTOMER_MAP_EXPORT_WIDTH = 1600
export const CUSTOMER_MAP_EXPORT_HEIGHT = 1130

export interface CustomerMapExportData {
  title: string
  generatedDate: string
  clientsLabel: string
  moroccoTitle: string
  unitedStatesTitle: string
  citiesTitle: string
  unitedStatesCaption: string
  unmappedTitle: string
  unmappedMoreLabel: string
  privacyNotice: string
  attribution: string
  totalCount: string
  mapColor: string
  moroccoCount: string
  unitedStatesCount: string
  unmappedCount: string
  regions: readonly { path: string }[]
  cities: readonly { name: string; x: number; y: number; count: string }[]
  states: readonly { code: string; column: number; row: number; count: string; hasClients: boolean }[]
  unmapped: readonly { label: string; count: string }[]
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]!)
}

function text(x: number, y: number, value: string, size: number, color = '#0b1220', weight = 400, anchor = 'start') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(value)}</text>`
}

/** Builds a self-contained vector snapshot of the current client-location map. */
export function buildCustomerMapSvg(data: CustomerMapExportData): string {
  const mapColor = normalizeMapColor(data.mapColor)
  const mapShade = darkenMapColor(mapColor)
  const mapTint = tintMapColor(mapColor)
  const mapText = mapColorText(mapTint)
  const cityMarkers = data.cities.map((city, index) => {
    const markerNumber = String(index + 1).padStart(2, '0')
    return `<g class="map-export-marker"><circle cx="${city.x}" cy="${city.y}" r="11" fill="#ffffff" stroke="${mapShade}" stroke-width="2"/>${text(city.x, city.y + 3.5, markerNumber, 8.5, mapText, 700, 'middle')}</g>`
  }).join('')
  const cityRows = data.cities.map((city, index) => {
    const markerNumber = String(index + 1).padStart(2, '0')
    const column = index % 4
    const row = Math.floor(index / 4)
    const itemX = 68 + column * 170
    const itemY = 784 + row * 29
    return `<g class="map-export-city-row"><rect x="${itemX}" y="${itemY - 17}" width="23" height="22" rx="7" fill="${mapTint}"/>${text(itemX + 11.5, itemY - 2, markerNumber, 9, mapText, 700, 'middle')}${text(itemX + 30, itemY, city.name, 13, '#334155', 500)}${text(itemX + 164, itemY, city.count, 13, '#0b1220', 700, 'end')}</g>`
  }).join('')

  const regionShapes = data.regions.map(region => `<path d="${region.path}" fill="${mapColor}" stroke="#ffffff" stroke-linejoin="round" stroke-width="1.25"/>`).join('')
  const stateTiles = data.states.map(state => {
    const size = 44
    const gap = 8
    const x = 840 + state.column * (size + gap)
    const y = 285 + state.row * (size + gap)
    const hasClients = state.hasClients
    const fill = hasClients ? mapTint : '#f4f6f8'
    const stroke = hasClients ? mapShade : '#e1e6ec'
    const ink = hasClients ? mapText : '#64748b'
    return `<g><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="7" fill="${fill}" stroke="${stroke}"/><text x="${x + size / 2}" y="${y + 19}" text-anchor="middle" font-size="12" font-weight="700" fill="${ink}">${escapeXml(state.code)}</text><text x="${x + size / 2}" y="${y + 35}" text-anchor="middle" font-size="10" fill="${ink}">${escapeXml(state.count)}</text></g>`
  }).join('')

  const visibleUnmapped = data.unmapped.slice(0, 24)
  const unmappedRows = visibleUnmapped.map((group, index) => {
    const column = index % 3
    const row = Math.floor(index / 3)
    const x = 820 + column * 235
    const y = 766 + row * 25
    const label = group.label.length > 24 ? `${group.label.slice(0, 23)}…` : group.label
    return `${text(x, y, label, 12, '#475569', 500)}${text(x + 215, y, group.count, 12, '#0b1220', 700, 'end')}`
  }).join('')
  const moreUnmapped = data.unmapped.length > visibleUnmapped.length
    ? text(820, 977, data.unmappedMoreLabel, 12, '#64748b', 500)
    : ''

  const regionsWithMarkers = `${regionShapes}${cityMarkers}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CUSTOMER_MAP_EXPORT_WIDTH}" height="${CUSTOMER_MAP_EXPORT_HEIGHT}" viewBox="0 0 ${CUSTOMER_MAP_EXPORT_WIDTH} ${CUSTOMER_MAP_EXPORT_HEIGHT}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <style>text{font-family:Arial,Helvetica,sans-serif} .map-export-marker{vector-effect:non-scaling-stroke}</style>
    ${text(52, 68, data.title, 38, '#0b1220', 700)}
    ${text(52, 104, data.generatedDate, 17, '#64748b', 400)}
    ${text(1548, 70, `${data.totalCount} ${data.clientsLabel}`, 20, mapText, 700, 'end')}
    <rect x="40" y="140" width="730" height="880" rx="22" fill="#ffffff" stroke="#e5e8ee" stroke-width="2"/>
    <rect x="790" y="140" width="770" height="880" rx="22" fill="#ffffff" stroke="#e5e8ee" stroke-width="2"/>
    ${text(72, 192, data.moroccoTitle, 25, '#0b1220', 700)}
    ${text(738, 192, `${data.moroccoCount} ${data.clientsLabel}`, 16, mapText, 700, 'end')}
    <g transform="translate(155 205)">${regionsWithMarkers}</g>
    ${text(70, 748, data.citiesTitle, 16, '#334155', 700)}
    ${cityRows}
    ${text(824, 192, data.unitedStatesTitle, 25, '#0b1220', 700)}
    ${text(1520, 192, `${data.unitedStatesCount} ${data.clientsLabel}`, 16, mapText, 700, 'end')}
    ${text(824, 226, data.unitedStatesCaption, 14, '#64748b', 400)}
    ${stateTiles}
    ${text(820, 716, data.unmappedTitle, 16, '#334155', 700)}
    ${text(1520, 716, data.unmappedCount, 14, '#64748b', 600, 'end')}
    ${unmappedRows}
    ${moreUnmapped}
    <line x1="52" y1="1052" x2="1548" y2="1052" stroke="#e5e8ee" stroke-width="2"/>
    ${text(52, 1085, data.privacyNotice, 12, '#64748b', 400)}
    ${text(1548, 1085, data.attribution, 12, '#64748b', 400, 'end')}
  </svg>`
}

/** Rasterizes the standalone SVG at print-friendly resolution for PNG and PDF exports. */
export async function rasterizeCustomerMap(svg: string): Promise<{ canvas: HTMLCanvasElement; png: Uint8Array<ArrayBuffer> }> {
  const scale = 1.5
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Operation failed'))
      image.src = svgUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = CUSTOMER_MAP_EXPORT_WIDTH * scale
    canvas.height = CUSTOMER_MAP_EXPORT_HEIGHT * scale
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Operation failed')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Operation failed')), 'image/png')
    })
    const png = new Uint8Array(await pngBlob.arrayBuffer()) as Uint8Array<ArrayBuffer>
    return { canvas, png }
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
