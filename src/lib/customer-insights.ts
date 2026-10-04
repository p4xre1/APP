import type { Customer, Invoice } from '../store/types'
import { documentSign } from './credit-notes'
import { roundMoney, sumMoney } from './format'
import { invoiceBalance, paymentsTotal } from './payments'
import { effectiveStatus } from './status'
import { todayISO } from './subscriptions'

export interface CustomerAmount {
  currency: string
  amount: number
}

export interface CustomerInsight {
  /** Net total of issued invoices and credit notes, grouped by native currency. */
  invoiced: CustomerAmount[]
  /** Amount received, grouped by native currency; legacy paid invoices count as paid in full. */
  received: CustomerAmount[]
  /** Remaining open balances, grouped by native currency. */
  outstanding: CustomerAmount[]
  /** Comparable received total in the user's default currency, or null if an exchange rate is missing. */
  rankValue: number | null
  /** Comparable open balance in the user's default currency, or null if an exchange rate is missing. */
  outstandingValue: number | null
  /** Competition rank by received amount in the default currency. A tie shares the same rank. */
  rank: number | null
}

type AmountGroups = Map<string, number[]>
type Accumulator = {
  invoiced: AmountGroups
  received: AmountGroups
  outstanding: AmountGroups
  receivedInDefault: number[]
  outstandingInDefault: number[]
  receivedComparable: boolean
  outstandingComparable: boolean
}

const add = (groups: AmountGroups, currency: string, amount: number) => {
  if (amount === 0) return
  groups.set(currency, [...(groups.get(currency) || []), amount])
}

function convertToDefault(
  amount: number,
  currency: string,
  invoice: Invoice,
  defaultCurrency: string,
): number | null {
  if (amount === 0) return 0
  if (currency === defaultCurrency) return roundMoney(amount, defaultCurrency)
  if (invoice.exchangeRate && invoice.rateCurrency === defaultCurrency) {
    return roundMoney(amount * invoice.exchangeRate, defaultCurrency)
  }
  return null
}

function finishGroups(groups: AmountGroups): CustomerAmount[] {
  return [...groups].map(([currency, amounts]) => ({ currency, amount: sumMoney(amounts, currency) }))
}

/**
 * The customer ledger used by the directory and its client ranking. It reuses the
 * invoice payment rules (including partial payments and legacy paid invoices),
 * keeps native currencies separate, and only compares currencies when a saved
 * manual exchange rate can convert them to the user's default currency.
 */
export function customerInsights(
  customers: Pick<Customer, 'id'>[],
  invoices: Invoice[],
  defaultCurrency: string,
  today: string = todayISO(),
): Map<string, CustomerInsight> {
  const accumulators = new Map<string, Accumulator>(customers.map(customer => [customer.id, {
    invoiced: new Map(),
    received: new Map(),
    outstanding: new Map(),
    receivedInDefault: [],
    outstandingInDefault: [],
    receivedComparable: true,
    outstandingComparable: true,
  }]))

  for (const invoice of invoices) {
    const account = accumulators.get(invoice.customerId)
    if (!account) continue
    const currency = invoice.currency || defaultCurrency
    const sign = documentSign(invoice)
    const status = effectiveStatus(invoice, today)

    // Drafts are not yet billed. Issued credit notes subtract from their customer's total.
    if (status !== 'draft') add(account.invoiced, currency, sign * invoice.total)

    // A stored 'paid' status settles pre-payment-era invoices too. Open invoices
    // contribute only their recorded partial payments, not their full face value.
    const received = status === 'draft' ? 0 : status === 'paid' ? invoice.total : paymentsTotal(invoice, defaultCurrency)
    const signedReceived = sign * received
    add(account.received, currency, signedReceived)
    if (signedReceived !== 0) {
      const converted = convertToDefault(signedReceived, currency, invoice, defaultCurrency)
      if (converted === null) account.receivedComparable = false
      else account.receivedInDefault.push(converted)
    }

    if (status === 'sent' || status === 'overdue') {
      const signedBalance = sign * invoiceBalance(invoice, defaultCurrency)
      add(account.outstanding, currency, signedBalance)
      if (signedBalance !== 0) {
        const converted = convertToDefault(signedBalance, currency, invoice, defaultCurrency)
        if (converted === null) account.outstandingComparable = false
        else account.outstandingInDefault.push(converted)
      }
    }
  }

  const result = new Map<string, CustomerInsight>()
  for (const [customerId, account] of accumulators) {
    result.set(customerId, {
      invoiced: finishGroups(account.invoiced),
      received: finishGroups(account.received),
      outstanding: finishGroups(account.outstanding),
      rankValue: account.receivedComparable ? sumMoney(account.receivedInDefault, defaultCurrency) : null,
      outstandingValue: account.outstandingComparable ? sumMoney(account.outstandingInDefault, defaultCurrency) : null,
      rank: null,
    })
  }

  // Rank only customers with a positive, fully comparable collected amount.
  // Non-convertible foreign-currency activity is deliberately left unranked;
  // comparing raw USD, MAD and EUR figures would produce a misleading leaderboard.
  const ranked = [...result.entries()]
    .filter(([, insight]) => insight.rankValue !== null && insight.rankValue > 0)
    .sort((a, b) => (b[1].rankValue! - a[1].rankValue!) || a[0].localeCompare(b[0]))
  let lastValue: number | null = null
  let lastRank = 0
  ranked.forEach(([customerId, insight], index) => {
    const value = insight.rankValue!
    if (lastValue === null || value !== lastValue) lastRank = index + 1
    insight.rank = lastRank
    lastValue = value
    result.set(customerId, insight)
  })

  return result
}
