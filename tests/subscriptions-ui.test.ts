import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { savePreferences } from '../src/lib/preferences'
import { subscriptionSummary } from '../src/lib/subscriptions'
import { planReminders, reminderSettings } from '../src/lib/notifications'
import type { SubscriptionStatus } from '../src/lib/subscriptions'
import type { Subscription } from '../src/store/types'

// The Capacitor Preferences web implementation persists through localStorage.
const webStorage = { store: new Map<string, string>(), getItem(key: string) { return this.store.get(key) ?? null }, setItem(key: string, value: string) { this.store.set(key, value) }, removeItem(key: string) { this.store.delete(key) }, clear() { this.store.clear() } }
Object.assign(globalThis, { localStorage: webStorage, window: Object.assign(new EventTarget(), { localStorage: webStorage }) })

const languages = ['en', 'ar', 'fr', 'es', 'pt'] as const
const dictionaries = Object.fromEntries(languages.map(language => [
  language,
  JSON.parse(readFileSync(`src/i18n/${language}.json`, 'utf8')) as Record<string, string>,
])) as Record<typeof languages[number], Record<string, string>>

const { SubscriptionAttentionBanner, SubscriptionStatusChip, SubscriptionSummaryCard, default: Subscriptions } = await import('../src/modules/Subscriptions')

const rows: Subscription[] = [
  { id: 'a', serviceName: 'Netflix', category: 'Media', amountMinor: 12000, currency: 'USD', billingCycle: 'monthly', autoRenew: true, startDate: '2026-10-20', paymentMethod: 'Card', createdAt: 1, updatedAt: 1 },
  { id: 'b', serviceName: 'Rent', category: 'Home', amountMinor: 300000, currency: 'MAD', billingCycle: 'monthly', autoRenew: true, startDate: '2026-10-02', createdAt: 1, updatedAt: 1 },
  { id: 'c', serviceName: 'Old licence', amountMinor: 9900, currency: 'EUR', billingCycle: 'one_time_period', periodMonths: 1, autoRenew: false, startDate: '2026-01-10', createdAt: 1, updatedAt: 1 },
]
const NOW = Date.parse('2026-10-01T12:00:00Z')

test('every string the subscriptions feature uses exists in all five dictionaries', () => {
  const files = [
    'src/modules/Subscriptions.tsx', 'src/components/SubscriptionRemindersPanel.tsx',
    'src/lib/subscriptions.ts', 'src/lib/notifications.ts', 'src/lib/subscription-export.ts',
  ]
  const used = new Set<string>([
    // Status and cycle values reach t() from data, never as literals.
    'active', 'expiring_soon', 'expired', 'cancelled', 'monthly', 'yearly', 'one_time_period',
  ])
  for (const file of files) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      for (const call of line.matchAll(/\btr?\(([^()]*)\)/g)) {
        for (const literal of call[1].matchAll(/'([^']{2,})'/g)) used.add(literal[1])
      }
    }
  }
  assert.ok(used.size > 80, `only ${used.size} strings found`)
  for (const language of languages) {
    assert.deepEqual([...used].filter(key => !(key in dictionaries[language])), [], `${language} is missing keys`)
  }
})

test('the screens render in all five languages, Arabic included', async () => {
  const statuses: SubscriptionStatus[] = ['active', 'expiring_soon', 'expired', 'cancelled']
  for (const language of languages) {
    await savePreferences({ language })
    const dictionary = dictionaries[language]
    const html = renderToStaticMarkup(createElement('div', null,
      createElement(SubscriptionAttentionBanner, { rows, onOpen: () => undefined }),
      createElement(SubscriptionSummaryCard, { rows }),
      createElement(Subscriptions),
      ...statuses.map(status => createElement(SubscriptionStatusChip, { key: status, status, daysLeft: 3 })),
    ))
    assert.ok(html.includes(dictionary['Subscriptions needing attention']), language)
    assert.ok(html.includes(dictionary['Subscriptions']), language)
    assert.ok(html.includes(dictionary['New subscription']) && html.includes(dictionary['Excel']) && html.includes(dictionary['PDF']), language)
    assert.ok(html.includes(dictionary['Currencies are never added together: each one is totalled separately.']), language)
    // The screen itself reads the store, which is empty in a server render.
    assert.ok(html.includes(dictionary['No subscriptions yet']), language)
    for (const status of statuses) assert.ok(html.includes(dictionary[status]), `${language}/${status}`)
    assert.ok(html.includes(dictionary['{count} days left'].replace('{count}', '3')), `${language} days left`)
    // Real Arabic in the Arabic build, and nowhere else.
    assert.equal(/[\u0600-\u06FF]/.test(html), language === 'ar', language)
    if (language === 'en') {
      // One total per currency, never a mixed-currency sum.
      assert.ok(html.includes('3,000.00') && html.includes('120.00'))
      assert.ok(html.includes('Old licence'))
    }
  }
  await savePreferences({ language: 'en' })
})

test('the module never touches the network and the manifest keeps the permissions tame', () => {
  assert.equal(readFileSync('index.html', 'utf8').includes("connect-src 'none'"), true)
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
  assert.equal(manifest.includes('android.permission.INTERNET'), false)
  assert.ok(manifest.includes('android.permission.POST_NOTIFICATIONS'))
  assert.ok(manifest.includes('SCHEDULE_EXACT_ALARM" tools:node="remove"'))
  assert.ok(manifest.includes('USE_EXACT_ALARM" tools:node="remove"'))

  for (const file of ['src/lib/subscriptions.ts', 'src/lib/notifications.ts', 'src/lib/subscription-export.ts', 'src/modules/Subscriptions.tsx', 'src/components/SubscriptionRemindersPanel.tsx']) {
    assert.equal(/\bfetch\s*\(|XMLHttpRequest|https?:\/\//.test(readFileSync(file, 'utf8')), false, file)
  }
  // Inexact alarms only, and the xlsx writer is the maintained small library.
  assert.ok(readFileSync('src/lib/notifications.ts', 'utf8').includes('isExactNotification: false'))
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> }
  assert.ok(pkg.dependencies['write-excel-file'])
  assert.equal('xlsx' in pkg.dependencies, false)
})

test('the plan and the totals in the UI agree with the pure functions', () => {
  const config = reminderSettings({ subscriptionReminders: true, subscriptionWarnDays: 7, subscriptionDayOfReminder: false, subscriptionHideNames: true } as never)
  const plans = planReminders(rows, config, { now: NOW, timeZone: 'UTC', language: 'en' })
  // Rent renews on the 2nd (window already open, clamped to today) before Netflix on the 20th;
  // the expired one-off gets nothing.
  assert.deepEqual(plans.map(plan => plan.subscriptionId), ['b', 'a'])
  assert.deepEqual(plans.map(plan => plan.date), ['2026-10-01', '2026-10-13'])
  const summary = subscriptionSummary(rows, { now: NOW, timeZone: 'UTC' })
  assert.deepEqual(summary.map(total => total.currency), ['MAD', 'USD'])
})
