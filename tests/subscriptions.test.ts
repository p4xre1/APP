import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addMonthsClamped, amountToMinor, attentionList, cycleMonths, dayNumber, daysBetween, isISODate, minorToAmount,
  monthlyMinor, nextRenewalDate, parseISODate, sortByNearest, subscriptionCategories, subscriptionEndDate,
  subscriptionSummary, subscriptionView, subscribeEndOrRenewal, todayISO, validateSubscription, warnDays,
  yearlyMinor, DEFAULT_WARN_DAYS, MAX_PERIOD_MONTHS,
} from '../src/lib/subscriptions'
import type { Subscription } from '../src/store/types'

const base: Subscription = {
  id: 's1', serviceName: 'Hosting', amountMinor: 12000, currency: 'USD', billingCycle: 'monthly',
  autoRenew: true, startDate: '2026-01-31', createdAt: 1, updatedAt: 1,
}
const at = (isoDay: string) => Date.parse(`${isoDay}T12:00:00Z`)
const make = (patch: Partial<Subscription> = {}): Subscription => ({ ...base, ...patch })

test('ISO dates parse strictly; month lengths and leap years are exact', () => {
  assert.deepEqual(parseISODate('2026-02-28'), { year: 2026, month: 2, day: 28 })
  assert.equal(parseISODate('2026-02-30'), null)
  assert.equal(parseISODate('2026-13-01'), null)
  assert.equal(parseISODate('31/01/2026'), null)
  assert.notEqual(parseISODate('2024-02-29'), null)
  assert.equal(isISODate('2024-02-29'), true)
  assert.equal(isISODate('2026-02-29'), false)
  assert.equal(dayNumber('2026-01-01') + 1, dayNumber('2026-01-02'))
  assert.equal(daysBetween('2026-01-31', '2026-03-01'), 29)
})

test('month-end renewals clamp instead of overflowing into the next month', () => {
  assert.equal(addMonthsClamped('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonthsClamped('2024-01-31', 1), '2024-02-29')
  assert.equal(addMonthsClamped('2026-01-31', 2), '2026-03-31')
  assert.equal(addMonthsClamped('2026-03-31', 1), '2026-04-30')
  assert.equal(addMonthsClamped('2026-12-15', 1), '2027-01-15')
  assert.equal(addMonthsClamped('2026-01-31', 12), '2027-01-31')

  // A 31st subscription renews on the last day of shorter months, never on the 3rd.
  assert.equal(nextRenewalDate(make(), '2026-02-01'), '2026-02-28')
  assert.equal(nextRenewalDate(make(), '2026-02-28'), '2026-02-28')
  assert.equal(nextRenewalDate(make(), '2026-03-01'), '2026-03-31')
  assert.equal(nextRenewalDate(make(), '2026-04-01'), '2026-04-30')
})

test('yearly renewals handle leap years and stay on the original month', () => {
  const leap = make({ billingCycle: 'yearly', startDate: '2024-02-29' })
  assert.equal(nextRenewalDate(leap, '2024-03-01'), '2025-02-28')
  assert.equal(nextRenewalDate(leap, '2025-03-01'), '2026-02-28')
  assert.equal(nextRenewalDate(leap, '2027-03-01'), '2028-02-29')
  assert.equal(nextRenewalDate(make({ billingCycle: 'yearly', startDate: '2025-06-10' }), '2026-01-01'), '2026-06-10')
})

test('a future start date and a very old start date both resolve to a future renewal', () => {
  const future = make({ startDate: '2027-03-15' })
  assert.equal(nextRenewalDate(future, '2026-09-30'), '2027-03-15')
  assert.equal(subscriptionView(future, { now: at('2026-09-30'), timeZone: 'UTC' }).daysLeft, 166)
  assert.equal(subscriptionView(future, { now: at('2026-09-30'), timeZone: 'UTC' }).status, 'active')

  const old = make({ startDate: '1990-01-15' })
  assert.equal(nextRenewalDate(old, '2026-09-30'), '2026-10-15')
  assert.equal(subscriptionView(old, { now: at('2026-09-30'), timeZone: 'UTC' }).status, 'active')
})

test('DST and time-zone changes never shift a calendar day', () => {
  // 2026-03-29 is the European DST switch; 2026-11-01 the American one.
  assert.equal(todayISO(Date.parse('2026-03-29T00:30:00Z'), 'Africa/Casablanca'), '2026-03-29')
  assert.equal(todayISO(Date.parse('2026-03-29T23:30:00Z'), 'Africa/Casablanca'), '2026-03-30')
  assert.equal(todayISO(Date.parse('2026-11-01T04:30:00Z'), 'America/New_York'), '2026-11-01')
  assert.equal(todayISO(Date.parse('2026-11-01T23:30:00Z'), 'America/New_York'), '2026-11-01')
  // Same instant on two zones that are on different calendar days: each keeps its own "today".
  const subscription = make({ startDate: '2026-04-01' })
  const instant = Date.parse('2026-03-31T23:30:00Z')
  assert.equal(subscriptionView(subscription, { now: instant, timeZone: 'Africa/Casablanca' }).daysLeft, 0)
  assert.equal(subscriptionView(subscription, { now: instant, timeZone: 'America/New_York' }).daysLeft, 1)
})

test('status boundaries sit exactly at warnDays and at zero days', () => {
  const monthly = make({ startDate: '2026-09-02' }) // renews on the 2nd of each month
  const day = 7
  assert.equal(subscriptionView(monthly, { now: at('2026-09-25'), timeZone: 'UTC' }).daysLeft, day)
  assert.equal(subscriptionView(monthly, { now: at('2026-09-25'), timeZone: 'UTC' }).status, 'expiring_soon')
  assert.equal(subscriptionView(monthly, { now: at('2026-09-24'), timeZone: 'UTC' }).daysLeft, day + 1)
  assert.equal(subscriptionView(monthly, { now: at('2026-09-24'), timeZone: 'UTC' }).status, 'active')
  assert.equal(subscriptionView(monthly, { now: at('2026-10-02'), timeZone: 'UTC' }).daysLeft, 0)
  assert.equal(subscriptionView(monthly, { now: at('2026-10-02'), timeZone: 'UTC' }).status, 'expiring_soon')

  // warnDays is configurable from 1 to 30 and clamped outside that range.
  assert.equal(warnDays(1), 1)
  assert.equal(warnDays(30), 30)
  assert.equal(warnDays(0), 1)
  assert.equal(warnDays(90), 30)
  assert.equal(warnDays('x'), DEFAULT_WARN_DAYS)
  assert.equal(subscriptionView(monthly, { now: at('2026-09-30'), timeZone: 'UTC', warn: 1 }).status, 'active')
  assert.equal(subscriptionView(monthly, { now: at('2026-10-01'), timeZone: 'UTC', warn: 1 }).status, 'expiring_soon')
})

test('auto-renewing entries never expire, non-renewing ones do', () => {
  const renewing = make({ startDate: '2026-01-10' })
  const expiredRenewing = subscriptionView(renewing, { now: at('2030-06-01'), timeZone: 'UTC' })
  assert.equal(expiredRenewing.status, 'active')
  assert.equal(expiredRenewing.date, '2030-06-10')

  const oneOff = make({ billingCycle: 'one_time_period', periodMonths: 3, autoRenew: false, startDate: '2026-01-15' })
  assert.equal(subscriptionEndDate(oneOff), '2026-04-15')
  assert.equal(subscriptionView(oneOff, { now: at('2026-04-15'), timeZone: 'UTC' }).status, 'expiring_soon')
  assert.equal(subscriptionView(oneOff, { now: at('2026-04-16'), timeZone: 'UTC' }).status, 'expired')
  assert.equal(subscriptionView(oneOff, { now: at('2026-04-16'), timeZone: 'UTC' }).daysLeft, -1)

  const monthlyNoRenew = make({ autoRenew: false, startDate: '2026-01-15' })
  assert.equal(subscriptionEndDate(monthlyNoRenew), '2026-02-15')
  assert.equal(subscriptionView(monthlyNoRenew, { now: at('2026-02-16'), timeZone: 'UTC' }).status, 'expired')

  const cancelled = make({ cancelledAt: Date.parse('2026-09-01T10:00:00Z') })
  assert.equal(subscriptionView(cancelled, { now: at('2026-09-30'), timeZone: 'UTC' }).status, 'cancelled')
  // The renewal date is still reported for a cancelled entry so the list can show it.
  assert.equal(subscribeEndOrRenewal(cancelled, { now: at('2026-10-01'), timeZone: 'UTC' }), '2026-10-31')
  assert.equal(cycleMonths({ billingCycle: 'yearly' }), 12)
  assert.equal(cycleMonths({ billingCycle: 'one_time_period', periodMonths: 5 }), 5)
  assert.equal(cycleMonths({ billingCycle: 'one_time_period' }), 1)
  assert.equal(cycleMonths({ billingCycle: 'one_time_period', periodMonths: 999 }), MAX_PERIOD_MONTHS)
})

test('monthly and yearly normalisation is exact in minor units', () => {
  const yearly = make({ billingCycle: 'yearly', amountMinor: 120000 })
  assert.equal(monthlyMinor(yearly), 10000)
  assert.equal(yearlyMinor(yearly), 120000)
  assert.equal(monthlyMinor(make({ amountMinor: 9900 })), 9900)
  assert.equal(yearlyMinor(make({ amountMinor: 9900 })), 118800)
  const quarterly = make({ billingCycle: 'one_time_period', periodMonths: 3, amountMinor: 10000 })
  assert.equal(monthlyMinor(quarterly), 3333)
  assert.equal(yearlyMinor(quarterly), 40000)
  assert.equal(amountToMinor(19.99, 'USD'), 1999)
  assert.equal(amountToMinor(199.5, 'MAD'), 19950)
  assert.equal(minorToAmount(1999, 'USD'), 19.99)
  assert.equal(minorToAmount(19950, 'MAD'), 199.5)
})

test('totals are per currency and skip cancelled or expired entries', () => {
  const rows: Subscription[] = [
    make({ id: 'a', currency: 'USD', amountMinor: 1000 }),
    make({ id: 'b', currency: 'USD', billingCycle: 'yearly', amountMinor: 12000 }),
    make({ id: 'c', currency: 'MAD', amountMinor: 25000 }),
    make({ id: 'd', currency: 'MAD', amountMinor: 99000, cancelledAt: 1 }),
    make({ id: 'e', currency: 'EUR', amountMinor: 5000, autoRenew: false, startDate: '2020-01-01' }),
  ]
  const totals = subscriptionSummary(rows, { now: at('2026-09-30'), timeZone: 'UTC' })
  assert.deepEqual(totals.map(row => row.currency), ['MAD', 'USD'])
  const usd = totals.find(row => row.currency === 'USD')!
  assert.equal(usd.monthlyMinor, 2000) // 10.00 + 120.00/12
  assert.equal(usd.yearlyMinor, 24000)
  assert.equal(usd.count, 2)
  assert.equal(totals.find(row => row.currency === 'MAD')!.monthlyMinor, 25000)
  // Currencies are never summed into one another.
  assert.equal(totals.length, 2)
})

test('list order and the attention banner follow the nearest date', () => {
  const soon = make({ id: 'soon', serviceName: 'Soon', startDate: '2026-10-03' })
  const later = make({ id: 'later', serviceName: 'Later', startDate: '2026-11-20' })
  const gone = make({ id: 'gone', serviceName: 'Gone', billingCycle: 'one_time_period', periodMonths: 1, autoRenew: false, startDate: '2026-01-01' })
  const cancelled = make({ id: 'cancelled', serviceName: 'Cancelled', cancelledAt: 1 })
  const rows = [cancelled, later, gone, soon]
  const options = { now: at('2026-09-30'), timeZone: 'UTC' }
  // Overdue entries surface first, then the soonest upcoming ones; cancelled last.
  assert.deepEqual(sortByNearest(rows, options).map(row => row.subscription.id), ['gone', 'soon', 'later', 'cancelled'])
  assert.deepEqual(attentionList(rows, options).map(row => row.subscription.id), ['gone', 'soon'])
  assert.deepEqual(subscriptionCategories([...rows, make({ id: 'f', category: 'Media' }), make({ id: 'g', category: '  ' })]), ['Media'])
})

test('validation rejects the cases the form must block', () => {
  const valid = { serviceName: 'Hosting', amountMinor: 1000, currency: 'USD', startDate: '2026-01-31' }
  assert.equal(validateSubscription(valid), null)
  assert.match(validateSubscription({ ...valid, serviceName: '  ' })!, /service name/)
  assert.match(validateSubscription({ ...valid, amountMinor: 0 })!, /greater than zero/)
  assert.match(validateSubscription({ ...valid, amountMinor: 10.5 })!, /greater than zero/)
  assert.match(validateSubscription({ ...valid, currency: 'GBP' })!, /currency/)
  assert.match(validateSubscription({ ...valid, startDate: '2026-02-30' })!, /valid date/)
  assert.match(validateSubscription({ ...valid, periodMonths: 0 })!, /1 and 120/)
  assert.equal(validateSubscription({ ...valid, periodMonths: 12 }), null)
})

test('todayISO without a zone uses the device local calendar date', () => {
  const now = Date.parse('2026-09-30T22:45:00Z')
  const expected = new Date(now)
  const local = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`
  assert.equal(todayISO(now), local)
  assert.equal(todayISO(now, 'UTC'), '2026-09-30')
  assert.equal(todayISO(now, 'Africa/Casablanca'), '2026-09-30')
})
