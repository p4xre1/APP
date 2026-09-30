import { APP_VERSION } from './version'
import { supportEmail } from './appConfig'
import { t } from '../i18n'
import type { Language } from './preferences'

/**
 * The help screen sends nothing anywhere and asks for no permission. The Android
 * version and the device model come from the WebView user agent, which is already
 * part of the page: reading it needs no permission and no `<queries>` entry in the
 * manifest. Anything the user agent does not state stays "not detected".
 */
export interface DeviceInfo {
  android: string | null
  model: string | null
}

export function parseUserAgent(userAgent: string): DeviceInfo {
  const android = /Android\s+([0-9]+(?:\.[0-9]+)*)/i.exec(userAgent)?.[1] ?? null
  // "Mozilla/5.0 (Linux; Android 14; SM-A536B Build/TP1A...)": the token before Build/.
  const model = /Android[^;)]*;\s*([^;()]+?)\s+Build\//i.exec(userAgent)?.[1]?.trim() ?? null
  return { android, model: model ? model : null }
}

export function deviceInfo(): DeviceInfo {
  return parseUserAgent(typeof navigator === 'undefined' ? '' : navigator.userAgent)
}

/** The four non-sensitive values a problem report may carry. Nothing else. */
export interface AppInfo {
  version: string
  android: string
  model: string
  language: string
}

export function appInfo(language: Language | string, device: DeviceInfo = deviceInfo()): AppInfo {
  return {
    version: APP_VERSION,
    android: device.android ?? t('not detected'),
    model: device.model ?? t('not detected'),
    language: t(`language.${language}`),
  }
}

export function appInfoLines(info: AppInfo): string[] {
  return [
    `${t('App version')}: ${info.version}`,
    `${t('Android version')}: ${info.android}`,
    `${t('Device model')}: ${info.model}`,
    `${t('Language')}: ${info.language}`,
  ]
}

/**
 * Body of the pre-filled message. It contains the four lines above and the warning
 * to keep invoices, customers, PINs, backups and logs out of the report - never a
 * record from the vault.
 */
export function problemReportBody(info: AppInfo): string {
  return [
    ...appInfoLines(info),
    '',
    t('Describe the problem here. Never include invoices, customers, your PIN, a backup file or app logs.'),
  ].join('\n')
}

export function problemReportHref(info: AppInfo, email: string | null = supportEmail()): string {
  const subject = encodeURIComponent(`${t('Fatorati')} ${info.version}`)
  const body = encodeURIComponent(problemReportBody(info))
  // Without a configured address the mail app opens with an empty recipient.
  return `mailto:${email ?? ''}?subject=${subject}&body=${body}`
}

/** Development notice about the missing support address; never shown in a release build. */
export function isDevelopmentBuild(env: unknown = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env): boolean {
  return typeof env === 'object' && env !== null && (env as { DEV?: boolean }).DEV === true
}

export function showsUnconfiguredSupportNotice(email: string | null = supportEmail(), development = isDevelopmentBuild()): boolean {
  return email === null && development
}

/** Clipboard is shared with other apps, so only non-sensitive text is copied. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
