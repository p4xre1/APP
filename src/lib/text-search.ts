/**
 * Fatorati Offline - search text helpers
 *
 * One normalisation shared by the FAQ search and the Notebook, so a search for
 * "cafe", "café" or "CAFÉ" finds the same records and an Arabic search ignores the
 * diacritics and the variants of alef/ya/ta-marbuta that keyboards disagree about.
 * Nothing here leaves the device.
 */

/** Combining marks, Arabic diacritics and the tatweel (the Arabic "stretch" letter). */
const MARKS = /[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g

export function normalizeSearch(value: string): string {
  return value.normalize('NFKD').replace(MARKS, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064a')
    .replace(/\u0629/g, '\u0647')
    .toLowerCase().trim()
}
