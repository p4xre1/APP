import { useEffect, useState } from 'react'
import { getLastBackupDate } from './db'

export function useLastBackup() {
  const [lastBackup, setLastBackup] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const date = await getLastBackupDate()
        if (active) { setLastBackup(date); setError(false) }
      } catch { if (active) setError(true) }
      finally { if (active) { setLoaded(true); setNow(Date.now()) } }
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 60_000)
    window.addEventListener('fatorati:backup', refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('fatorati:backup', refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return { lastBackup, loaded, error, now, overdue: loaded && (lastBackup === null || now - lastBackup >= 7 * 86400_000) }
}
