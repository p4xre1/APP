/**
 * Fatorati Offline - Main App
 * 100% Local • Offline - Simple business management
 * No subscription. Your data stays on device. Works offline.
 * Create invoice → PDF → Share - easy for US customers
 */

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
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-600">Loading Fatorati...</p>
      </div>
    </div>
  )
}

const NAV_ITEMS: { key: ModuleKey; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'customers', label: 'Customers', icon: '👥' },
  { key: 'projects', label: 'Projects', icon: '📁' },
  { key: 'invoices', label: 'Invoices', icon: '📄' },
  { key: 'estimates', label: 'Estimates', icon: '📝' },
  { key: 'expenses', label: 'Expenses', icon: '💸' },
  { key: 'products', label: 'Products', icon: '📦' },
  { key: 'reports', label: 'Reports', icon: '📈' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
]

function Sidebar({ active, onNavigate, businessName }: { active: ModuleKey; onNavigate: (k: ModuleKey) => void; businessName: string }) {
  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold">Fatorati</h1>
        <p className="text-xs text-slate-400 mt-1 truncate">{businessName}</p>
        <div className="mt-3 px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-300">
          100% Local • Offline
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active === item.key
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      
      <div className="p-4 border-t border-slate-800">
        <p className="text-[11px] text-slate-500">
          Simple business management<br />
          No subscription • Works offline<br />
          Your data stays on device
        </p>
      </div>
    </div>
  )
}

function MobileNav({ active, onNavigate }: { active: ModuleKey; onNavigate: (k: ModuleKey) => void }) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex overflow-x-auto">
      {NAV_ITEMS.slice(0, 5).map((item) => (
        <button
          key={item.key}
          onClick={() => onNavigate(item.key)}
          className={`flex-1 flex flex-col items-center py-2.5 px-1 text-[11px] font-medium ${
            active === item.key ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
          }`}
        >
          <span className="text-lg">{item.icon}</span>
          <span className="mt-0.5 truncate">{item.label}</span>
        </button>
      ))}
    </div>
  )
}

function Topbar({ title, businessName }: { title: string; businessName: string }) {
  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-500 hidden sm:block">
          {businessName} • 100% Local • Offline
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
          {businessName.charAt(0).toUpperCase()}
        </div>
      </div>
    </div>
  )
}

export default function App() {
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

  const currentTitle = NAV_ITEMS.find((n) => n.key === active)?.label || 'Fatorati'

  function renderModule() {
    switch (active) {
      case 'dashboard':
        return <Dashboard />
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
        return <Dashboard />
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden lg:flex">
        <Sidebar active={active} onNavigate={setActive} businessName={business.name} />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={currentTitle} businessName={business.name} />
        
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-auto">
          <Suspense fallback={<Fallback />}>
            {renderModule()}
          </Suspense>
        </main>
        
        <MobileNav active={active} onNavigate={setActive} />
      </div>
    </div>
  )
}
