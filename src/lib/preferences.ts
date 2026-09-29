import { Preferences } from '@capacitor/preferences'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export const languages = ['en', 'ar', 'fr', 'es', 'pt'] as const
export type Language = typeof languages[number]
/**
 * Currencies the app must always offer, even if an older phone WebView ships a
 * reduced Intl currency list. Symbols and decimal places come from Intl (CLDR).
 */
export const REQUIRED_CURRENCIES = ['MAD', 'EUR', 'USD', 'GBP', 'AED', 'SAR', 'DZD', 'TND', 'XOF', 'CAD'] as const
export interface DisplayPreferences {
  language: Language
  digits: 'latn' | 'arab'
  defaultCurrency: string
  dateFormat: 'auto' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  timeFormat: '12h' | '24h'
  timeZone: string
  firstDay: 0 | 1 | 6
  hijri: boolean
  theme: 'light' | 'dark' | 'system'
  accent: string
  spacing: 'compact' | 'comfortable'
  autoLock: 0 | 1 | 5 | 15
  secureScreen: boolean
  pdfColor: boolean
  updatedAt: number
}
export const PREFERENCE_KEY = 'fatorati.display.v2'
const phoneLanguage = typeof navigator === 'undefined' ? 'en' : navigator.language.split('-')[0]
export const defaultPreferences: DisplayPreferences = {
  language: languages.includes(phoneLanguage as Language) ? phoneLanguage as Language : 'en',
  digits: 'latn', defaultCurrency: 'MAD', dateFormat: 'auto', timeFormat: '24h',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', firstDay: 1,
  hijri: false, theme: 'light', accent: '#2563eb', spacing: 'comfortable',
  autoLock: 5, secureScreen: true, pdfColor: true, updatedAt: 0,
}
export function supportedValues(key: 'currency' | 'timeZone'): string[] {
  if (key === 'timeZone') return Intl.supportedValuesOf('timeZone')
  return currencyCodes()
}
/** Every offered currency: the WebView list plus the required offline set, never fetched online. */
export function currencyCodes(): string[] {
  let available: string[] = []
  try { available = Intl.supportedValuesOf('currency') } catch { available = [] }
  return [...new Set([...REQUIRED_CURRENCIES, ...available].filter(code => /^[A-Z]{3}$/.test(code)))].sort()
}
export function validCurrency(code: unknown): code is string {
  return typeof code === 'string' && /^[A-Z]{3}$/.test(code) && (currencyCodes().includes(code) || ['XTS', 'XXX'].includes(code))
}
export function validPreferences(value: unknown): value is DisplayPreferences {
  if (!value || typeof value !== 'object') return false
  const p = value as DisplayPreferences
  try { new Intl.DateTimeFormat('en', { timeZone: p.timeZone }).format() } catch { return false }
  return languages.includes(p.language) && ['latn','arab'].includes(p.digits) && validCurrency(p.defaultCurrency)
    && ['auto','DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD'].includes(p.dateFormat)
    && ['12h','24h'].includes(p.timeFormat) && typeof p.timeZone === 'string'
    && [0,1,6].includes(p.firstDay) && typeof p.hijri === 'boolean'
    && ['light','dark','system'].includes(p.theme) && /^#[0-9a-f]{6}$/i.test(p.accent)
    && ['compact','comfortable'].includes(p.spacing) && [0,1,5,15].includes(p.autoLock)
    && typeof p.secureScreen === 'boolean' && typeof p.pdfColor === 'boolean'
    && Number.isFinite(p.updatedAt) && p.updatedAt >= 0
}
let current: DisplayPreferences = { ...defaultPreferences }
const listeners = new Set<() => void>()
export const getPreferences = () => current
export const subscribePreferences = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const ScreenSecurity = registerPlugin<{ setSecure(options: { enabled: boolean }): Promise<void> }>('ScreenSecurity')
export function accentText(hex: string): '#000000' | '#ffffff' {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4)
  const l = rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722
  return (l+.05)/.05 >= 1.05/(l+.05) ? '#000000' : '#ffffff'
}
export function applyAppearance() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const dark = current.theme === 'dark' || (current.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  root.lang = current.language; root.dir = current.language === 'ar' ? 'rtl' : 'ltr'
  root.dataset.theme = dark ? 'dark' : 'light'; root.dataset.spacing = current.spacing
  root.dataset.accent = current.accent.toLowerCase() === defaultPreferences.accent ? 'original' : 'custom'
  root.style.setProperty('--accent', current.accent)
  root.style.setProperty('--accent-ink', accentText(current.accent))
  const hover = current.accent.toLowerCase() === '#2563eb' ? '#1d4ed8' : '#' + [1,3,5].map(i=>Math.round(parseInt(current.accent.slice(i,i+2),16)*.86).toString(16).padStart(2,'0')).join('')
  root.style.setProperty('--accent-hover', hover)
  root.style.setProperty('--accent-hover-ink', accentText(hover))
  const link = [1,3,5].map(i => {
    const channel = parseInt(current.accent.slice(i,i+2),16)
    return Math.round(dark ? channel*.35+255*.65 : channel*.4).toString(16).padStart(2,'0')
  }).join('')
  root.style.setProperty('--accent-link', '#'+link)
  if (Capacitor.isNativePlatform()) {
    void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
    void StatusBar.setBackgroundColor({ color: dark ? '#0b1220' : '#f4f6f9' }).catch(() => {})
  }
}
function publish(p: DisplayPreferences) {
  current = p
  // Appearance only: no PINs, key material, business data or credentials in this mirror.
  if (typeof localStorage !== 'undefined') localStorage.setItem(PREFERENCE_KEY, JSON.stringify(p))
  applyAppearance(); listeners.forEach(listener => listener())
}
export async function loadPreferences() {
  const { value } = await Preferences.get({ key: PREFERENCE_KEY })
  if (value) { const parsed: unknown = JSON.parse(value); if (validPreferences(parsed)) current = parsed }
  publish(current)
  if (typeof matchMedia !== 'undefined') matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyAppearance)
  if (Capacitor.isNativePlatform()) await ScreenSecurity.setSecure({ enabled: current.secureScreen })
}
let saveQueue = Promise.resolve()
export function savePreferences(patch: Partial<DisplayPreferences>) {
  const task = saveQueue.then(async () => {
    const next = { ...current, ...patch, updatedAt: Date.now() }
    if (!validPreferences(next)) throw new Error('Invalid settings')
    // Native screenshot policy must succeed before its switch claims success.
    const policyChanged = Capacitor.isNativePlatform() && next.secureScreen !== current.secureScreen
    if (policyChanged) await ScreenSecurity.setSecure({ enabled: next.secureScreen })
    try { await Preferences.set({ key: PREFERENCE_KEY, value: JSON.stringify(next) }) }
    catch (error) {
      if (policyChanged) await ScreenSecurity.setSecure({ enabled: current.secureScreen })
      throw error
    }
    publish(next)
  })
  saveQueue = task.catch(() => {})
  return task
}
