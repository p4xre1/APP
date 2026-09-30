/**
 * Product-type behaviour shared by the Products form/list and by the product
 * pickers in Invoices and Estimates. One Product entity, one set of rules:
 * - a missing `type` means 'physical' (legacy records came from the stock form),
 * - only tracked physical products show stock; nothing ever deducts stock,
 * - picking a product on a document copies values through `productToLine`,
 *   so both document editors stay on the same mechanism.
 * All labels/hints here are English i18n keys; render them through t().
 */
import type { Product, ProductType, BundleComponent, ProductAttribute } from '../store/types'

export const PRODUCT_TYPES = [
  'physical', 'service', 'digital', 'recurring_service', 'bundle', 'non_stock', 'labor', 'custom',
] as const satisfies readonly ProductType[]

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  physical: 'Physical product',
  service: 'Service',
  digital: 'Digital product',
  recurring_service: 'Recurring service',
  bundle: 'Bundle / package',
  non_stock: 'Non-stock item',
  labor: 'Labor / hourly',
  custom: 'Custom item',
}

export const PRODUCT_TYPE_HINT: Record<ProductType, string> = {
  physical: 'Track quantity, stock levels and inventory.',
  service: 'Sell work or professional services without inventory.',
  digital: 'Files, licenses or downloads. Metadata only, no stock.',
  recurring_service: 'A service you bill repeatedly, like monthly maintenance.',
  bundle: 'Several products or services sold together as one package.',
  non_stock: 'Fees and charges that never track inventory.',
  labor: 'Bill time at an hourly, daily or per-session rate.',
  custom: 'A flexible item with optional custom attributes.',
}

export const SERVICE_BILLING_METHODS = ['fixed', 'hourly', 'daily', 'weekly', 'monthly', 'per_project', 'per_session', 'custom'] as const
export const LABOR_BILLING_UNITS = ['hour', 'day', 'session', 'project'] as const
export const BILLING_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'semiannually', 'annually', 'custom'] as const
export const RENEWAL_BEHAVIORS = ['auto_renew', 'manual_renew', 'fixed_term'] as const
export const DIGITAL_FORMATS = ['pdf', 'zip', 'xlsx', 'docx', 'software', 'license', 'course', 'other'] as const
export const DURATION_UNITS = ['minutes', 'hours', 'days', 'weeks', 'months'] as const

/** English label (i18n key) for every select-option value used above. */
export const PRODUCT_OPTION_LABEL: Record<string, string> = {
  fixed: 'Fixed price', hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
  per_project: 'Per project', per_session: 'Per session', custom: 'Custom',
  hour: 'Hour', day: 'Day', session: 'Session', project: 'Project',
  quarterly: 'Quarterly', semiannually: 'Semi-annually', annually: 'Annually',
  auto_renew: 'Renews automatically', manual_renew: 'Renewed manually', fixed_term: 'Fixed term, no renewal',
  pdf: 'PDF', zip: 'ZIP', xlsx: 'XLSX', docx: 'DOCX', software: 'Software', license: 'License', course: 'Course', other: 'Other',
  minutes: 'Minutes', hours: 'Hours', days: 'Days', weeks: 'Weeks', months: 'Months',
}

/** Missing type = physical: the pre-type form always showed stock fields. */
export const productType = (product: Pick<Product, 'type'>): ProductType => product.type ?? 'physical'

/**
 * Whether stock figures are meaningful for this product. Only physical
 * products track inventory (opt-out via trackInventory=false); every other
 * type shows "Not tracked" and never influences stock.
 */
export const tracksInventory = (product: Pick<Product, 'type' | 'trackInventory'>): boolean =>
  productType(product) === 'physical' && product.trackInventory !== false

export const isLowStock = (product: Pick<Product, 'type' | 'trackInventory' | 'stock' | 'minStock'>): boolean =>
  tracksInventory(product) && product.minStock !== undefined && product.stock <= product.minStock

/** Everything the list search matches against: name, SKU, barcode, category... */
export const productSearchText = (product: Product): string =>
  [product.name, product.sku, product.barcode, product.category, product.brand, product.description]
    .filter(Boolean).join(' ').toLowerCase()

export const matchesProduct = (product: Product, query: string): boolean => {
  const needle = query.trim().toLowerCase()
  return !needle || productSearchText(product).includes(needle)
}

/** What the form must provide before a product can be saved. */
export interface ProductDraft {
  name: string
  type: ProductType
  unitPrice: number
  costPrice?: number
  stock?: number
  minStock?: number
  reorderQty?: number
  maxStock?: number
  weight?: number
  length?: number
  width?: number
  height?: number
  duration?: number
  components?: BundleComponent[]
  attributes?: ProductAttribute[]
}

/**
 * Type-aware validation: returns the English i18n key of the first problem, or
 * null. Only fields relevant to the chosen type are checked - a service is
 * never blocked by stock values, dormant figures from another type are ignored.
 */
export function validateProduct(draft: ProductDraft): string | null {
  if (!draft.name.trim()) return 'Enter a name'
  const amounts: (number | undefined)[] = [draft.unitPrice, draft.costPrice]
  if (draft.type === 'physical') amounts.push(draft.stock, draft.minStock, draft.reorderQty, draft.maxStock, draft.weight, draft.length, draft.width, draft.height)
  if (['service', 'labor', 'recurring_service'].includes(draft.type)) amounts.push(draft.duration)
  if (amounts.some(value => value !== undefined && (!Number.isFinite(value) || value < 0))) return 'Amounts cannot be negative'
  if (draft.type === 'bundle') {
    for (const component of draft.components ?? []) {
      if (!component.name.trim() || !Number.isFinite(component.quantity) || component.quantity <= 0) {
        return 'Each bundle component needs a product and a quantity above zero'
      }
    }
  }
  for (const attribute of draft.attributes ?? []) {
    if (!attribute.name.trim() && attribute.value.trim()) return 'Each custom attribute needs a name'
  }
  return null
}

/**
 * The one product -> document-line mapping, used by both the invoice and the
 * estimate editors. Copies name/description, unit and price; the line then
 * flows through the existing documentTotals/lineTotal maths untouched. No
 * type deducts stock - the app has no automatic inventory movement at all.
 */
export function productToLine(product: Product): {
  productId: string
  itemCode?: string
  description: string
  quantity: number
  unitPrice: number
  unit?: string
} {
  return {
    productId: product.id,
    // The SKU doubles as the invoice-line item code: one product identity.
    ...(product.sku.trim() ? { itemCode: product.sku.trim() } : {}),
    description: product.description ? `${product.name} — ${product.description}` : product.name,
    quantity: 1,
    unitPrice: product.unitPrice,
    ...(product.unit ? { unit: product.unit } : {}),
  }
}
