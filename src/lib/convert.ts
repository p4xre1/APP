/**
 * Estimate → invoice conversion. Kept out of the component so the copy rules
 * are unit-tested: the invoice inherits everything the customer already saw on
 * the estimate - template snapshot, payment method, project, currency, exchange
 * rate, tax and items - and starts as a draft with fresh dates and item ids.
 */
import type { Estimate, Invoice } from '../store/types'

/** One conversion per estimate, and only once the customer has seen or accepted it. */
export function canConvertEstimate(estimate: Pick<Estimate, 'status' | 'convertedInvoiceId'>): boolean {
  return !estimate.convertedInvoiceId && (estimate.status === 'sent' || estimate.status === 'accepted')
}

/** Draft invoice data built from an estimate; ids of items are new, the template snapshot is a deep copy. */
export function invoiceFromEstimate(
  estimate: Estimate,
  number: string,
  issueDate: string,
  dueDate: string,
): Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    number,
    customerId: estimate.customerId,
    projectId: estimate.projectId,
    currency: estimate.currency,
    language: estimate.language,
    pdfColor: estimate.pdfColor,
    exchangeRate: estimate.exchangeRate,
    rateCurrency: estimate.rateCurrency,
    taxRate: estimate.taxRate,
    template: estimate.template ? structuredClone(estimate.template) : undefined,
    paymentMethod: estimate.paymentMethod,
    items: estimate.items.map(item => ({ ...item, id: crypto.randomUUID() })),
    subtotal: estimate.subtotal,
    tax: estimate.tax,
    total: estimate.total,
    status: 'draft',
    issueDate,
    dueDate,
    notes: estimate.notes,
  }
}
