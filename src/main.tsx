import { DialogHost } from './lib/dialogs'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { I18nProvider, t } from './i18n'
import { loadPreferences } from './lib/preferences'
import { clearExportCache } from './lib/cache'
import SecurityGate from './components/SecurityGate'
import { SplashScreen } from '@capacitor/splash-screen'
import { Capacitor } from '@capacitor/core'

// Fatorati Offline - 100% Local • Offline
// Simple business management. No subscription. Works offline.

const app = (
  <React.StrictMode>
    <I18nProvider><DialogHost /><SecurityGate><App /></SecurityGate></I18nProvider>
  </React.StrictMode>
)

const container = document.getElementById('root')!

// Error boundary for white screen fix
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Fatorati Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-line p-8 max-w-md w-full text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h1 className="text-xl font-bold text-ink mb-2">{t("Something went wrong")}</h1>
            <p className="text-[13px] text-muted mb-4">{t("An error occurred")}</p>
            <button
              onClick={() => {
                window.location.reload()
              }}
              className="bg-brand text-white px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm"
            >{t("Reload")}</button>
            <p className="text-[12px] text-muted mt-4">{t("Fatorati • 100% Local • Offline")}</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

async function start() {
  try {
    await loadPreferences()
    // Staged plaintext CSV/PDF/backup files from earlier sessions are removed at start.
    void clearExportCache()
    ReactDOM.createRoot(container).render(<ErrorBoundary>{app}</ErrorBoundary>)
  } catch {
    // Fail closed; never mount business data if initialization fails.
    container.textContent = t('Storage unavailable')
  } finally {
    if (Capacitor.isNativePlatform()) await SplashScreen.hide()
  }
}
void start()
