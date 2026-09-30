/**
 * Fatorati Offline - navigation intent
 *
 * A row in the calendar can point at a note, an invoice, an estimate or a
 * subscription. Tapping it navigates to the module that owns the record and leaves
 * the id here; the module picks it up on mount and opens the record. Keeping this in
 * one tiny module means no screen has to know how another one is laid out, and the
 * intent is dropped as soon as it is read, so it can never reopen a record later.
 */

import type { ModuleKey } from '../store/types'

const INTENTS = ['notebook', 'invoices', 'estimates', 'subscriptions'] as const
export type IntentModule = typeof INTENTS[number]

export interface NavigationIntent {
  module: IntentModule
  id: string
}

let intent: NavigationIntent | null = null

export function setIntent(module: IntentModule, id: string): void {
  intent = { module, id }
}

/** Reads and clears the intent for one module; another module's intent is left alone. */
export function takeIntent(module: IntentModule): string | null {
  if (!intent || intent.module !== module) return null
  const id = intent.id
  intent = null
  return id
}

/** The module that owns a calendar item's kind. */
export function moduleForGroup(group: string): ModuleKey {
  if (group === 'notes') return 'notebook'
  if (group === 'invoices') return 'invoices'
  if (group === 'estimates') return 'estimates'
  return 'subscriptions'
}

export const isIntentModule = (value: string): value is IntentModule => (INTENTS as readonly string[]).includes(value)
