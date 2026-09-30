/**
 * Fatorati Offline - Tax assistant content
 *
 * Static, bundled guidance. Every string is an i18n key translated in
 * src/i18n/*.json; nothing here is fetched, and no URL is stored, so the
 * assistant works with the network permission removed and the shipped
 * `connect-src 'none'` policy.
 *
 * The content is general information, not tax advice: each region carries the
 * date it was last reviewed so a stale guide is visible rather than silent.
 */

import type { Settings, TaxRegion } from '../store/types'

export const TAX_GUIDE_LAST_REVIEWED = '2026-09-30'
export const DEFAULT_TAX_REGION: TaxRegion = 'MA'
export const TAX_REGIONS: TaxRegion[] = ['MA', 'US']

/** i18n key for a region name. */
export const TAX_REGION_LABEL: Record<TaxRegion, string> = {
  MA: 'Morocco',
  US: 'United States',
}

export interface TaxGuideSection {
  /** Stable id, used as the React key and by tests. */
  id: string
  /** i18n key of the section heading. */
  title: string
  /** i18n keys of the section lines. */
  bullets: string[]
}

export interface TaxGuide {
  region: TaxRegion
  /** ISO date the regulatory content was checked against public sources. */
  lastReviewed: string
  sections: TaxGuideSection[]
}

/** Shown under every guide: bundled content can never be a substitute for advice. */
export const TAX_DISCLAIMER = 'General information, not tax advice. Check with your accountant or the tax authority.'

export const TAX_GUIDE: Record<TaxRegion, TaxGuide> = {
  MA: {
    region: 'MA',
    lastReviewed: TAX_GUIDE_LAST_REVIEWED,
    sections: [
      {
        id: 'rates',
        title: 'Value added tax (TVA)',
        bullets: [
          'Standard rate 20%; reduced rate 10%.',
          'Exports and exempt items: 0% or exempt, with the legal mention on the invoice.',
          'The 7% and 14% rates were removed on 1 January 2026 and are valid only for invoices dated before that date.',
          'Some sectors keep special rates or exemptions: check the CGI.',
        ],
      },
      {
        id: 'content',
        title: 'Mandatory invoice content (Art. 145 CGI)',
        bullets: [
          'Seller: name, address, IF (tax identifier), TP (taxe professionnelle), RC (trade register) and ICE (15 digits).',
          'Client: name, address and ICE for business-to-business invoices.',
          'A sequential, gap-free invoice number.',
          'Invoice date, description of the goods or services, quantity and unit price excluding tax.',
          'Total excluding tax, TVA rate and amount for each rate, and total including tax.',
          'Payment method.',
        ],
      },
      {
        id: 'auto-entrepreneur',
        title: 'Auto-entrepreneur',
        bullets: [
          'An auto-entrepreneur invoices without TVA while annual turnover stays under 500,000 DH.',
          'Write the mention "TVA non applicable" on the invoice.',
          'Show ICE, IF, TP and the CNIE number.',
        ],
      },
      {
        id: 'e-invoicing',
        title: 'E-invoicing',
        bullets: [
          'The principle is in Art. 145-IX of the CGI.',
          'The start date and the turnover thresholds are not stable across sources and an implementing decree may still be pending, so this app states no date.',
          'Check the DGI website for the current status.',
          'Fatorati stores invoices as structured data to prepare for it.',
        ],
      },
      {
        id: 'tips',
        title: 'Tips',
        bullets: [
          'A missing or wrong ICE or IF can get the invoice rejected for deduction by the tax administration.',
          'Keep numbering sequential: never skip and never reuse a number.',
        ],
      },
    ],
  },
  US: {
    region: 'US',
    lastReviewed: TAX_GUIDE_LAST_REVIEWED,
    sections: [
      {
        id: 'rates',
        title: 'Sales tax',
        bullets: [
          'There is no federal sales tax: each state sets its own rate.',
          'Local city and county rates are added on top, so the total differs from one city to another.',
          'Enter the combined rate for the buyer\'s ship-to address in the Tax rate field; Fatorati applies it to the invoice subtotal.',
          'Use 0% when the sale is not taxable and say why in the notes.',
        ],
      },
      {
        id: 'nexus',
        title: 'Where you must collect',
        bullets: [
          'Collect only where you have nexus: a physical presence, or an economic nexus threshold.',
          'Economic nexus thresholds differ per state and are measured by revenue, by number of transactions, or both.',
        ],
      },
      {
        id: 'certificates',
        title: 'Exemption and resale certificates',
        bullets: [
          'Business buyers can be exempt; keep their resale or exemption certificate on file.',
          'Store the certificate number in the customer tax number field.',
        ],
      },
      {
        id: 'content',
        title: 'Invoice content',
        bullets: [
          'Seller legal name and address, and the buyer\'s name and address.',
          'Invoice number and date, with the description, quantity and unit price of each line.',
          'Subtotal, tax rate, tax amount and total.',
          'Payment terms or method, and any registration number your state requires on the invoice.',
          'Many states accept the EIN or a state tax ID; check what your state asks for.',
        ],
      },
      {
        id: 'income',
        title: 'Income tax and contractors',
        bullets: [
          'Sales tax is separate from income tax: collecting it does not settle what you owe on profit.',
          'A 1099-NEC may be required for a contractor paid 600 USD or more; ask for a W-9 first.',
        ],
      },
      {
        id: 'records',
        title: 'Record keeping',
        bullets: [
          'Most states require sales, exemption and use-tax records for three to seven years.',
        ],
      },
      {
        id: 'tips',
        title: 'Tips',
        bullets: [
          'The rate follows the buyer\'s ship-to address, not your office address.',
          'Rates change: update the default rate in Settings when your main state changes.',
        ],
      },
    ],
  },
}

/** One-line hints shown next to the tax fields while the assistant is visible. */
export interface TaxFieldHints {
  /** Under the document tax rate input. */
  taxRate: string
  /** Under the business tax number field in Settings. */
  businessTaxNumber: string
  /** Under the document number / next number. */
  documentNumber: string
  /** Next to the customer picker on a document. */
  customerTax: string
  /** Same place, when that customer has no tax number stored. */
  customerTaxMissing: string
}

export const TAX_FIELD_HINTS: Record<TaxRegion, TaxFieldHints> = {
  MA: {
    taxRate: 'Morocco: 20% standard, 10% reduced. Use 0% for exports and exempt items.',
    businessTaxNumber: 'ICE is 15 digits. Keep IF, TP and RC ready too: they belong on the invoice.',
    documentNumber: 'Art. 145 CGI: numbering must be sequential and gap-free.',
    customerTax: 'B2B invoices must show the client ICE. Stored values appear on the PDF.',
    customerTaxMissing: 'This client has no ICE stored. Add it in Customers before sending a B2B invoice.',
  },
  US: {
    taxRate: 'United States: enter the combined state and local rate for the buyer\'s address.',
    businessTaxNumber: 'Use your EIN or state tax ID; some states require it on the invoice.',
    documentNumber: 'Keep one number series per year and never reuse a number.',
    customerTax: 'Exempt buyers: store their resale or exemption certificate number.',
    customerTaxMissing: 'No certificate number stored. Add the resale or exemption number for exempt buyers.',
  },
}

export function isTaxRegion(value: unknown): value is TaxRegion {
  return value === 'MA' || value === 'US'
}

/** The region configured in Settings, defaulting for installs created before it existed. */
export function settingsRegion(settings?: Pick<Settings, 'taxRegion'> | null): TaxRegion {
  return isTaxRegion(settings?.taxRegion) ? settings.taxRegion : DEFAULT_TAX_REGION
}

/**
 * The region shown in the assistant. It follows Settings until the user
 * switches inside the assistant, which only changes this view.
 */
export function assistantRegion(settings?: Pick<Settings, 'taxRegion' | 'taxAssistantRegion'> | null): TaxRegion {
  return isTaxRegion(settings?.taxAssistantRegion) ? settings.taxAssistantRegion : settingsRegion(settings)
}

/** The assistant is opt-out: absent means visible. */
export function assistantVisible(settings?: Pick<Settings, 'taxAssistantVisible'> | null): boolean {
  return settings?.taxAssistantVisible !== false
}

/** The panel opens by itself the first time, then stays collapsed. */
export function assistantStartsOpen(settings?: Pick<Settings, 'taxAssistantSeen'> | null): boolean {
  return settings?.taxAssistantSeen !== true
}

export function guideFor(region: TaxRegion): TaxGuide {
  return TAX_GUIDE[region]
}

export function hintsFor(region: TaxRegion): TaxFieldHints {
  return TAX_FIELD_HINTS[region]
}
