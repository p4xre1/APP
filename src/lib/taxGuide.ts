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
          'Standard rate 20%; reduced rate 10% only for the operations the CGI lists - the rate follows the nature of the operation, it is never a free choice.',
          'An exemption or an out-of-scope status is a legal situation, not a 0% rate you pick: enter 0% here and state the legal reason on the invoice.',
          'Exports are exempt with the right to deduct (Art. 92 CGI): no TVA on the invoice, with the exemption mention.',
          'The 7% and 14% rates were removed on 1 January 2026; the applicable rate follows the date the operation is carried out.',
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
          'An auto-entrepreneur invoices without TVA. Two annual ceilings apply to the amounts collected: 200,000 DH for services, 500,000 DH for commercial, industrial and artisanal activity.',
          'Flat income tax on turnover: 1% for services, 0.5% for commercial, industrial and artisanal activity.',
          'For services, the part of the yearly turnover collected from one same professional client above 80,000 DH suffers a 30% withholding at source, applied by that client on the excess (in force since the 2023 finance law, Art. 73 CGI). It is a withholding rule, not a cap on what you may invoice.',
          'An auto-entrepreneur is outside the scope of TVA: write the mention "TVA non applicable" (with the status) on the invoice rather than a 0% tax line.',
          'Show ICE, IF and the CNIE number; ask your accountant which other identifiers your situation requires.',
        ],
      },
      {
        id: 'payment-deadlines',
        title: 'Payment deadlines (Law 69-21)',
        bullets: [
          'Between businesses: 60 days from the invoice date by default, up to 120 days when the contract agrees on it, and up to 180 days in sectors with a regulated derogation. Sales to consumers are outside this law.',
          'Without an invoice, or with a late one, the period runs from the end of the month of the delivery or of the service - so issue invoices promptly.',
          'Paying late carries a fine payable to the Treasury, based on the Bank Al-Maghrib policy rate and growing with every month of delay; businesses in scope also file periodic declarations.',
          'These duties apply to businesses above 2 million DH of annual turnover, so many small sellers are outside them - but their clients may not be.',
        ],
      },
      {
        id: 'records',
        title: 'Record keeping',
        bullets: [
          'Keep invoices, supporting documents and books for 10 years.',
          'A lost document must be reported to the tax inspector by registered letter within 15 days (30 days in case of force majeure).',
          'Not keeping the records is fined.',
          'Fatorati has no PIN recovery - keep your backups: losing the data does not cancel the duty to keep the records.',
        ],
      },
      {
        id: 'e-invoicing',
        title: 'E-invoicing',
        bullets: [
          'The principle is in Art. 145-IX of the CGI.',
          'A progressive rollout starting with the largest businesses has been announced, but at the last review the implementing decree was still unpublished: no date, threshold or format binds anyone yet, so this app states no date.',
          'Check the DGI website for the current status.',
          'If electronic submission or prior validation becomes mandatory for your category, an offline PDF alone may not satisfy it: check the requirement before relying on this app for it.',
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
          'Enter the combined state and local rate that applies to your sale in the Tax rate field; Fatorati applies it to the invoice subtotal but never decides the rate for you.',
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
          'Sales tax is separate from income tax: collecting it does not settle what you owe on profit. The Tax rate field is sales tax on the document, never an income-tax or self-employment-tax calculator.',
          'A 1099-NEC may be required for a contractor paid 2,000 USD or more in a year (payments made after 31 December 2025; the amount is inflation-indexed from 2027). Ask for a W-9 first, whatever the amount.',
          'Other 1099 categories keep their own thresholds (royalties and payments to attorneys among them): check the current IRS instructions for each form.',
          'Payment platforms report on Form 1099-K above 20,000 USD and 200 transactions (federal rule); a platform may still send one below that, and some states set lower limits.',
          'These thresholds decide who files a form, not whether the income is taxable: declare your income either way.',
        ],
      },
      {
        id: 'records',
        title: 'Record keeping',
        bullets: [
          'There is no single rule: each state sets its own retention period for sales-tax records, commonly three to five years from the return, and longer or unlimited after fraud or a missing return.',
          'Federal income-tax records: usually three years, longer in several situations (employment-tax records four). When unsure, keep them.',
        ],
      },
      {
        id: 'tips',
        title: 'Tips',
        bullets: [
          'Which address sets the rate depends on the state and the transaction - destination, origin or mixed sourcing rules: check the rules of the state involved.',
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
    taxRate: 'Morocco: 20% standard; 10% only for listed operations. Exempt or out of scope: 0% here plus the legal mention on the invoice.',
    businessTaxNumber: 'ICE is 15 digits. Keep IF, TP and RC ready too: they belong on the invoice.',
    documentNumber: 'Art. 145 CGI: numbering must be sequential and gap-free.',
    customerTax: 'B2B invoices must show the client ICE. Stored values appear on the PDF.',
    customerTaxMissing: 'This client has no ICE stored. Add it in Customers before sending a B2B invoice.',
  },
  US: {
    taxRate: 'United States: enter the combined state and local rate for this sale; sourcing rules vary by state.',
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
