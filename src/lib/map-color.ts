export const DEFAULT_MAP_COLOR = '#729a79'

/** Accepts only the six-digit colors produced by an HTML color picker. */
export function normalizeMapColor(value: string): string {
  return /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_MAP_COLOR
}

/** A darker companion shade for marker outlines and small labels. */
export function darkenMapColor(value: string, factor = 0.62): string {
  const color = normalizeMapColor(value)
  const channels = color.slice(1).match(/.{2}/g)!.map(channel => Math.round(parseInt(channel, 16) * factor))
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

/** Mixes the chosen color with white, keeping badges legible and print-friendly. */
export function tintMapColor(value: string, whiteAmount = 0.86): string {
  const color = normalizeMapColor(value)
  const channels = color.slice(1).match(/.{2}/g)!.map(channel => {
    const original = parseInt(channel, 16)
    return Math.round(original + (255 - original) * whiteAmount)
  })
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

/** Selects black or white text based on the chosen swatch's relative luminance. */
export function mapColorText(value: string): '#0b1220' | '#ffffff' {
  const color = normalizeMapColor(value)
  const [red, green, blue] = color.slice(1).match(/.{2}/g)!.map(channel => parseInt(channel, 16) / 255)
  const linear = (channel: number) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  const luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
  return luminance > 0.42 ? '#0b1220' : '#ffffff'
}
