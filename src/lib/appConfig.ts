/**
 * Owner configuration — the single place where the app's public links live.
 *
 * All three values ship **empty**. Nothing is invented here: a link is shown in
 * Settings → About only when the owner fills in a plausible value, so an
 * unconfigured build hides the row instead of displaying a dead or fake contact.
 *
 * To publish the app, replace the empty strings with your own details:
 *   SUPPORT_EMAIL       e.g. 'support@your-domain.com'
 *   PRIVACY_POLICY_URL  e.g. 'https://your-domain.com/privacy'
 *   TERMS_URL           e.g. 'https://your-domain.com/terms'
 *
 * The privacy policy and the terms are already written and shipped in this
 * repository (`PRIVACY.md`, `TERMS.md`, `docs/legal/`); host one of them at a
 * public URL and put that URL here. Both links open in the phone's browser
 * through the Android intent system — the app itself never makes a network
 * request and still ships without the INTERNET permission.
 */

/** Support address published with the app listing. Empty until the owner sets it. */
export const SUPPORT_EMAIL = ''

/** Public URL of the hosted privacy policy. Empty until the owner sets it. */
export const PRIVACY_POLICY_URL = ''

/** Public URL of the hosted terms of use. Empty until the owner sets it. */
export const TERMS_URL = ''

/** Values that must never be shown as if they were real, including the docs' placeholders. */
const PLACEHOLDERS = new Set(['', '[SUPPORT EMAIL]', '[PRIVACY POLICY URL]', '[TERMS URL]', 'owner@business.com', 'example.com'])

/** Conventional address shape: no scheme, no path, no spaces. */
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const URL_PATTERN = /^https?:\/\/[^\s]+\.[^\s]+$/i

/** The three optional values, so the visibility rules can be tested without editing this file. */
export interface AboutConfig {
  supportEmail: string
  privacyPolicyUrl: string
  termsUrl: string
}

/** The shipped configuration: every value empty until the owner fills it in. */
export const CONFIGURED_LINKS: AboutConfig = {
  supportEmail: SUPPORT_EMAIL,
  privacyPolicyUrl: PRIVACY_POLICY_URL,
  termsUrl: TERMS_URL,
}

export interface AboutLink {
  label: 'Privacy policy' | 'Terms of use' | 'Support'
  href: string
  external: boolean
}

function usable(value: string): string {
  const trimmed = value.trim()
  return PLACEHOLDERS.has(trimmed.toLowerCase()) ? '' : trimmed
}

/** The configured support address, or null when the owner has not set a valid one. */
export function supportEmail(): string | null {
  const value = usable(SUPPORT_EMAIL)
  return EMAIL_PATTERN.test(value) ? value : null
}

/** The configured privacy policy URL, or null when the owner has not set a valid one. */
export function privacyPolicyUrl(): string | null {
  const value = usable(PRIVACY_POLICY_URL)
  return URL_PATTERN.test(value) ? value : null
}

/** The configured terms URL, or null when the owner has not set a valid one. */
export function termsUrl(): string | null {
  const value = usable(TERMS_URL)
  return URL_PATTERN.test(value) ? value : null
}

/**
 * Turns a configuration into the rows the About card shows. A value that is
 * empty, still a documentation placeholder, or not a plausible address/URL is
 * dropped entirely, so the app never displays a dead or invented contact.
 */
export function resolveAboutLinks(config: AboutConfig): AboutLink[] {
  const links: AboutLink[] = []
  const privacy = usable(config.privacyPolicyUrl)
  if (URL_PATTERN.test(privacy)) links.push({ label: 'Privacy policy', href: privacy, external: true })
  const terms = usable(config.termsUrl)
  if (URL_PATTERN.test(terms)) links.push({ label: 'Terms of use', href: terms, external: true })
  const email = usable(config.supportEmail)
  if (EMAIL_PATTERN.test(email)) links.push({ label: 'Support', href: `mailto:${email}`, external: false })
  return links
}

/** Every external link the About card shows for the shipped configuration. */
export function aboutLinks(): AboutLink[] {
  return resolveAboutLinks(CONFIGURED_LINKS)
}
