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

export const TAX_GUIDE_LAST_REVIEWED = '2026-10-03'
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
          'Standard rate 20%; reduced rate 10% only for the operations the CGI lists (Article 99 CGI) - the rate follows the nature of the operation, it is never a free choice.',
          'The reform left a few transitional exceptions that a decree lists (energy and transport among them): check the text that applies to your operation before using any rate other than 20% or 10%.',
          'Charging TVA at all depends on your turnover and activity: below the thresholds the CGI provides a franchise (you charge no TVA and deduct none), and the thresholds differ between sales and services. Confirm your regime with your accountant before invoicing without TVA - the app prints the rate you set, it never decides it.',
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
        id: 'construction',
        title: 'Construction and public works',
        bullets: [
          'Building and civil-works contracts are services taxed at the standard TVA rate of 20%. Since 1 January 2026 Morocco applies only two rates, 20% and 10%: the former 7% and 14% rates are gone, and the reduced rate covers the operations the CGI lists, not ordinary site work.',
          'Conventional social housing is exempt from TVA under Article 92-I-28° CGI within the price and surface caps of the current Finance Law: confirm the project qualifies before you bill a client without tax.',
          'On a public contract a retenue de garantie is withheld: one tenth (10%) of each interim payment, stopping at 7% of the initial contract amount plus any amendments. It can be replaced by a personal and solidary surety, and it is released by mainlevée after the réception définitive, which can come months after the work ends.',
          'Public contracts must be paid within 60 days of the constatation du service fait (45 days to order the payment, 15 days to settle it - Decree 2-16-344 of 22 July 2016). Past that, intérêts moratoires are due, and an unreleased retenue de garantie carries them too.',
          'A retenue de garantie is not a discount: the work has been done, so the full price stays revenue and the withheld part is a receivable. Bill the full amount and record the release as a later payment instead of lowering the invoice.',
          'Subcontracting on a public contract: the subcontractor must be declared by the contractor and accepted by the contracting authority, and only a share of the contract may be subcontracted under the procurement decree; an accepted subcontractor can be paid directly by the administration. Keep the acceptance and the agreed payment terms with the contract file.',
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
          'The legal foundation is Article 145-IX of the CGI: a computerized invoicing system meeting technical criteria set by the administration, with the practical modalities left to a regulatory text.',
          'Universal effective date, turnover threshold and penalty: NOT VERIFIED - the rollout has been announced, but the decree was still unpublished at the last check (the draft had reached the Government Secretariat, SGG), so this app states no date.',
          'Article 145-I (electronic accounting) and Article 145-III (ordinary invoice content) are different rules - the computerized-invoicing framework is 145-IX.',
          'Check the DGI website for the current status.',
          'If electronic submission or prior validation becomes mandatory for your category, an offline PDF alone may not satisfy it: check the requirement before relying on this app for it.',
          'Auto-entrepreneurs and taxpayers under the Contribution Professionnelle Unique (CPU) are reported to be outside it, with only an email-address duty; that exclusion (usually cited as Article 145-X/145-XI) still needs checking in the CGI text.',
          'Fatorati stores invoices as structured data to prepare for it.',
        ],
      },
      {
        id: 'employing-staff',
        title: 'Employing staff',
        bullets: [
          'Social contributions (2026): the employer pays 21.09% of gross payroll - family allowances 6.40%, short-term benefits 1.05%, long-term benefits 7.93%, AMO 4.11% and the vocational training tax 1.60% - and the employee contributes 6.74% (0.52% + 3.96% social, 2.26% AMO).',
          'The 6,000 MAD monthly cap applies only to the short-term and long-term social benefits: AMO, family allowances and the training tax are computed on the whole salary.',
          'Minimum wage: 17.92 MAD per hour in industry, commerce and the professions from 1 January 2026 (SMIG), and 97.44 MAD per working day in agriculture from 1 April 2026 (SMAG) - Decree 2.25.983.',
          'Family allowances paid by the CNSS to an employee with children: 300 MAD per month for each of the first three children and 36 MAD per child for the next three (six children maximum). The employer 6.40% contribution funds them, and the tax deduction of 600 MAD per dependant is a separate thing.',
          'Work-accident insurance is compulsory (Law 18-12). The premium is set by the insurer from the activity and the payroll, never by a legal rate.',
          'Income tax on salaries: the professional abatement is 35% of annual gross pay up to 78,000 MAD and 25% above it, capped at 35,000 MAD a year, and the deduction for dependants is 600 MAD per dependent per year (up to 6 dependants). Net taxable income under 40,000 MAD a year pays no tax; the scale runs to 37%: check the Finance Law in force.',
          'Paid leave, notice and any dismissal indemnity follow the Labour Code (Law 65-99): leave accrues at 1.5 working days per month worked (18 days a year) with seniority increases, and an exit must follow the Code procedure - check it or ask your accountant before terminating.',
        ],
      },
      {
        id: 'non-residents',
        title: 'Paying a non-resident',
        bullets: [
          'Payments a Moroccan business makes to a person or company established abroad in the categories listed by Article 15 of the CGI - service fees, royalties, interest, gross rents, dividends among them - are subject to withholding at source by the payer.',
          'The domestic rate is 10% of the gross amount for service fees, royalties and interest; dividends follow the progressive schedule (11.25% for 2026 distributions, 10% from 2027). The withholding is computed on the gross amount, with no deduction of costs.',
          'A tax treaty may reduce or exempt the withholding: check the treaty with the payee country and keep the certificate of tax residence it requires in the file.',
          'Not withholding exposes YOU to the tax and the penalties, not the foreign supplier: withhold first, then pay the balance.',
        ],
      },
      {
        id: 'audits',
        title: 'Audits, late filing and appeals',
        bullets: [
          'The administration can reassess or audit a year within four years (Article 226 CGI), extended to ten years in case of fraud (Article 228).',
          'A declaration filed late is fined 5% of the tax up to 30 days of delay, 15% beyond, and 20% when the administration assesses for a missing or insufficient declaration; a late payment adds a penalty and a 5% increase for the first month plus 0.5% per further month (Article 208 CGI).',
          'VAT is declared and paid by the 20th of the month after the period: monthly once turnover passes 1,000,000 MAD, quarterly below it. The app files nothing - keep the deadline in your own calendar.',
          'A disagreement goes to the tax tribunal after the administration has ruled on the claim: keep the dated correspondence and the documents that support each figure.',
        ],
      },
      {
        id: 'formalities',
        title: 'Company taxes and formalities',
        bullets: [
          'Company income tax (2026): the rate is 20% of net taxable profit below 100 million MAD and 35% at or above it (40% for banks and insurers, 20% for Casablanca Finance City and industrial acceleration zones). It is proportional, not progressive: crossing the threshold moves the whole profit to the higher rate. The app never computes income tax - it is not part of your invoices.',
          'Company income tax deadlines (calendar-year company): the annual return and the balance are due within three months of the year end (31 March), and four advance payments of 25% each fall due on 31 March, 30 June, 30 September and 31 December (Articles 20 and 169 CGI). The app keeps no filing calendar - put these dates in your own.',
          'An expense not settled by crossed cheque, bank transfer, bill of exchange or electronic means is deductible only up to 5,000 MAD per day and per supplier, within 50,000 MAD per month and per supplier (Article 11-II CGI); the excess is added back and carries a 6% fine, so pay larger amounts by a traceable method.',
          'The cotisation minimale is computed on the year turnover EXCLUDING tax (HT) - TVA never enters its base (Article 144 CGI) - at 0.25% (0.15% in regulated sectors), with a floor of 3,000 MAD even in a loss year; new companies are exempt for their first 36 months.',
          'Registering a company or raising its capital attracts registration duties - commonly cited as 1% of the amount with a 1,000 MAD minimum, while Finance Laws have introduced exemptions for company-creation acts: the notary applies the rule in force, so confirm the amount before budgeting.',
          'Since 1 July 2026 a business withholds 5% at source on rent paid to a professional lessor (a non-final withholding credited against that lessor\'s tax): check whether your lease is in scope and keep the payment proof.',
          'A solidarity contribution on profits (CSS) applies on top of company income tax when net taxable profit reaches 1,000,000 MAD: the rate rises by band from 1.5% to 5% (1.5% up to 5 million, 2.5% up to 10 million, 3.5% up to 40 million, 5% above) and is not deductible; the 2026 Finance Law extended it through 2028. Confirm the band that applies to your profit.',
          'Company law minimums: a SARL has no legal minimum capital - the partners set it in the statutes (a common practice is 10,000 MAD) - while a public company (SA) needs at least 300,000 MAD (3,000,000 if it offers shares to the public). Check the Code des sociétés for the form you choose.',
          'Local taxes - taxe professionnelle and taxe des services communaux - have no single national rate: they depend on the commune, the premises and the activity (Law 47-06), so ask the commune or your accountant for your case.',
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
        id: 'contractors',
        title: 'Contractors and construction',
        bullets: [
          'In most states a contractor is the consumer of the materials it incorporates into real property: you pay sales tax to the supplier and do not add a separate sales tax line for those materials on the customer invoice.',
          'Some states instead treat you as a reseller - Texas under a separated contract, Arizona and Nebraska in cases their rules define: materials are bought with a resale certificate and the customer is charged tax on the materials part. The contract form (lump-sum or separated) and the kind of work (capital improvement or repair) can change the answer.',
          'Retainage: several states cap how much an owner may withhold and require the same percentage to flow down to subcontractors (California and New York now cap most private retainage at 5%, with statutory release deadlines). Check the law of the state where the project sits.',
          'Retainage is not a discount: bill the work at its full price, keep the withheld amount as a receivable, and track when it becomes due instead of reducing the invoice.',
          'Licensing, permits, mechanics-lien deadlines and preliminary notices are state-specific (sometimes county-specific): check the statutes of the state where the project sits and serve every notice within its deadline - on private work the lien is often the only security you have.',
          'Payments to subcontractors: collect a W-9 before the first payment. A Form 1099-NEC is generally due for a non-employee paid 2,000 USD or more in the year; most corporations are exempt while attorneys are not, card and third-party network payments are reported by the processor on a Form 1099-K, and a missing taxpayer number can require backup withholding.',
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
