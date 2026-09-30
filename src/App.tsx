import AppShell from './components/AppShell'
import { t } from './i18n'
/**
 * Fatorati Offline - Main App
 * 100% Local • Offline - Simple business management
 * No subscription. Your data stays on device. Works offline.
 * Create invoice → PDF → Share - easy for US customers
 */

import { useI18n } from './i18n'
import { useEffect, useState, Suspense, lazy } from 'react'
import { Loader2, ShieldAlert, RefreshCw, LockKeyhole } from 'lucide-react'
import { useFatorati } from './store/useFatorati'
import Onboarding from './components/Onboarding'
import { lockVault } from './lib/vault'
import type { ModuleKey } from './store/types'

// Lazy load modules for better performance
const Dashboard = lazy(() => import('./modules/Dashboard'))
const Customers = lazy(() => import('./modules/Customers'))
const Projects = lazy(() => import('./modules/Projects'))
const Invoices = lazy(() => import('./modules/Invoices'))
const Estimates = lazy(() => import('./modules/Estimates'))
const Expenses = lazy(() => import('./modules/Expenses'))
const Products = lazy(() => import('./modules/Products'))
const Settings = lazy(() => import('./modules/Settings'))
const Reports = lazy(() => import('./modules/Reports'))
const Subscriptions = lazy(() => import('./modules/Subscriptions'))
const TaxGuide = lazy(() => import('./modules/TaxGuide'))
const HelpCenter = lazy(() => import('./modules/HelpCenter'))
const Faq = lazy(() => import('./modules/Faq'))
const LegalDocument = lazy(() => import('./modules/LegalDocument'))
const TemplatePicker = lazy(() => import('./modules/TemplatePicker'))

function Fallback() {
  return (
    <div className="min-h-screen grid place-items-center bg-canvas">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand mx-auto mb-3" />
        <p className="text-[13px] text-muted">{t("Loading Fatorati...")}</p>
      </div>
    </div>
  )
}

/**
 * Shown when the vault cannot be read. Onboarding is deliberately NOT offered here:
 * a failed read must never be mistaken for a fresh install.
 */
function LoadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-line p-6 max-w-md w-full shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h1 className="text-[15px] font-bold text-ink flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-warn" />{t("Your data could not be read")}</h1>
        <p className="mt-3 text-[13px] text-muted">{t("Nothing was changed. Your records are still on this phone.")}</p>
        <p role="alert" className="mt-2 text-[13px] text-serious">{message}</p>
        <div className="mt-3 rounded-lg bg-canvas p-3 text-[12px] text-muted">{t("Restore a backup from Settings, or retry after closing other app windows. Do not create a new business: it would be written next to your existing records.")}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onRetry} className="inline-flex items-center gap-2 bg-brand hover:bg-brand-700 text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] shadow-sm">
            <RefreshCw className="w-4 h-4" />{t("Retry")}
          </button>
          <button onClick={() => lockVault()} className="inline-flex items-center gap-2 bg-canvas text-ink px-3.5 py-2 rounded-lg text-[13px] font-medium">
            <LockKeyhole className="w-4 h-4" />{t("Lock now")}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  useI18n()
  const { business, isOnboarded, isLoading, loadError, init, completeOnboarding, subscriptions, settings, resyncReminders } = useFatorati()
  const [active, setActive] = useState<ModuleKey>('dashboard')

  useEffect(() => {
    void init()
  }, [init])

  // Reminders are rebuilt on launch and whenever a subscription or a reminder
  // setting changes, so deleted and cancelled entries never keep firing.
  const reminderKey = JSON.stringify([
    subscriptions.map(row => [row.id, row.updatedAt, row.cancelledAt ?? null, row.startDate, row.billingCycle, row.autoRenew, row.periodMonths ?? null]),
    settings?.subscriptionReminders ?? false, settings?.subscriptionWarnDays ?? null,
    settings?.subscriptionDayOfReminder ?? false, settings?.subscriptionHideNames ?? true,
  ])
  useEffect(() => {
    if (!isOnboarded) return
    void resyncReminders()
  }, [reminderKey, isOnboarded, resyncReminders])

  if (isLoading) {
    return <Fallback />
  }

  if (loadError) {
    return <LoadFailure message={loadError} onRetry={() => void init()} />
  }

  if (!isOnboarded || !business) {
    return <Onboarding onComplete={completeOnboarding} />
  }


  function renderModule() {
    switch (active) {
      case 'dashboard':
        return <Dashboard onNavigate={setActive} />
      case 'customers':
        return <Customers />
      case 'projects':
        return <Projects />
      case 'invoices':
        return <Invoices />
      case 'estimates':
        return <Estimates />
      case 'expenses':
        return <Expenses />
      case 'products':
        return <Products />
      case 'reports':
        return <Reports />
      case 'subscriptions':
        return <Subscriptions />
      case 'settings':
        return <Settings onNavigate={setActive} />
      case 'taxGuide':
        return <TaxGuide onBack={() => setActive('settings')} />
      case 'help':
        return <HelpCenter onBack={() => setActive('settings')} onNavigate={setActive} />
      case 'faq':
        return <Faq onBack={() => setActive('help')} />
      case 'privacy':
      case 'terms':
        return <LegalDocument kind={active} onBack={() => setActive('settings')} />
      case 'templates':
        return <TemplatePicker onBack={() => setActive('settings')} />
      default:
        return <Dashboard onNavigate={setActive} />
    }
  }

  return <AppShell active={active} onNavigate={setActive} businessName={business.name}>
    <Suspense fallback={<Fallback />}>{renderModule()}</Suspense>
  </AppShell>
}
