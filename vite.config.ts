import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The shipped index.html pins a strict Content-Security-Policy (no network, no
 * inline scripts from the app). That policy also blocks Vite's own dev client,
 * so the dev server serves a relaxed copy. `vite build` leaves index.html
 * untouched, so the APK keeps the strict policy.
 */
function devCsp() {
  return {
    name: 'fatorati-dev-csp',
    apply: 'serve' as const,
    enforce: 'pre' as const,
    transformIndexHtml(html: string) {
      return html.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'" />`,
      )
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), devCsp()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true, // Sandbox/preview hosts; the served app still blocks network calls.
  },
  preview: { host: true, port: 4173, strictPort: true, allowedHosts: true },
})
