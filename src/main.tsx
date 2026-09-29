import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Fatorati Offline - 100% Local • Offline
// Simple business management. No subscription. Works offline.

const app = (
  <React.StrictMode>
    <App />
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
    // Clear potentially corrupted storage
    try {
      localStorage.removeItem('fatorati-offline-v1')
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">{this.state.error || 'An error occurred'}</p>
            <button
              onClick={() => {
                localStorage.clear()
                window.location.reload()
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Clear data & Reload
            </button>
            <p className="text-xs text-gray-500 mt-4">Fatorati • 100% Local • Offline</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

if (container.hasChildNodes()) {
  ReactDOM.hydrateRoot(container, <ErrorBoundary>{app}</ErrorBoundary>)
} else {
  ReactDOM.createRoot(container).render(<ErrorBoundary>{app}</ErrorBoundary>)
}

// PWA update checker - offline first
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.ready.then((registration) => {
      // Check for updates if internet available
      if (navigator.onLine) {
        registration.update().catch(() => {
          // Fail silently - app works offline even if update server disappears
        })
      }
    })
  })
}

// Handle offline/online status
window.addEventListener('online', () => {
  console.log('Fatorati: Back online - checking for updates...')
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => reg.update().catch(() => {}))
  }
})

window.addEventListener('offline', () => {
  console.log('Fatorati: Offline mode - your data stays on device')
})
