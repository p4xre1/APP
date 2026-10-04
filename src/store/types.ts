import type { Language } from '../lib/preferences'
import type { AccentId, DocumentTemplate, LayoutId, PresetId } from '../lib/templates'
/**
 * Fatorati Offline - Types
 * 100% Local • Offline - Simple business management
 * Structure: Businesses, Customers, Projects, Invoices, Estimates, Expenses, Products, Settings
 */

export type ModuleKey =
  | 'dashboard'
  | 'customers'
  | 'projects'
  | 'invoices'
  | 'estimates'
  | 'expenses'
  | 'products'
  | 'reports'
  | 'subscriptions'
  | 'settings'
  /** Full-screen tax guide; opened from Settings, not part of the sidebar. */
  | 'taxGuide'
  /** Help & legal screens; opened from Settings and from the screens before the app. */
  | 'help' | 'faq' | 'privacy' | 'terms'
  /** Document template picker with the live preview; opened from Settings. */
  | 'templates'
  /** Notebook of ideas, tasks and notes, with its own quick capture. */
  | 'notebook'
  /** Month calendar mixing notes, due invoices, subscriptions and estimate expiry. */
  | 'calendar'

/** Kind of a notebook entry. An idea can be turned into a task at any time. */
export type NoteType = 'idea' | 'task' | 'note'

/** Optional colour of a notebook entry; see NOTE_COLORS for the checked palette. */
export type NoteColorId = 'none' | 'slate' | 'blue' | 'indigo' | 'violet' | 'rose' | 'orange' | 'amber' | 'green' | 'teal'

/**
 * A notebook entry. The body is plain text and is never rendered as markup.
 *
 * `date` is a local calendar date (YYYY-MM-DD) and `time` an optional HH:mm, both
 * free of time zone shifts; `remindMinutesBefore` is relative to that moment so a
 * reminder stays correct after a phone changes time zone. A note that points at a
 * customer, an invoice or a project tolerates that record being deleted later: the
 * id is kept, the link is simply not shown any more.
 */
export interface Note {
  id: string
  title?: string
  body: string
  color?: NoteColorId
  tags: string[]
  pinned: boolean
  archived: boolean
  type: NoteType
  /** Only meaningful for tasks; an idea keeps it false. */
  done: boolean
  date?: string
  time?: string
  remindMinutesBefore?: number
  linkedCustomerId?: string
  linkedInvoiceId?: string
  linkedProjectId?: string
  createdAt: number
  updatedAt: number
}

/** Billing cadence of a tracked subscription. */
export type SubscriptionCycle = 'monthly' | 'yearly' | 'one_time_period'

/** Currency a subscription may be billed in. Amounts are stored in minor units. */
export type SubscriptionCurrency = 'MAD' | 'USD' | 'EUR'

/**
 * A recurring payment the user tracks. Money is stored as an integer number of
 * minor units (centimes/cents) so sums never drift, like the rest of the vault.
 */
export interface Subscription {
  id: string
  serviceName: string
  category?: string
  amountMinor: number
  currency: SubscriptionCurrency
  billingCycle: SubscriptionCycle
  /** Months covered by one payment when billingCycle is 'one_time_period'. */
  periodMonths?: number
  autoRenew: boolean
  /** ISO calendar date, YYYY-MM-DD, in the device's local calendar. */
  startDate: string
  paymentMethod?: string
  notes?: string
  /** UTC milliseconds when the user cancelled it. */
  cancelledAt?: number
  createdAt: number
  updatedAt: number
}

/** Country whose invoice and tax guidance the assistant shows. */
export type TaxRegion = 'MA' | 'US'

export interface Business {
  currency?: string
  /** Moroccan seller identifiers. `taxNumber` holds the ICE; the others are optional
   *  on the record but are always printed on a Moroccan document (with a dash when
   *  they are empty, so nobody silently loses a required mention). */
  taxNumber?: string
  ifNumber?: string
  tpNumber?: string
  rcNumber?: string
  cnieNumber?: string
  /** Optional stamp or signature image (small, PNG/JPEG data URL). */
  stamp?: string
  id: string
  name: string
  ownerName: string
  phone: string
  email: string
  address: string
  city: string
  logo?: string
  createdAt: number
  updatedAt: number
}

export interface Customer {
  /**
   * 'business' prints and requires the Client ICE on Moroccan documents;
   * 'individual' has no ICE, so no row and no warning. Records saved before
   * this field existed have no value and are treated as 'business'.
   */
  kind?: 'business' | 'individual'
  /** Optional location category used to filter Moroccan cities and US states. */
  country?: 'MA' | 'US' | 'other'
  /** Optional free-form country name when `country` is 'other'. */
  countryName?: string
  /** USPS state abbreviation for US customers, e.g. CA or NY. */
  state?: string
  taxNumber?: string
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  notes: string
  balance: number
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  customerId: string
  description: string
  status: 'planning' | 'active' | 'on_hold' | 'done'
  budget: number
  createdAt: number
  updatedAt: number
}

/** One payment recorded against an invoice. Positive amount, invoice currency. */
export interface InvoicePayment {
  id: string
  amount: number
  /** Local calendar date, YYYY-MM-DD - same convention as issue and due dates. */
  date: string
  /** Free wording, like Invoice.paymentMethod. */
  method?: string
  /** Cheque number, transfer id … */
  reference?: string
  notes?: string
}

export interface InvoiceItem {
  id: string
  productId?: string
  /** Item code shown before the description (usually the product SKU). */
  itemCode?: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  /** Unit the quantity is measured in (m², hour, trip...), shown by some presets. */
  unit?: string
  /** Grouping key of the line, used by the construction preset (materials/labour). */
  section?: string
  /** Optional line discount in percent; `total` is already discounted. */
  discount?: number
}

export interface Invoice {
  /**
   * 'credit_note' marks a correction document that subtracts from every
   * aggregate (see src/lib/credit-notes.ts). Missing = 'invoice', which is
   * what every record saved before the field existed means. Amounts are
   * stored positive on both kinds.
   */
  kind?: 'invoice' | 'credit_note'
  /**
   * Payments recorded against this invoice (src/lib/payments.ts). Missing =
   * none recorded; a stored status of 'paid' still means settled. Amounts are
   * positive, in the invoice currency; a refund is a credit note instead.
   */
  payments?: InvoicePayment[]
  /** For a credit note: id of the invoice it corrects. */
  creditsInvoiceId?: string
  /** Customer's purchase-order number, printed in the document meta when set. */
  poNumber?: string
  /** Free-text salesperson name, printed in the document meta when set. */
  salesperson?: string
  /**
   * Optional ship-to address (free text, one line per row). Empty = same as
   * the billing address, which stays the customer's stored address.
   */
  shippingAddress?: string
  /** Internal note. NEVER rendered on the document, the preview or the PDF. */
  privateNotes?: string
  /** Template snapshot: layout, topic preset, accent, footer note, pinned region. */
  template?: DocumentTemplate
  /** Free wording of how the invoice is paid; printed on the document. */
  paymentMethod?: string
  taxRate?: number // Percent applied to the subtotal; absent/0 means no tax.
  paidAt?: number // UTC milliseconds when the invoice was marked paid.
  currency?: string
  language?: Language
  exchangeRate?: number // Default-currency units for one unit of this currency.
  rateCurrency?: string // Currency the manual exchange rate targets.
  occurredAt?: number // UTC milliseconds.
  pdfColor?: boolean
  id: string
  number: string
  customerId: string
  projectId?: string
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  issueDate: string
  dueDate: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Estimate {
  /** Id of the invoice this estimate was converted into; conversion happens once. */
  convertedInvoiceId?: string
  /** Template snapshot: layout, topic preset, accent, footer note, pinned region. */
  template?: DocumentTemplate
  /** Free wording of how the estimate is paid; printed on the document. */
  paymentMethod?: string
  taxRate?: number
  currency?: string
  language?: Language
  exchangeRate?: number // Default-currency units for one unit of this currency.
  rateCurrency?: string // Currency the manual exchange rate targets.
  occurredAt?: number // UTC milliseconds.
  pdfColor?: boolean
  id: string
  number: string
  customerId: string
  projectId?: string
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  status: 'draft' | 'sent' | 'accepted' | 'declined'
  issueDate: string
  expiryDate: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Expense {
  currency?: string
  language?: Language
  exchangeRate?: number // Default-currency units for one unit of this currency.
  rateCurrency?: string // Currency the manual exchange rate targets.
  occurredAt?: number // UTC milliseconds.
  pdfColor?: boolean
  id: string
  description: string
  /** Recorded amount, tax included when there is one. */
  amount: number
  /**
   * Tax (e.g. TVA) contained in `amount`, when the receipt shows one.
   * Recording it feeds the tax summary as potentially deductible tax; the
   * app never decides deductibility - that is the accountant's call.
   */
  taxAmount?: number
  /** How it was paid: free wording, like Invoice.paymentMethod. */
  paymentMethod?: string
  /** Receipt or transaction reference. */
  reference?: string
  category: string
  date: string
  vendor: string
  receipt?: string
  createdAt: number
  updatedAt: number
}

/**
 * What kind of thing the business sells. Missing = 'physical': every product
 * created before types existed came from a form with stock fields.
 */
export type ProductType =
  | 'physical'
  | 'service'
  | 'digital'
  | 'recurring_service'
  | 'bundle'
  | 'non_stock'
  | 'labor'
  | 'custom'

/** One line of a bundle: a reference to an existing product plus a quantity. */
export interface BundleComponent {
  /** Id of the referenced product; kept even if that product is later deleted. */
  productId?: string
  /** Name snapshot so the bundle stays readable if the product is renamed/deleted. */
  name: string
  quantity: number
  note?: string
}

/** Free-form name/value pair for the custom product type. Display only. */
export interface ProductAttribute {
  name: string
  value: string
}

export interface Product {
  id: string
  name: string
  description: string
  sku: string
  unitPrice: number
  /** What one unit costs to buy or make - margin awareness only, no COGS engine. */
  costPrice?: number
  unit: string
  stock: number
  /** Warn when `stock` falls to this level or below. */
  minStock?: number
  /** Missing = 'physical' (legacy records predate product types). */
  type?: ProductType
  category?: string
  // --- Inventory (physical only; stock stays a manual figure, nothing deducts it) ---
  /** Missing = true for physical products; other types never track inventory. */
  trackInventory?: boolean
  reorderQty?: number
  maxStock?: number
  location?: string
  // --- Identification / supply (advanced) ---
  barcode?: string
  brand?: string
  manufacturer?: string
  model?: string
  vendor?: string
  supplierSku?: string
  weight?: number
  weightUnit?: string
  length?: number
  width?: number
  height?: number
  dimensionUnit?: string
  // --- Service / labor ---
  /** Service billing method or labor billing unit ('hourly', 'per_project', 'hour'...). */
  billingMethod?: string
  duration?: number
  durationUnit?: string
  // --- Recurring service (what the business sells; Fatorati itself has no subscriptions) ---
  billingFrequency?: string
  renewal?: string
  // --- Digital (metadata only: the offline app never stores or fetches the file) ---
  fileFormat?: string
  fileRef?: string
  fileUrl?: string
  version?: string
  licenseType?: string
  deliveryMethod?: string
  // --- Flexible extras ---
  internalNotes?: string
  components?: BundleComponent[]
  attributes?: ProductAttribute[]
  createdAt: number
  updatedAt: number
}

export interface Settings {
  id: string
  businessId: string
  currency: string
  taxRate: number
  invoicePrefix: string
  estimatePrefix: string
  /** Prefix of the credit-note number series. Missing = 'AV' (French "avoir"). */
  creditNotePrefix?: string
  theme: 'light' | 'dark' | 'system'
  language: Language
  /** Region used for new documents. Absent on installs created before the tax assistant. */
  taxRegion?: TaxRegion
  /** Tax assistant visibility. Absent means visible (the default). */
  taxAssistantVisible?: boolean
  /** Region shown inside the assistant; switching there never changes taxRegion. */
  taxAssistantRegion?: TaxRegion
  /** Set after the assistant has been shown once, so it then starts collapsed. */
  taxAssistantSeen?: boolean
  /** Subscription reminders: opt-in, so absent means off. */
  subscriptionReminders?: boolean
  /** How many days before a renewal to remind. Clamped to 1-30 by the UI. */
  subscriptionWarnDays?: number
  /** Also remind on the renewal/end day itself. */
  subscriptionDayOfReminder?: boolean
  /** Hide service names from notification text (default ON). */
  subscriptionHideNames?: boolean
  /** Default template for new documents; each document stores its own snapshot. */
  templateLayout?: LayoutId
  templatePreset?: PresetId
  templateAccent?: AccentId
  /**
   * Highest sequence ever used per number series (`INV-2026` -> 12). The floor
   * only rises, so a deleted document can never give its number back - the next
   * number is always above both the stored documents and this floor.
   */
  numberFloor?: Record<string, number>
  /** Days between issue and due date on new invoices (and estimate expiry), 0–365. Missing = 30, the old hardcoded value. */
  defaultDueDays?: number
  createdAt: number
  updatedAt: number
}
