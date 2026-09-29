// Post-build step: prerenders the marketing landing page to static HTML and
// injects it into dist/index.html's #root, so the page served to crawlers
// and first-time visitors has real content before any JavaScript runs.
//
// Run automatically as part of `npm run build` — see package.json.
// Safe to fail: if anything goes wrong, the client-rendered SPA still works
// exactly as before, so a prerender failure never breaks the deployed site.

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const clientDir = path.join(root, "dist")
const ssrDir = path.join(root, "dist-ssr")
const ssrEntry = path.join(ssrDir, "entry-server.js")
const indexPath = path.join(clientDir, "index.html")
const ROOT_PLACEHOLDER = '<div id="root"></div>'

async function main() {
  if (!existsSync(ssrEntry)) {
    console.warn(`[prerender] SSR bundle not found at ${ssrEntry} — skipping, shipping client-only render.`)
    return
  }
  if (!existsSync(indexPath)) {
    console.warn(`[prerender] ${indexPath} not found — skipping.`)
    return
  }

  const { render } = await import(pathToFileURL(ssrEntry).href)
  const appHtml = render()

  const html = readFileSync(indexPath, "utf-8")
  if (!html.includes(ROOT_PLACEHOLDER)) {
    console.warn(`[prerender] Could not find ${ROOT_PLACEHOLDER} in dist/index.html — skipping injection.`)
    return
  }

  const filled = html.replace(ROOT_PLACEHOLDER, `<div id="root">${appHtml}</div>`)
  writeFileSync(indexPath, filled, "utf-8")
  console.log(`[prerender] Injected server-rendered landing page (${appHtml.length.toLocaleString()} chars) into dist/index.html`)
}

main()
  .catch((err) => {
    console.error("[prerender] Failed — shipping client-only render instead.", err)
  })
  .finally(() => {
    // The SSR bundle is a build-time tool only; never part of the deployed site.
    rmSync(ssrDir, { recursive: true, force: true })
  })
