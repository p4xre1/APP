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
import { Loader2 } from 'lucide-react'
import { useFatorati } from './store/useFatorati'
import Onboarding from './components/Onboarding'
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

export default function App() {
  useI18n()
  const { business, isOnboarded, isLoading, init, completeOnboarding } = useFatorati()
  const [active, setActive] = useState<ModuleKey>('dashboard')

  useEffect(() => {
    init()
  }, [init])

  if (isLoading) {
    return <Fallback />
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
      case 'settings':
        return <Settings />
      default:
        return <Dashboard onNavigate={setActive} />
    }
  }

  return <AppShell active={active} onNavigate={setActive} businessName={business.name}>
    <Suspense fallback={<Fallback />}>{renderModule()}</Suspense>
  </AppShell>
}
