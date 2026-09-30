import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync('src/index.css', 'utf8')

function block(start: string, end: string): string {
  const from = css.indexOf(start)
  assert.ok(from >= 0, `missing ${start}`)
  const to = end ? css.indexOf(end, from) : css.length
  return css.slice(from, to)
}
const theme = block('@theme {', '\n}')
const dark = block(':root[data-theme="dark"] {', '\n}')

function tokens(source: string): Record<string, string> {
  return Object.fromEntries([...source.matchAll(/--(?:color-)?([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)].map(match => [match[1], match[2].toLowerCase()]))
}
const light = tokens(theme)
const darkTokens = tokens(dark)

/** WCAG 2.x relative luminance and contrast ratio. */
const luminance = (hex: string) => {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
  const [r, g, b] = channels.map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const PANELS = ['brand-50', 'good-50', 'warn-50', 'serious-50', 'info-50']
const TEXT_ON_CONTENT = ['ink', 'muted', 'faint']

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => (entry.isDirectory() ? sources(join(directory, entry.name)) : [join(directory, entry.name)]))
}

test('every text tone reaches WCAG AA on the surfaces it is actually used on', () => {
  const report: string[] = []
  for (const surface of ['surface', 'canvas']) {
    for (const tone of TEXT_ON_CONTENT) {
      const ratio = contrast(light[tone], light[surface])
      report.push(`${tone} on ${surface} = ${ratio.toFixed(2)}`)
      assert.ok(ratio >= 4.5, `light: ${tone} on ${surface} is ${ratio.toFixed(2)}:1`)
    }
  }
  // Secondary text also lands inside the tinted panels, so it has to pass there too.
  for (const panel of PANELS) {
    for (const tone of ['muted', 'faint']) {
      const ratio = contrast(light[tone], light[panel])
      report.push(`${tone} on ${panel} = ${ratio.toFixed(2)}`)
      assert.ok(ratio >= 4.5, `light: ${tone} on ${panel} is ${ratio.toFixed(2)}:1`)
    }
  }
  // Status text keeps its own tinted background.
  for (const [tone, panel] of [['warn', 'warn-50'], ['serious', 'serious-50']] as const) {
    const ratio = contrast(light[tone], light[panel])
    report.push(`${tone} on ${panel} = ${ratio.toFixed(2)}`)
    assert.ok(ratio >= 4.5, `light: ${tone} on ${panel} is ${ratio.toFixed(2)}:1`)
  }
  // Brand text appears on the plain surfaces and on the brand chip it colours.
  for (const [tone, surface] of [['brand', 'surface'], ['brand-700', 'surface'], ['brand-700', 'brand-50'], ['brand-700', 'brand-100']] as const) {
    const ratio = contrast(light[tone], light[surface])
    report.push(`${tone} on ${surface} = ${ratio.toFixed(2)}`)
    assert.ok(ratio >= 4.5, `light: ${tone} on ${surface} is ${ratio.toFixed(2)}:1`)
  }
  // White on the action colours.
  for (const tone of ['brand', 'emerald-brand', 'navy']) {
    const ratio = contrast('#ffffff', light[tone])
    report.push(`white on ${tone} = ${ratio.toFixed(2)}`)
    assert.ok(ratio >= 4.5, `white on ${tone} is ${ratio.toFixed(2)}:1`)
  }
  assert.ok(report.length >= 20)
})

test('the dark theme reaches WCAG AA as well', () => {
  for (const surface of ['surface', 'canvas']) {
    for (const tone of TEXT_ON_CONTENT) {
      const ratio = contrast(darkTokens[tone], darkTokens[surface])
      assert.ok(ratio >= 4.5, `dark: ${tone} on ${surface} is ${ratio.toFixed(2)}:1`)
    }
  }
  for (const panel of PANELS) {
    for (const tone of ['muted', 'faint']) {
      const ratio = contrast(darkTokens[tone], darkTokens[panel])
      assert.ok(ratio >= 4.5, `dark: ${tone} on ${panel} is ${ratio.toFixed(2)}:1`)
    }
  }
  const link = '#93b7ff' // the dark-mode value of text-brand / text-brand-700
  for (const surface of ['surface', 'canvas', ...PANELS]) {
    const ratio = contrast(link, darkTokens[surface])
    assert.ok(ratio >= 4.5, `dark: link on ${surface} is ${ratio.toFixed(2)}:1`)
  }
  // Sidebar text sits on the dark navy in both light and dark mode.
  for (const surface of ['sidebar', 'sidebar-hover']) {
    for (const tone of ['sidebar-ink', 'sidebar-faint']) {
      const ratio = contrast(light[tone], light[surface])
      assert.ok(ratio >= 4.5, `sidebar: ${tone} on ${surface} is ${ratio.toFixed(2)}:1`)
    }
  }
})

test('interactive controls are at least 48 px, and no text sits on a hover-only shade', () => {
  // The rules are deliberately unlayered so they win over utility classes such as h-7.
  assert.match(css, /button,\n\[role='button'\],\nselect,\nsummary,\ninput:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\),\ntextarea \{\n  min-height: 48px;/)
  assert.match(css, /button,\n\[role='button'\],\nselect \{\n  min-width: 48px;/)
  assert.match(css, /input\[type='checkbox'\],\ninput\[type='radio'\] \{\n  min-height: 1\.5rem;/)
  // A checkbox keeps its size, so its row carries the 48 px tap area.
  for (const file of ['src/components/DocumentOptions.tsx', 'src/components/PreferencesPanel.tsx', 'src/components/SecurityPanel.tsx', 'src/components/SubscriptionRemindersPanel.tsx', 'src/modules/Settings.tsx', 'src/modules/Subscriptions.tsx']) {
    const source = readFileSync(file, 'utf8')
    const withCheckbox = source.split('\n').filter(line => line.includes("type=\"checkbox\""))
    const wrapped = source.split('<label').filter(chunk => chunk.slice(0, chunk.indexOf('>')).includes('min-h-12') && chunk.slice(0, 400).includes("type=\"checkbox\""))
    assert.equal(wrapped.length, withCheckbox.length, `${file}: ${withCheckbox.length} checkbox rows but ${wrapped.length} are 48 px tall`)
  }
  // Every colour utility that uses a project-owned token resolves to a real
  // variable: `bg-good-500` silently rendered nothing because only `--color-good`
  // and `--color-good-50` exist (Tailwind ignores unknown utilities).
  const custom = new Set(['brand', 'good', 'warn', 'serious', 'info', 'emerald', 'navy', 'ink', 'canvas', 'surface', 'line', 'muted', 'faint', 'sidebar'])
  const missing: string[] = []
  for (const file of sources('src')) {
    if (!/\.tsx?$/.test(file)) continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\b(?:bg|text|border|ring|divide)-(brand|good|warn|serious|info|emerald|navy|ink|canvas|surface|line|muted|faint|sidebar)(?:-(\d{2,3}))?\b/g)) {
      const base = match[1]
      const shade = match[2]
      if (custom.has(base) && shade && !(`${base}-${shade}` in light)) missing.push(`${file}: ${match[0]}`)
    }
  }
  assert.deepEqual(missing, [], 'these utilities have no matching colour variable')

  // `bg-brand-100` is only ever a hover shade: no text token is placed on it.
  const offenders: string[] = []
  for (const file of sources('src')) {
    if (!/\.(tsx?|css)$/.test(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (/\bbg-brand-100\b/.test(line) && !/hover:bg-brand-100/.test(line)) offenders.push(file)
    }
  }
  assert.deepEqual(offenders, [], 'bg-brand-100 must stay a hover-only shade')
})
