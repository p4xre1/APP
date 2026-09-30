# Payments — design

## Decision

Payments are **embedded in the invoice record** (`Invoice.payments?: InvoicePayment[]`),
not a separate store.

Why:

- An invoice and its payments are one document lifecycle; they are always read
  and written together.
- No new object store, no backup-format version bump, no new CSV file, no new
  migration path: an invoice without the field (every pre-2.2 record) simply
  has no recorded payments.
- The array is small (a real invoice sees a handful of payments; the validator
  caps it at 200).

## Model

```ts
interface InvoicePayment {
  id: string          // crypto.randomUUID()
  amount: number      // > 0, invoice currency, minor-unit rounded
  date: string        // local calendar date YYYY-MM-DD (same convention as issue/due dates)
  method?: string     // free wording, like Invoice.paymentMethod
  reference?: string  // cheque number, transfer id …
  notes?: string
}
```

Amounts are positive. A refund is **not** a negative payment — it is a credit
note (`src/lib/credit-notes.ts`), which already subtracts with `documentSign`.
Credit notes take no payments; they settle through their status.

## Rules (single source of truth: `src/lib/payments.ts`)

- `paymentsTotal(invoice)` — minor-unit sum of the recorded payments.
- `invoiceBalance(invoice)` — what is still owed on this document:
  - stored status `paid` → `0` (a legacy invoice marked paid without recorded
    payments is settled; we never invent a synthetic payment for it),
  - otherwise `total − paymentsTotal`, never below 0.
- `validatePayment(invoice, amount, date)` — rejects non-positive amounts,
  malformed dates and **over-payments** (amount above the remaining balance).
- `recordPayment(invoice, entry)` — returns the patch to store: the appended
  array, plus `status: 'paid'` and `paidAt` (noon of the payment date) when the
  balance reaches 0. Status stays untouched otherwise: partial payments are a
  balance, not a fake status.
- `removePayment(invoice, id)` — returns the patch; when the removal re-opens a
  paid invoice, status returns to `sent` and `paidAt` is cleared.

## Integration

- **What a customer owes** (`customerOutstanding`, report `pending`/`overdue`,
  aging) uses the open balance, so partial payments reduce receivables.
- **Revenue recognition** in `reportTotals` stays status-based (an invoice
  counts when it is effectively paid): the reconciliation
  `revenue + tax = cash received` keeps holding. Payment-dated cash timing is
  the cash-flow report's job, which reads the payment dates directly.
- **Locking**: `payments` is not a locked field — recording a payment on an
  issued invoice is exactly what should happen.
- **CSV** invoices export gains `Amount Paid` and `Balance` columns.
- **Backup** validation checks each entry (id, positive rounded amount, ISO
  date, bounded strings, ≤ 200 entries); old backups restore unchanged.
