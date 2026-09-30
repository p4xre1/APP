import { createContext, useContext, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import en from './en.json'
import ar from './ar.json'
import fr from './fr.json'
import es from './es.json'
import pt from './pt.json'
import { getPreferences, subscribePreferences } from '../lib/preferences'
import type { Language } from '../lib/preferences'
const dictionaries: Record<Language, Record<string,string>> = { en, ar, fr, es, pt }
export function t(key: string, params: Record<string, string | number> = {}, language = getPreferences().language): string {
  const candidate = dictionaries[language][key] ?? dictionaries.en[key]
  const text = typeof candidate === 'string' ? candidate : key
  return text.replace(/\{(\w+)\}/g, (_, name: string) => typeof params[name] === 'number' ? new Intl.NumberFormat(`${language}-u-nu-${getPreferences().digits}`).format(params[name] as number) : String(params[name] ?? `{${name}}`))
}
const I18nContext = createContext({ language: 'en' as Language, t })
export function I18nProvider({ children }: { children: ReactNode }) {
  const prefs = useSyncExternalStore(subscribePreferences, getPreferences, getPreferences)
  return <I18nContext.Provider value={{ language: prefs.language, t }}>{children}</I18nContext.Provider>
}
export const useI18n = () => useContext(I18nContext)
export function usePreferences() { return useSyncExternalStore(subscribePreferences, getPreferences, getPreferences) }
export function errorText(error: unknown) { return error instanceof Error && typeof dictionaries.en[error.message] === 'string' ? t(error.message) : t('Operation failed') }
