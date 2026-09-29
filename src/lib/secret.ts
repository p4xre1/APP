/** PIN / passcode rules. Arabic-Indic and Persian digits are normalized first. */
export type SecretKind = 'pin' | 'passcode'
export const PIN_MIN = 6, PIN_MAX = 12, PASSCODE_MIN = 8, PASSCODE_MAX = 128

export const normalizeDigits = (value: string) => value.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6f0))

export function detectSecretKind(secret: string): SecretKind {
  const value = normalizeDigits(secret)
  // Anything made only of digits is a PIN, so a long number never sneaks in as a passcode.
  if (/^[0-9]+$/.test(value)) {
    if (value.length >= PIN_MIN && value.length <= PIN_MAX) return 'pin'
    throw new Error('Enter a 6-12 digit PIN or a passcode of 8+ characters')
  }
  if (/^[A-Za-z0-9]{8,128}$/.test(value)) return 'passcode'
  throw new Error('Enter a 6-12 digit PIN or a passcode of 8+ characters')
}

/** A run of `length` digits moving one step up or down, e.g. 123456 or 987654. */
function isRun(value: string, step: number, length = 6): boolean {
  for (let start = 0; start + length <= value.length; start++) {
    let run = true
    for (let i = 1; i < length; i++) if (value.charCodeAt(start + i) - value.charCodeAt(start + i - 1) !== step) { run = false; break }
    if (run) return true
  }
  return false
}
const isYear = (value: string) => /(?:19|20)\d{2}/.test(value)
const COMMON_PASSWORDS = ['password', 'fatorati', 'qwertyui', 'letmein12', 'iloveyou1', 'administrator', 'welcome12']

export function weakSecret(secret: string, kind: SecretKind): boolean {
  const value = normalizeDigits(secret)
  if (/^(.)\1+$/.test(value)) return true // 111111, aaaaaaaa
  if (isRun(value, 1) || isRun(value, -1)) return true // 123456, 654321
  if (isYear(value)) return true // 1985, 2024, 01011990
  if (kind === 'pin') return value.length >= 6 && value.length % 2 === 0 && value === value.slice(0, 2).repeat(value.length / 2) // 121212
  return COMMON_PASSWORDS.includes(value.toLowerCase())
}

/** Returns the normalized secret; throws a localized error when it is too weak. */
export function validateSecret(secret: string): { kind: SecretKind; value: string } {
  const kind = detectSecretKind(secret), value = normalizeDigits(secret)
  if (weakSecret(value, kind)) throw new Error(kind === 'pin' ? 'PIN is too simple' : 'Passcode is too simple')
  return { kind, value }
}

/** Confirmation words are compared without case, spacing or Arabic diacritics. */
export const normalizeWord = (value: string) => normalizeDigits(value).replace(/[ً-ٰٟـ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
